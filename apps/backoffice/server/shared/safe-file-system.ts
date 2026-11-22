import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { WORKSPACE_LAYOUT } from "../config/workspace-layout.ts";
import { AppError } from "./app-error.ts";

function resolveInside(base: string, ...segments: string[]): string {
  const root = resolve(base);
  const target = resolve(root, ...segments);
  const path = relative(root, target);
  if (path.startsWith("..") || isAbsolute(path)) throw new AppError("forbidden", target);
  return target;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function ensureDirectory(path: string): Promise<string> {
  await mkdir(path, { recursive: true });
  return path;
}

async function writeFileAtomic(path: string, data: string | Uint8Array): Promise<void> {
  await ensureDirectory(dirname(path));
  const temporary = `${path}.${randomUUID()}${WORKSPACE_LAYOUT.temporarySuffix}`;
  try {
    await writeFile(temporary, data);
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  return writeFileAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

async function readJsonIfExists(path: string): Promise<unknown> {
  try {
    return await readJson(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export { resolveInside, pathExists, ensureDirectory, writeFileAtomic, writeJsonAtomic, readJsonIfExists };
