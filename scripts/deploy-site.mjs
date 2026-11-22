import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkProject } from "./check-project.mjs";
import { ROOT, run, runNpm, runScript } from "./run-command.mjs";

const SETTINGS = Object.freeze({
  branch: "gh-pages",
  remote: "origin",
  siteWorkspace: "@pomkuiz/site",
  distDirectory: "apps/site/dist",
  entryFile: "index.html",
  noJekyllFile: ".nojekyll",
  workPrefix: "pomkuiz-publish-",
  dryRunFlag: "--dry-run",
  commitMessage: (date) => `chore: deploy site ${date}`,
});

const DRY_RUN = process.argv.includes(SETTINGS.dryRunFlag);

function listFiles(directory) {
  return readdirSync(directory, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile());
}

function publish() {
  const remoteUrl = run("git", ["remote", "get-url", SETTINGS.remote], { capture: true });
  const userName = run("git", ["config", "user.name"], { capture: true });
  const userEmail = run("git", ["config", "user.email"], { capture: true });
  if (!userName || !userEmail) throw new Error("git user.name et user.email doivent être définis.");

  checkProject();
  runNpm(["--workspace", SETTINGS.siteWorkspace, "run", "build"]);

  const dist = join(ROOT, SETTINGS.distDirectory);
  if (!existsSync(join(dist, SETTINGS.entryFile)))
    throw new Error(`${SETTINGS.distDirectory}/${SETTINGS.entryFile} introuvable après le build.`);

  const work = mkdtempSync(join(tmpdir(), SETTINGS.workPrefix));
  try {
    cpSync(dist, work, { recursive: true });
    writeFileSync(join(work, SETTINGS.noJekyllFile), "");
    const git = (...args) =>
      run(
        "git",
        ["-c", `user.name=${userName}`, "-c", `user.email=${userEmail}`, "-c", "commit.gpgsign=false", ...args],
        { cwd: work },
      );
    git("init", "--quiet", "-b", SETTINGS.branch);
    git("add", "--all");
    git("commit", "--quiet", "-m", SETTINGS.commitMessage(new Date().toISOString().slice(0, 10)));
    const count = listFiles(work).filter((entry) => !entry.parentPath.includes(`${join(work, ".git")}`)).length;
    if (DRY_RUN) {
      process.stdout.write(
        `Simulation : ${count} fichiers prêts pour la branche ${SETTINGS.branch}, rien n'a été envoyé.\n`,
      );
      return;
    }
    git("push", "--force", remoteUrl, `${SETTINGS.branch}:${SETTINGS.branch}`);
    process.stdout.write(`Site publié sur la branche ${SETTINGS.branch} (${count} fichiers).\n`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

runScript(publish);
