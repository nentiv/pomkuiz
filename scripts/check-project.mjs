import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, run, runNpm, runScript } from "./run-command.mjs";

const binary = (name) => join(ROOT, "node_modules", ".bin", name);

const STEPS = Object.freeze([
  ["Lint", () => run(binary("oxlint"), ["--deny-warnings"])],
  ["Format", () => run(binary("prettier"), ["--check", "."])],
  ["Types", () => run(binary("tsc"), ["--noEmit", "-p", "tsconfig.json"])],
  ["Types des workspaces", () => runNpm(["run", "typecheck", "--workspaces", "--if-present"])],
  ["Tests", () => run(binary("vitest"), ["run"])],
  ["Fichiers publiables", () => run(process.execPath, [join(ROOT, "scripts", "check-publishable.mjs")])],
]);

function checkProject() {
  for (const [label, step] of STEPS) {
    process.stdout.write(`\n▸ ${label}\n`);
    step();
  }
  process.stdout.write("\n✓ Toutes les vérifications sont passées.\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) runScript(checkProject);

export { checkProject };
