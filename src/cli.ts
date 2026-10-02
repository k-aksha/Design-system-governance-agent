#!/usr/bin/env node
import { resolve } from "node:path";
import { Command } from "commander";
import { loadProfile, loadRegistry } from "./config/load.js";
import { runPipeline } from "./pipeline/run.js";
import { formatConsoleReport } from "./reporters/console.js";
import { publishFigmaComments } from "./reporters/figma.js";
import { writeGithubOutputs } from "./reporters/github.js";
import { buildSlackPayload, postSlackWebhook } from "./reporters/slack.js";

const program = new Command();

program
  .name("ds-gov")
  .description("Design system governance — tokens, drift, Figma/code parity")
  .version("0.1.0");

program
  .command("run")
  .description("Run governance checks (engineer PR path or local folder)")
  .requiredOption("-p, --profile <path>", "governance-profile.yaml")
  .requiredOption("-r, --registry <path>", "component-registry.yaml")
  .option("--base <ref>", "base git ref or label", "main")
  .option("--head <path>", "head path relative to workspace (PR files)", ".")
  .option("--workspace <dir>", "repository root", process.cwd())
  .option("--waivers <path>", "waivers yaml")
  .option("--pr-url <url>", "PR URL for comments")
  .option("--component <ids...>", "limit to component ids")
  .option("--format <type>", "console | json", "console")
  .option("--github-output <path>", "write annotations JSON")
  .option("--pr-comment <path>", "write PR markdown comment")
  .option("--slack", "post to Slack if enabled in profile")
  .option("--figma-comments", "post Figma comments if enabled in profile")
  .option("--figma-file-key <key>", "override Figma file key")
  .action(async (opts) => {
    const workspaceRoot = resolve(opts.workspace);
    const profile = await loadProfile(resolve(opts.profile));
    const registry = await loadRegistry(resolve(opts.registry));

    const headDir = opts.head === "." ? undefined : opts.head;

    const result = await runPipeline({
      profile,
      registry,
      workspaceRoot,
      baseRef: opts.base,
      headRef: opts.head,
      headDir,
      prUrl: opts.prUrl,
      waiversPath: opts.waivers ? resolve(opts.waivers) : undefined,
      figmaFileKey: opts.figmaFileKey,
      componentFilter: opts.component,
    });

    if (opts.format === "json") {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatConsoleReport(result));
    }

    if (opts.githubOutput) {
      await writeGithubOutputs(
        result,
        resolve(opts.githubOutput),
        resolve(opts.prComment ?? "pr-comment.md"),
        opts.prUrl
      );
    }

    if (opts.slack && profile.flagging?.slack?.enabled) {
      const envName = profile.flagging.slack.webhook_env ?? "SLACK_WEBHOOK_URL";
      const url = process.env[envName];
      if (!url) throw new Error(`Missing ${envName}`);
      await postSlackWebhook(url, buildSlackPayload(result, registry, opts.prUrl));
    }

    if (opts.figmaComments && profile.flagging?.figma_comments?.enabled) {
      const ids = await publishFigmaComments(result, profile, opts.prUrl);
      console.error(`Posted ${ids.length} Figma comment(s).`);
    }

    if (result.verdict === "fail") process.exit(1);
  });

program
  .command("designer")
  .description("Designer path — run checks for a Figma-linked component (no PR required)")
  .requiredOption("-p, --profile <path>", "governance-profile.yaml")
  .requiredOption("-r, --registry <path>", "component-registry.yaml")
  .requiredOption("-c, --component <id>", "component id from registry")
  .option("--figma-file-key <key>", "Figma file key")
  .option("--figma-branch-key <key>", "Figma branch key (optional)")
  .option("--workspace <dir>", "repo root for snapshots", process.cwd())
  .option("--figma-comments", "post comments for discrepancies")
  .option("--slack", "notify Slack")
  .action(async (opts) => {
    const workspaceRoot = resolve(opts.workspace);
    const profile = await loadProfile(resolve(opts.profile));
    const registry = await loadRegistry(resolve(opts.registry));

    if (opts.figmaFileKey) {
      profile.defaults = profile.defaults ?? {};
      profile.defaults.source_of_truth = profile.defaults.source_of_truth ?? {
        mode: "dual_compare",
        on_conflict: "flag_owner",
      };
      profile.defaults.source_of_truth.figma = { enabled: true };
    }

    const result = await runPipeline({
      profile,
      registry,
      workspaceRoot,
      baseRef: "main",
      headRef: "figma",
      figmaFileKey: opts.figmaFileKey ?? opts.figmaBranchKey,
      componentFilter: [opts.component],
    });

    console.log(formatConsoleReport(result));

    if (opts.figmaComments) {
      profile.flagging = profile.flagging ?? {};
      profile.flagging.figma_comments = {
        enabled: true,
        token_env: profile.flagging.figma_comments?.token_env ?? "FIGMA_ACCESS_TOKEN",
        on_severity: profile.flagging.figma_comments?.on_severity ?? ["block", "warn"],
        on_categories: profile.flagging.figma_comments?.on_categories,
        threading: profile.flagging.figma_comments?.threading,
        target: profile.flagging.figma_comments?.target,
      };
      const ids = await publishFigmaComments(result, profile);
      console.error(`Posted ${ids.length} Figma comment(s).`);
    }

    if (opts.slack && profile.flagging?.slack?.enabled) {
      const envName = profile.flagging.slack.webhook_env ?? "SLACK_WEBHOOK_URL";
      const url = process.env[envName];
      if (url) await postSlackWebhook(url, buildSlackPayload(result, registry));
    }

    if (result.verdict === "fail") process.exit(1);
  });

program.parse();
