import { readdir } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";
import { DATA_LAYOUT } from "@pomkuiz/quiz-contract";

const PUBLISH_RULES = Object.freeze({
  allowedExtensions: Object.freeze([
    ".html",
    ".js",
    ".css",
    ".json",
    ".png",
    ".svg",
    ".ico",
    ".woff",
    ".woff2",
    ".ttf",
    ".txt",
    ".webmanifest",
  ]),
  forbiddenSegments: Object.freeze(["backoffice", "workspace", "node_modules", ".git", "mcq", "src"]),
  dataEntries: Object.freeze([
    new RegExp(`^${DATA_LAYOUT.indexFile.replace(".", "\\.")}$`),
    /^quizzes\/[a-z0-9]+(?:-[a-z0-9]+)*\/quiz\.json$/,
    /^quizzes\/[a-z0-9]+(?:-[a-z0-9]+)*\/assets\/[a-z0-9]+(?:-[a-z0-9]+)*\.png$/,
  ]),
});

function findPublishViolations(files: readonly string[]): string[] {
  const dataPrefix = `${DATA_LAYOUT.publicDirectory}/`;
  return files.flatMap((file) => {
    const reasons: string[] = [];
    const segments = file.split("/");
    if (!PUBLISH_RULES.allowedExtensions.includes(extname(file).toLowerCase())) reasons.push("extension non autorisée");
    if (segments.some((segment) => PUBLISH_RULES.forbiddenSegments.includes(segment))) reasons.push("dossier interdit");
    if (segments.some((segment) => segment.startsWith(".") && segment.length > 1)) reasons.push("fichier caché");
    if (
      file.startsWith(dataPrefix) &&
      !PUBLISH_RULES.dataEntries.some((pattern) => pattern.test(file.slice(dataPrefix.length)))
    )
      reasons.push("fichier de données inattendu");
    return reasons.map((reason) => `${file} : ${reason}`);
  });
}

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(directory, join(entry.parentPath, entry.name)).split(sep).join("/"));
}

export { findPublishViolations, listFiles };
