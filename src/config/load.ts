import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  ComponentRegistrySchema,
  GovernanceProfileSchema,
  type ComponentRegistry,
  type GovernanceProfile,
} from "./types.js";

export async function loadProfile(path: string): Promise<GovernanceProfile> {
  const raw = parseYaml(await readFile(resolve(path), "utf8"));
  return GovernanceProfileSchema.parse(raw);
}

export async function loadRegistry(path: string): Promise<ComponentRegistry> {
  const raw = parseYaml(await readFile(resolve(path), "utf8"));
  return ComponentRegistrySchema.parse(raw);
}
