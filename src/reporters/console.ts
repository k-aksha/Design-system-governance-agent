import type { RunResult } from "../config/types.js";

export function formatConsoleReport(result: RunResult): string {
  const lines: string[] = [];
  lines.push(`Design System Governance — run ${result.runId}`);
  lines.push(`Verdict: ${result.verdict.toUpperCase()}`);
  lines.push(`Components: ${result.components.join(", ") || "(none)"}`);
  lines.push(`Compared — code: ${result.comparedAgainst.code ?? "n/a"}, figma: ${result.comparedAgainst.figma ?? "n/a"}`);
  lines.push("");

  if (result.findings.length === 0) {
    lines.push("No findings.");
    return lines.join("\n");
  }

  for (const f of result.findings) {
    const loc = f.location
      ? ` @ ${f.location.path}${f.location.line ? `:${f.location.line}` : ""}`
      : "";
    lines.push(`[${f.severity}] ${f.component} — ${f.title}${loc}`);
    lines.push(`  ${f.message}`);
    if (f.fix?.suggestion) lines.push(`  → ${f.fix.suggestion}`);
    lines.push("");
  }

  return lines.join("\n");
}
