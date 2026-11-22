import { accessSync, constants, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";
import { CLAUDE_CLI } from "../../config/ocr-settings.ts";

function isExecutable(path: string | null | undefined): path is string {
  if (!path) return false;
  try {
    accessSync(path, constants.X_OK);
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function versionNumbers(value: string): number[] {
  return value
    .replace(CLAUDE_CLI.versionPrefix, "")
    .split(CLAUDE_CLI.versionSeparator)
    .map((part) => Number.parseInt(part, 10) || 0);
}

function compareVersionsDescending(first: string, second: string): number {
  const [a, b] = [versionNumbers(first), versionNumbers(second)];
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (b[index] ?? 0) - (a[index] ?? 0);
    if (difference) return difference;
  }
  return 0;
}

function listDirectories(directory: string): string[] {
  try {
    return readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

function findInPath(command: string, pathValue = ""): string | null {
  for (const directory of pathValue.split(delimiter)) {
    if (!directory) continue;
    const candidate = join(directory, command);
    if (isExecutable(candidate)) return candidate;
  }
  return null;
}

function listCandidatePaths(home: string): string[] {
  const { candidates } = CLAUDE_CLI;
  const nvmRoot = join(home, candidates.nvmVersionsDirectory);
  const nvm = listDirectories(nvmRoot)
    .toSorted(compareVersionsDescending)
    .map((version) => join(nvmRoot, version, candidates.nvmBinDirectory, CLAUDE_CLI.command));
  const editors = candidates.editorExtensionDirectories.flatMap((relative) => {
    const root = join(home, relative);
    return listDirectories(root)
      .filter((name) => name.startsWith(candidates.editorExtensionPrefix))
      .toSorted((first, second) =>
        compareVersionsDescending(
          first.slice(candidates.editorExtensionPrefix.length),
          second.slice(candidates.editorExtensionPrefix.length),
        ),
      )
      .map((name) => join(root, name, ...candidates.editorBinaryPath));
  });
  return [...candidates.home.map((path) => join(home, path)), ...nvm, ...candidates.system, ...editors];
}

function findClaudeExecutable({
  override = null,
  env = process.env,
  home = homedir(),
}: { override?: string | null; env?: NodeJS.ProcessEnv; home?: string } = {}): string | null {
  if (override) return isExecutable(override) ? override : null;
  return (
    findInPath(CLAUDE_CLI.command, env.PATH) ??
    listCandidatePaths(home).find((candidate) => isExecutable(candidate)) ??
    null
  );
}

export { isExecutable, findClaudeExecutable };
