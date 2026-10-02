import type { GovernanceFinding, GovernanceProfile, RunResult } from "../config/types.js";

function formatComment(f: GovernanceFinding, prUrl?: string): string {
  const lines = [
    `🤖 DS Governance · ${f.severity} · ${f.component}`,
    "",
    f.title,
    "",
    f.message,
  ];
  if (f.canonical?.expected || f.canonical?.actual) {
    lines.push(
      "",
      `Expected: ${f.canonical.expected ?? "—"}`,
      `Actual: ${f.canonical.actual ?? "—"}`
    );
  }
  if (f.fix?.suggestion) lines.push("", `Fix: ${f.fix.suggestion}`);
  if (prUrl) lines.push("", `PR: ${prUrl}`);
  lines.push("", `Finding: ${f.id}`);
  return lines.join("\n");
}

export async function postFigmaComment(
  token: string,
  fileKey: string,
  message: string,
  nodeId?: string,
  replyToCommentId?: string
): Promise<{ id: string }> {
  const body: Record<string, unknown> = { message };
  if (replyToCommentId) {
    body.comment_id = replyToCommentId;
  } else if (nodeId) {
    body.client_meta = {
      node_id: nodeId,
      node_offset: { x: 8, y: 8 },
    };
  }

  const res = await fetch(`https://api.figma.com/v1/files/${fileKey}/comments`, {
    method: "POST",
    headers: {
      "X-FIGMA-TOKEN": token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Figma comment failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { id: string };
  return { id: data.id };
}

export async function publishFigmaComments(
  result: RunResult,
  profile: GovernanceProfile,
  prUrl?: string
): Promise<string[]> {
  const cfg = profile.flagging?.figma_comments;
  if (!cfg?.enabled) return [];

  const token = process.env[cfg.token_env ?? "FIGMA_ACCESS_TOKEN"];
  if (!token) {
    throw new Error(`Missing ${cfg.token_env ?? "FIGMA_ACCESS_TOKEN"} for Figma comments`);
  }

  const onSeverity = new Set(cfg.on_severity ?? ["block", "warn"]);
  const onCategories = cfg.on_categories?.length
    ? new Set(cfg.on_categories)
    : null;

  const eligible = result.findings.filter(
    (f) =>
      onSeverity.has(f.severity) &&
      f.figma?.file_key &&
      f.figma?.node_id &&
      (!onCategories || onCategories.has(f.category))
  );

  const posted: string[] = [];
  let threadRoot: string | undefined;

  for (const f of eligible) {
    const message = formatComment(f, prUrl);
    const fileKey = f.figma!.file_key;
    const nodeId = f.figma!.node_id;

    if (cfg.threading?.mode === "one_thread_per_run" && threadRoot) {
      const { id } = await postFigmaComment(token, fileKey, message, undefined, threadRoot);
      posted.push(id);
    } else {
      const { id } = await postFigmaComment(token, fileKey, message, nodeId);
      posted.push(id);
      if (cfg.threading?.mode === "one_thread_per_run") threadRoot = id;
    }
  }

  return posted;
}
