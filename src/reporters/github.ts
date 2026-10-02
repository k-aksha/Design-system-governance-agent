import { writeFile } from "node:fs/promises";
import type { GovernanceFinding, RunResult } from "../config/types.js";

export function buildPrComment(result: RunResult, prUrl?: string): string {
  const icon = (s: string) =>
    s === "block" ? "🔴" : s === "warn" ? "🟡" : "ℹ️";

  const rows = result.findings
    .map((f) => {
      const loc = f.location
        ? `\`${f.location.path}${f.location.line ? `:${f.location.line}` : ""}\``
        : "—";
      return `| ${icon(f.severity)} | ${f.component} | ${f.title} | ${loc} |`;
    })
    .join("\n");

  const blocks = result.findings.filter((f) => f.severity === "block").length;
  const warns = result.findings.filter((f) => f.severity === "warn").length;
  const verdictEmoji =
    result.verdict === "pass" ? "✅" : result.verdict === "warn" ? "🟡" : "❌";

  return `## Design System Governance ${verdictEmoji}

**Run:** \`${result.runId}\` · **Verdict:** ${result.verdict} (${blocks} block, ${warns} warn)

**Components:** ${result.components.join(", ") || "—"}

| | Component | Issue | Location |
|---|-----------|-------|----------|
${rows || "| — | — | No findings | — |"}

${prUrl ? `PR: ${prUrl}` : ""}
`;
}

export type GitHubAnnotation = {
  path: string;
  start_line: number;
  end_line: number;
  annotation_level: "failure" | "warning" | "notice";
  message: string;
  title: string;
};

export function findingsToAnnotations(findings: GovernanceFinding[]): GitHubAnnotation[] {
  return findings
    .filter((f) => f.location?.path && f.location.line)
    .map((f) => ({
      path: f.location!.path,
      start_line: f.location!.line!,
      end_line: f.location!.line!,
      annotation_level:
        f.severity === "block"
          ? "failure"
          : f.severity === "warn"
            ? "warning"
            : "notice",
      message: f.message,
      title: `[${f.component}] ${f.title}`,
    }));
}

export async function writeGithubOutputs(
  result: RunResult,
  outputPath: string,
  prCommentPath: string,
  prUrl?: string
): Promise<void> {
  const annotations = findingsToAnnotations(result.findings);
  await writeFile(
    outputPath,
    JSON.stringify({ result, annotations }, null, 2),
    "utf8"
  );
  await writeFile(prCommentPath, buildPrComment(result, prUrl), "utf8");
}
