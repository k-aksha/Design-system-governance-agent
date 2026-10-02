import type { ComponentRegistry, GovernanceFinding, RunContext } from "../config/types.js";
import { readFileLines } from "../utils/git-diff.js";

function extractExportNames(lines: string[]): string[] {
  const names: string[] = [];
  for (const line of lines) {
    const m1 = line.match(/export\s+(?:function|const)\s+(\w+)/);
    if (m1) names.push(m1[1]);
    const m2 = line.match(/export\s+default\s+function\s+(\w+)/);
    if (m2) names.push(m2[1]);
  }
  return names;
}

export async function runDuplicateCheck(
  ctx: RunContext,
  componentId: string,
  filePaths: string[],
  registry: ComponentRegistry
): Promise<GovernanceFinding[]> {
  const findings: GovernanceFinding[] = [];
  const severity = ctx.profile.severity_policy?.duplicate_candidate ?? "warn";

  const siblingComponents = Object.keys(registry.components).filter(
    (id) => id !== componentId
  );

  for (const filePath of filePaths) {
    if (!/\.(tsx|ts|jsx|js)$/i.test(filePath)) continue;
    let lines: string[];
    try {
      lines = await readFileLines(ctx.workspaceRoot, ctx.headDir, filePath);
    } catch {
      continue;
    }

    const exports = extractExportNames(lines);
    const baseName = filePath.split("/").pop()?.replace(/\.\w+$/, "") ?? "";

    for (const sibling of siblingComponents) {
      if (
        baseName.toLowerCase().includes(sibling.toLowerCase()) &&
        baseName !== sibling
      ) {
        findings.push({
          id: `DS-DUP-${componentId}-${sibling}`,
          component: componentId,
          severity,
          category: "duplicate_candidate",
          title: `Possible duplicate of ${sibling}`,
          message: `File \`${filePath}\` looks like a parallel implementation of \`${sibling}\`. Consider extending the canonical component.`,
          location: { path: filePath, line: 1 },
          evidence: {
            rule: "name-similarity",
            duplicate_of: sibling,
            confidence: 0.75,
          },
          fix: {
            suggestion: `Use @ds/${sibling.toLowerCase()} or contribute variants to ${sibling}.`,
          },
        });
      }
    }

    if (
      exports.some((e) => /button/i.test(e)) &&
      componentId !== "Button" &&
      /button/i.test(filePath)
    ) {
      findings.push({
        id: `DS-DUP-BUTTON-${filePath}`,
        component: componentId,
        severity,
        category: "duplicate_candidate",
        title: "Button-like export outside Button package",
        message: `Found button-like exports in \`${filePath}\`. Flag for consolidation with Button.`,
        location: { path: filePath, line: 1 },
        evidence: { exports, rule: "button-fingerprint" },
      });
    }
  }

  return findings;
}
