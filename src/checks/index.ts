import type { ComponentRegistry, GovernanceFinding, RunContext } from "../config/types.js";
import { runDuplicateCheck } from "./duplicates.js";
import { runFigmaCodeCheck } from "./figma-code.js";
import { runTokenCheck } from "./tokens.js";

export async function runChecksForComponent(
  ctx: RunContext,
  registry: ComponentRegistry,
  componentId: string,
  filePaths: string[],
  checkIds: string[]
): Promise<GovernanceFinding[]> {
  const all: GovernanceFinding[] = [];

  if (checkIds.includes("tokens")) {
    all.push(...(await runTokenCheck(ctx, componentId, filePaths)));
  }
  if (checkIds.includes("duplicates")) {
    all.push(...(await runDuplicateCheck(ctx, componentId, filePaths, registry)));
  }
  if (checkIds.includes("api_stub")) {
    // Placeholder for API/breaking-change diff vs base ref
  }
  if (checkIds.includes("figma_code")) {
    all.push(...(await runFigmaCodeCheck(ctx, componentId, registry)));
  }

  return all;
}
