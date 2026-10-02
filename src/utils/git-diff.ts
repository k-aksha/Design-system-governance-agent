import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const CODE_EXT = /\.(tsx|ts|jsx|js|css|scss|vue|svelte)$/i;

async function listFilesRecursive(dir: string, root: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".git") continue;
      files.push(...(await listFilesRecursive(full, root)));
    } else if (e.isFile() && CODE_EXT.test(e.name)) {
      files.push(relative(root, full).replace(/\\/g, "/"));
    }
  }
  return files;
}

export async function listChangedPaths(
  workspaceRoot: string,
  headDir?: string
): Promise<string[]> {
  if (headDir) {
    const abs = join(workspaceRoot, headDir);
    const st = await stat(abs);
    if (st.isDirectory()) {
      return listFilesRecursive(abs, abs);
    }
    return [headDir];
  }
  return listFilesRecursive(workspaceRoot, workspaceRoot);
}

export async function readFileLines(
  workspaceRoot: string,
  headDir: string | undefined,
  filePath: string
): Promise<string[]> {
  const base = headDir ? join(workspaceRoot, headDir) : workspaceRoot;
  const content = await readFile(join(base, filePath), "utf8");
  return content.split(/\r?\n/);
}
