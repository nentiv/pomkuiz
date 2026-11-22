import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "../../server/config/app-config.ts";
import { createClaudeClient } from "../../server/features/ocr/claude-client.ts";
import { EXTRACTION_SCHEMA } from "../../server/features/ocr/extraction-schema.ts";
import { AppError } from "../../server/shared/app-error.ts";

const FAKE = String.raw`
const fs = require("node:fs");
const args = process.argv.slice(2);
const scenario = process.env.FAKE_SCENARIO || "success";
if (args[0] === "auth") {
  process.stdout.write(JSON.stringify({ loggedIn: scenario !== "signed-out", authMethod: "claude.ai", subscriptionType: "pro", email: "private@example.com" }));
  process.exit(0);
}
let input = "";
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  fs.writeFileSync(process.env.FAKE_RECORD, JSON.stringify({ args, input, cwd: process.cwd(), apiKey: process.env.ANTHROPIC_API_KEY ?? null, files: fs.readdirSync(process.cwd()) }));
  if (scenario === "hang") return setInterval(() => {}, 1000);
  if (scenario === "signed-out") {
    process.stdout.write(JSON.stringify({ type: "result", subtype: "success", is_error: true, result: "Not logged in · Please run /login" }));
    return process.exit(1);
  }
  process.stdout.write(JSON.stringify({ type: "result", subtype: "success", is_error: false, structured_output: { questions: [] } }));
});
`;

describe("claude client process integration", () => {
  let directory: string;
  let executable: string;
  let record: string;

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), "pomkuiz-fake-claude-"));
    executable = join(directory, "claude");
    record = join(directory, "record.json");
    await writeFile(executable, `#!${process.execPath}\n${FAKE}`);
    await chmod(executable, 0o755);
  });

  afterAll(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  const client = (scenario: string, timeoutMs?: number) => {
    const config = loadConfig({});
    return createClaudeClient({
      config: timeoutMs ? { ...config.ocr, timeoutMs } : config.ocr,
      executable,
      environment: { ...process.env, FAKE_SCENARIO: scenario, FAKE_RECORD: record, ANTHROPIC_API_KEY: "sk-secret" },
    });
  };

  it("sends the prompt on stdin from the isolated workspace without API key", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "pomkuiz-ws-"));
    await writeFile(join(workspace, "segment.png"), "png");
    try {
      const output = await client("success").requestStructured({
        prompt: "Bonjour",
        schema: EXTRACTION_SCHEMA,
        workspace,
      });
      expect(output).toEqual({ questions: [] });
      const seen = JSON.parse(await readFile(record, "utf8"));
      expect(seen.input).toBe("Bonjour");
      expect(seen.apiKey).toBeNull();
      expect(seen.files).toEqual(["segment.png"]);
      expect(seen.args).toContain("--json-schema");
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it("reports status without leaking account details", async () => {
    const status = await client("success").status();
    expect(status).toEqual({ executable, loggedIn: true, authMethod: "claude.ai", subscription: "pro" });
  });

  it("classifies a signed out session", async () => {
    await expect(
      client("signed-out").requestStructured({ prompt: "x", schema: {}, workspace: directory }),
    ).rejects.toMatchObject({
      code: "claudeSignedOut",
    });
  });

  it("kills a hanging process on timeout", async () => {
    const started = Date.now();
    const failure = await client("hang", 300)
      .requestStructured({ prompt: "x", schema: {}, workspace: directory })
      .catch((error: AppError) => error);
    expect(failure).toBeInstanceOf(AppError);
    expect((failure as AppError).code).toBe("claudeTimeout");
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it("reports a missing executable", async () => {
    const config = loadConfig({});
    const missing = createClaudeClient({ config: config.ocr, executable: join(directory, "absent") });
    await expect(missing.requestStructured({ prompt: "x", schema: {}, workspace: directory })).rejects.toMatchObject({
      code: "claudeMissing",
    });
    expect((await missing.status()).executable).toBeNull();
  });
});
