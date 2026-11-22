import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");
const SOURCE_DIRECTORIES = ["apps", "packages", "scripts"];
const SKIPPED_DIRECTORIES = new Set(["node_modules", "dist", "workspace", "coverage", "tests"]);
const SOURCE_FILES = /\.(ts|tsx|mjs|css|html)$/;
const SERVER_DIRECTORY = "apps/backoffice/server/";
const SERVER_CONFIG_DIRECTORY = `${SERVER_DIRECTORY}config/`;
const KATEX_OPTIONS_FILE = "packages/quiz-contract/src/katex-options.ts";

interface SourceFile {
  path: string;
  source: string;
}

async function collect(directory: string): Promise<SourceFile[]> {
  const files: SourceFile[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory() && !SKIPPED_DIRECTORIES.has(entry.name)) files.push(...(await collect(path)));
    else if (entry.isFile() && SOURCE_FILES.test(entry.name))
      files.push({ path: relative(ROOT, path), source: await readFile(path, "utf8") });
  }
  return files;
}

const sources = (await Promise.all(SOURCE_DIRECTORIES.map((directory) => collect(join(ROOT, directory))))).flat();

const offending = (files: SourceFile[], pattern: RegExp) =>
  files.filter(({ source }) => pattern.test(source)).map(({ path }) => path);

describe("source rules", () => {
  it("scans every workspace", () => {
    expect(sources.some(({ path }) => path.startsWith("apps/site/"))).toBe(true);
    expect(sources.some(({ path }) => path.startsWith("apps/backoffice/"))).toBe(true);
    expect(sources.some(({ path }) => path.startsWith("packages/design-system/"))).toBe(true);
  });

  it("never injects raw HTML", () => {
    expect(
      offending(sources, /\.(innerHTML|outerHTML)\b|insertAdjacentHTML|dangerouslySetInnerHTML|document\.write/),
    ).toEqual([]);
    const browserSources = sources.filter(({ path }) => !path.startsWith(SERVER_DIRECTORY));
    expect(offending(browserSources, /renderToString/)).toEqual([]);
  });

  it("never evaluates strings as code", () => {
    expect(offending(sources, /\beval\s*\(|new\s+Function\s*\(/)).toEqual([]);
  });

  it("keeps KaTeX untrusted", () => {
    expect(offending(sources, /trust\s*:\s*true/)).toEqual([]);
    expect(sources.find(({ path }) => path === KATEX_OPTIONS_FILE)?.source).toMatch(/trust:\s*false/);
  });

  it("loads nothing from third-party origins", () => {
    expect(offending(sources, /(?:src|href)=["']https?:\/\/|fetch\(\s*["'`]https?:\/\//)).toEqual([]);
  });

  it("never runs processes through a shell", () => {
    expect(
      offending(sources, /shell:\s*true|(?<!\.)\bexecSync\s*\(|(?<!\.)\bexec\s*\(|(?<!\.)\bexecFile(Sync)?\s*\(/),
    ).toEqual([]);
    expect(offending(sources, /import\s*\{[^}]*\b(exec|execSync)\b[^}]*\}\s*from\s*"node:child_process"/)).toEqual([]);
  });

  it("never bypasses Claude permissions", () => {
    expect(offending(sources, /dangerously-skip-permissions|bypassPermissions/)).toEqual([]);
  });

  it("only listens on a host defined in the backoffice config", () => {
    const files = sources.filter(({ path }) => !path.startsWith(SERVER_CONFIG_DIRECTORY));
    expect(offending(files, /["'](0\.0\.0\.0|::)["']/)).toEqual([]);
    expect(offending(files, /listen\(\{[^}]*host:\s*["']/)).toEqual([]);
  });
});
