import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import type { GovernanceFinding } from "../config/types.js";

type Waiver = {
  id: string;
  rule?: string;
  component?: string;
  path?: string;
  expires_at?: string;
};

export async function applyWaivers(
  findings: GovernanceFinding[],
  waiversPath?: string
): Promise<GovernanceFinding[]> {
  if (!waiversPath) return findings;

  let waivers: Waiver[] = [];
  try {
    const raw = parseYaml(await readFile(waiversPath, "utf8")) as { waivers?: Waiver[] };
    waivers = raw.waivers ?? [];
  } catch {
    return findings;
  }

  const now = new Date();
  const active = waivers.filter((w) => {
    if (!w.expires_at) return true;
    return new Date(w.expires_at) >= now;
  });

  return findings
    .map((f) => {
      const waived = active.some(
        (w) =>
          (w.id && w.id === f.id) ||
          (w.rule && w.rule === f.evidence?.rule && w.component === f.component) ||
          (w.path && w.path === f.location?.path)
      );
      if (!waived) return f;
      return { ...f, severity: "info" as const, title: `[waived] ${f.title}` };
    })
    .filter((f) => !(f.title.startsWith("[waived]") && f.severity === "info"));
}
