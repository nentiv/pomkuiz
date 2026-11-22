import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

function run(command, args, { cwd = ROOT, capture = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    shell: false,
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} a échoué (code ${result.status})`);
  return capture ? result.stdout.trim() : "";
}

function runNpm(args) {
  const npmScript = process.env.npm_execpath;
  if (npmScript) run(process.execPath, [npmScript, ...args]);
  else run("npm", args);
}

function runScript(main) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`\n${error.message}\n`);
    process.exit(1);
  }
}

export { ROOT, run, runNpm, runScript };
