import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ComponentRegistry, GovernanceFinding, RunContext } from "../config/types.js";

type FigmaSnapshot = {
  component: string;
  variants?: Record<string, string | number>;
  tokens?: Record<string, string>;
};

type CodeSnapshot = {
  component: string;
  tokens?: Record<string, string>;
  metrics?: Record<string, string | number>;
};

async function loadJsonIfExists<T>(path: string): Promise<T | null> {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function getFigmaMeta(registry: ComponentRegistry, componentId: string) {
  const entry = registry.components[componentId];
  return (
    entry?.source_of_truth?.figma ??
    entry?.figma ??
    undefined
  );
}

export async function runFigmaCodeCheck(
  ctx: RunContext,
  componentId: string,
  registry: ComponentRegistry
): Promise<GovernanceFinding[]> {
  const mode =
    registry.components[componentId]?.source_of_truth?.mode ??
    ctx.profile.defaults?.source_of_truth?.mode ??
    "dual_compare";

  if (mode === "code") return [];

  const figmaMeta = getFigmaMeta(registry, componentId);
  const figmaEnabled = ctx.profile.defaults?.source_of_truth?.figma?.enabled;
  const snapshotsDir = join(ctx.workspaceRoot, ".ds-governance", "snapshots");

  const figmaSnap = await loadJsonIfExists<FigmaSnapshot>(
    join(snapshotsDir, `${componentId}.figma.json`)
  );
  const codeSnap = await loadJsonIfExists<CodeSnapshot>(
    join(snapshotsDir, `${componentId}.code.json`)
  );

  if (!figmaSnap || !codeSnap) {
    if (figmaEnabled || figmaMeta?.file_key) {
      return [
        {
          id: `DS-SOT-MISSING-${componentId}`,
          component: componentId,
          severity: "info",
          category: "figma_code_mismatch",
          title: "Figma/code snapshot not available",
          message:
            "Add `.ds-governance/snapshots/{Component}.figma.json` and `.code.json` or connect Figma API fetch (see README).",
          evidence: { mode },
        },
      ];
    }
    return [];
  }

  const findings: GovernanceFinding[] = [];
  const severity = ctx.profile.severity_policy?.figma_code_mismatch ?? "warn";
  const fileKey = figmaMeta?.file_key ?? ctx.figmaFileKey ?? "";
  const nodeId = figmaMeta?.component_set_node_id ?? "0:0";

  const figmaTokens = figmaSnap.tokens ?? {};
  const codeTokens = codeSnap.tokens ?? {};
  const keys = new Set([...Object.keys(figmaTokens), ...Object.keys(codeTokens)]);

  for (const key of keys) {
    const f = figmaTokens[key];
    const c = codeTokens[key];
    if (f === undefined || c === undefined) continue;
    if (f !== c) {
      findings.push({
        id: `DS-FIG-${componentId}-${key}`,
        component: componentId,
        severity,
        category: "figma_code_mismatch",
        title: `Figma/code mismatch: ${key}`,
        message: `Design uses \`${f}\` but code canonical has \`${c}\`.`,
        canonical: { source: "dual", expected: c, actual: f },
        figma: fileKey
          ? { file_key: fileKey, node_id: nodeId, post_comment: true }
          : undefined,
        fix: {
          suggestion:
            "Align variable in Figma with code token on main, or document an intentional waiver.",
        },
      });
    }
  }

  return findings;
}
