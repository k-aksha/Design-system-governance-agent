import type { ComponentRegistry, RunResult } from "../config/types.js";

export function buildSlackPayload(
  result: RunResult,
  registry: ComponentRegistry,
  prUrl?: string
): { text: string; blocks: unknown[] } {
  const top = result.findings.filter((f) => f.severity !== "info").slice(0, 8);
  const bullets = top
    .map((f) => {
      const loc = f.location?.path ? ` (${f.location.path})` : "";
      return `• [${f.severity}] *${f.component}* — ${f.title}${loc}`;
    })
    .join("\n");

  const ownerChannels = new Set<string>();
  for (const comp of result.components) {
    const ch =
      registry.components[comp]?.owners?.slack_channel ??
      registry._default?.owners?.slack_channel;
    if (ch) ownerChannels.add(ch);
  }

  const text = `DS Governance ${result.verdict} — run ${result.runId}${
    prUrl ? ` — ${prUrl}` : ""
  }`;

  return {
    text,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Design System Governance* — \`${result.verdict}\`\n${bullets || "_No block/warn findings._"}`,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Components: ${result.components.join(", ")} · Notify: ${[...ownerChannels].join(", ") || "default"}`,
          },
        ],
      },
    ],
  };
}

export async function postSlackWebhook(
  webhookUrl: string,
  payload: { text: string; blocks: unknown[] }
): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Slack webhook failed: ${res.status} ${await res.text()}`);
  }
}
