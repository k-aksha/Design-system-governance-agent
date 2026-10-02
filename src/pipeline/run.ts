import { randomUUID } from "node:crypto";
import type { ComponentRegistry, GovernanceProfile, RunResult } from "../config/types.js";
import { runChecksForComponent } from "../checks/index.js";
import { detectComponentsFromPaths, resolveCheckPack } from "./detect-components.js";
import { applyWaivers } from "./waivers.js";
import { listChangedPaths } from "../utils/git-diff.js";

function computeVerdict(
  findings: { severity: string }[],
  failOn: string[]
): RunResult["verdict"] {
  if (findings.some((f) => failOn.includes(f.severity))) return "fail";
  if (findings.some((f) => f.severity === "warn")) return "warn";
  return "pass";
}

export async function runPipeline(options: {
  profile: GovernanceProfile;
  registry: ComponentRegistry;
  workspaceRoot: string;
  baseRef: string;
  headRef: string;
  headDir?: string;
  prUrl?: string;
  waiversPath?: string;
  figmaFileKey?: string;
  componentFilter?: string[];
}): Promise<RunResult> {
  const runId = randomUUID().slice(0, 8);
  const changedPaths = await listChangedPaths(options.workspaceRoot, options.headDir);

  let components = detectComponentsFromPaths(options.registry, changedPaths);
  if (options.componentFilter?.length) {
    components = components.filter((c) => options.componentFilter!.includes(c));
  }
  if (components.length === 0 && changedPaths.length > 0) {
    components = ["_unscoped"];
  }

  const ctx = {
    profile: options.profile,
    registry: options.registry,
    workspaceRoot: options.workspaceRoot,
    baseRef: options.baseRef,
    headRef: options.headRef,
    headDir: options.headDir,
    prUrl: options.prUrl,
    runId,
    figmaFileKey: options.figmaFileKey,
    waiversPath: options.waiversPath,
  };

  const findings: RunResult["findings"] = [];

  for (const componentId of components) {
    const checkIds =
      componentId === "_unscoped"
        ? ["tokens"]
        : resolveCheckPack(options.registry, componentId);

    const pathsForComponent =
      componentId === "_unscoped"
        ? changedPaths
        : changedPaths.filter((p) => {
            const entry = options.registry.components[componentId];
            const globs =
              entry?.source_of_truth?.code?.paths ?? entry?.code?.paths ?? [];
            if (!globs.length) return true;
            return globs.some((g) => {
              const re = new RegExp(
                "^" +
                  g
                    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
                    .replace(/\*\*/g, ".*")
                    .replace(/\*/g, "[^/]*") +
                  "$"
              );
              return re.test(p);
            });
          });

    const componentFindings = await runChecksForComponent(
      ctx,
      options.registry,
      componentId === "_unscoped" ? "Unknown" : componentId,
      pathsForComponent,
      checkIds
    );
    findings.push(...componentFindings);
  }

  const waived = await applyWaivers(findings, options.waiversPath);
  const failOn = options.profile.flagging?.github?.fail_on ?? ["block"];

  return {
    runId,
    components: components.map((c) => (c === "_unscoped" ? "Unknown" : c)),
    findings: waived,
    verdict: computeVerdict(waived, failOn),
    comparedAgainst: {
      code: options.baseRef,
      figma: options.figmaFileKey,
    },
  };
}
