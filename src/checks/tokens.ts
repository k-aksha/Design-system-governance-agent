import type { GovernanceFinding, RunContext } from "../config/types.js";
import { readFileLines } from "../utils/git-diff.js";

const RAW_RGB = /\brgba?\(\s*\d+/gi;

let findingCounter = 0;

function nextId(prefix: string): string {
  findingCounter += 1;
  return `${prefix}-${String(findingCounter).padStart(4, "0")}`;
}

function lineUsesAllowedToken(
  line: string,
  prefixes: string[] | undefined
): boolean {
  if (!prefixes?.length) return false;
  return prefixes.some((p) => line.includes(p));
}

export async function runTokenCheck(
  ctx: RunContext,
  componentId: string,
  filePaths: string[]
): Promise<GovernanceFinding[]> {
  const findings: GovernanceFinding[] = [];
  const allowRaw = ctx.profile.tokens?.allow_raw_values ?? false;
  const prefixes = ctx.profile.tokens?.patterns?.allowed_var_prefixes;
  const defaultSeverity =
    ctx.profile.severity_policy?.token_consistency ?? "block";

  for (const filePath of filePaths) {
    let lines: string[];
    try {
      lines = await readFileLines(ctx.workspaceRoot, ctx.headDir, filePath);
    } catch {
      continue;
    }

    lines.forEach((line, index) => {
      const lineNo = index + 1;
      const hasRawColor = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/.test(line);
      if (!hasRawColor && !RAW_RGB.test(line)) return;
      if (lineUsesAllowedToken(line, prefixes) && !hasRawColor) return;

      for (const match of line.matchAll(
        /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g
      )) {
        if (allowRaw) return;
        findings.push({
          id: nextId("DS-TOK"),
          component: componentId,
          severity: defaultSeverity,
          category: "token_consistency",
          title: "Hardcoded color value",
          message: `Use a design token instead of raw color \`${match[0]}\`.`,
          location: { path: filePath, line: lineNo },
          canonical: { source: "code", expected: "semantic color token", actual: match[0] },
          evidence: { rule: "no-raw-color-values" },
          fix: {
            suggestion:
              "Bind to a semantic token (CSS variable or theme key) from your token manifest.",
          },
        });
      }

      if (RAW_RGB.test(line) && !allowRaw && !lineUsesAllowedToken(line, prefixes)) {
        findings.push({
          id: nextId("DS-TOK"),
          component: componentId,
          severity: defaultSeverity,
          category: "token_consistency",
          title: "Hardcoded rgb/rgba color",
          message: "Use a design token instead of rgb/rgba literals.",
          location: { path: filePath, line: lineNo },
          evidence: { rule: "no-raw-rgb" },
          fix: { suggestion: "Replace with var(--token-name) or theme token." },
        });
      }
    });
  }

  return findings;
}
