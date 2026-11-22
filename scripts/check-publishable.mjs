import { spawnSync } from "node:child_process";

const RULES = Object.freeze({
  allowedRoots: Object.freeze([
    ".githooks/",
    ".gitignore",
    ".oxlintrc.json",
    ".prettierignore",
    ".prettierrc.json",
    "LICENSE",
    "README.md",
    "package.json",
    "package-lock.json",
    "tsconfig.base.json",
    "tsconfig.browser.json",
    "tsconfig.json",
    "vitest.config.ts",
    "apps/",
    "packages/",
    "data/",
    "scripts/",
    "tests/",
  ]),
  forbiddenSegments: Object.freeze(["workspace", "node_modules", "dist", "coverage", "mcq"]),
  forbiddenExtensions: Object.freeze([".pdf", ".env", ".log", ".pem", ".key"]),
  dataEntries: Object.freeze([
    /^data\/index\.json$/,
    /^data\/quizzes\/[a-z0-9]+(?:-[a-z0-9]+)*\/quiz\.json$/,
    /^data\/quizzes\/[a-z0-9]+(?:-[a-z0-9]+)*\/assets\/[a-z0-9]+(?:-[a-z0-9]+)*\.png$/,
  ]),
});

const listing = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
  encoding: "utf8",
  shell: false,
});
if (listing.status !== 0) {
  process.stderr.write(listing.stderr || "git ls-files a échoué\n");
  process.exit(1);
}

const files = listing.stdout.split("\n").filter(Boolean);
const violations = files.flatMap((file) => {
  const lower = file.toLowerCase();
  const reasons = [];
  if (!RULES.allowedRoots.some((root) => file === root || (root.endsWith("/") && file.startsWith(root))))
    reasons.push("hors des dossiers publiables");
  if (file.split("/").some((segment) => RULES.forbiddenSegments.includes(segment))) reasons.push("dossier privé");
  if (RULES.forbiddenExtensions.some((extension) => lower.endsWith(extension)))
    reasons.push("type de fichier interdit");
  if (file.startsWith("data/") && !RULES.dataEntries.some((pattern) => pattern.test(file)))
    reasons.push("fichier de données inattendu");
  return reasons.map((reason) => `${file} : ${reason}`);
});

if (violations.length > 0) {
  process.stderr.write(`Ne pas pousser, fichiers non publiables :\n${violations.join("\n")}\n`);
  process.exit(1);
}
process.stdout.write(`OK : ${files.length} fichiers publiables, ni brouillon ni PDF.\n`);
