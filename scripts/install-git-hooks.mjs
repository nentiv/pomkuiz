import { existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT, run, runScript } from "./run-command.mjs";

const HOOKS_DIRECTORY = ".githooks";

runScript(() => {
  if (existsSync(join(ROOT, ".git"))) run("git", ["config", "core.hooksPath", HOOKS_DIRECTORY]);
});
