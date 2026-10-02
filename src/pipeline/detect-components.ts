import type { ComponentRegistry } from "../config/types.js";

function pathMatches(glob: string, filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  const pattern = glob.replace(/\\/g, "/");
  const re = new RegExp(
    "^" +
      pattern
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*\*/g, "§§")
        .replace(/\*/g, "[^/]*")
        .replace(/§§/g, ".*") +
      "$"
  );
  return re.test(normalized);
}

export function detectComponentsFromPaths(
  registry: ComponentRegistry,
  changedPaths: string[]
): string[] {
  const matched = new Set<string>();

  for (const [componentId, entry] of Object.entries(registry.components)) {
    const globs =
      entry.source_of_truth?.code?.paths ??
      entry.code?.paths ??
      [];

    for (const filePath of changedPaths) {
      if (globs.some((g) => pathMatches(g, filePath))) {
        matched.add(componentId);
      }
    }
  }

  if (matched.size === 0 && changedPaths.length > 0) {
    for (const filePath of changedPaths) {
      const base = filePath.split("/").pop() ?? "";
      const name = base.replace(/\.(tsx|ts|vue|svelte|css|scss)$/i, "");
      if (registry.components[name]) {
        matched.add(name);
      }
    }
  }

  return [...matched];
}

export function resolveCheckPack(
  registry: ComponentRegistry,
  componentId: string
): string[] {
  const entry = registry.components[componentId];
  const def = registry._default;
  let checks = entry?.checks ?? def?.checks ?? "default_primitive";

  if (typeof checks === "string") {
    const pack = registry.check_packs?.[checks];
    return pack ?? ["tokens", "duplicates"];
  }
  return checks;
}
