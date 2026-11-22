import { describe, expect, it } from "vitest";
import { loadConfig } from "../../server/config/app-config.ts";
import {
  buildPrintArguments,
  classifyFailure,
  interpretOutcome,
  parseEnvelope,
  subscriptionEnvironment,
} from "../../server/features/ocr/claude-client.ts";
import { EXTRACTION_SCHEMA } from "../../server/features/ocr/extraction-schema.ts";
import type { AppError } from "../../server/shared/app-error.ts";
import type { ProcessOutcome } from "../../server/shared/process-runner.ts";

const config = loadConfig({}).ocr;

const outcome = (fields: Partial<ProcessOutcome>): ProcessOutcome => ({
  code: 0,
  stdout: "",
  stderr: "",
  spawnError: null,
  timedOut: false,
  cancelled: false,
  outputOverflow: false,
  ...fields,
});

const failed = (result: string) =>
  outcome({ stdout: JSON.stringify({ type: "result", subtype: "error_during_execution", is_error: true, result }) });

const success = (fields: Record<string, unknown>) =>
  JSON.stringify({ type: "result", subtype: "success", is_error: false, ...fields });

function codeOf(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    return (error as AppError).code;
  }
  return "none";
}

describe("claude -p output parsing", () => {
  it("reads structured_output from the json envelope", () => {
    const stdout = success({ structured_output: { questions: [] }, result: "ignored" });
    expect(interpretOutcome(outcome({ stdout }), config)).toEqual({ questions: [] });
  });

  it("falls back to a JSON result text", () => {
    const stdout = success({ result: '{"questions":[]}' });
    expect(interpretOutcome(outcome({ stdout }), config)).toEqual({ questions: [] });
  });

  it("finds the result event in stream output", () => {
    const stdout = [
      JSON.stringify({ type: "system", subtype: "init" }),
      "not json",
      success({ structured_output: { questions: [1] } }),
    ].join("\n");
    expect(parseEnvelope(stdout, "result")?.structured_output).toEqual({ questions: [1] });
  });

  it("rejects outputs without usable JSON", () => {
    expect(codeOf(() => interpretOutcome(outcome({ stdout: success({ result: "Voici le JSON" }) }), config))).toBe(
      "claudeInvalidOutput",
    );
    expect(codeOf(() => interpretOutcome(outcome({ stdout: "garbage" }), config))).toBe("claudeInvalidOutput");
  });

  it("classifies failures", () => {
    expect(codeOf(() => interpretOutcome(failed("Not logged in · Please run /login"), config))).toBe("claudeSignedOut");
    expect(codeOf(() => interpretOutcome(failed("Claude usage limit reached"), config))).toBe("claudeRateLimited");
    expect(codeOf(() => interpretOutcome(failed("boom"), config))).toBe("claudeFailed");
    expect(codeOf(() => interpretOutcome(outcome({ code: 1, stderr: "API Error: 429" }), config))).toBe(
      "claudeRateLimited",
    );
    expect(classifyFailure("socket hang up", config).code).toBe("claudeFailed");
  });

  it("maps process level failures", () => {
    const missing = Object.assign(new Error("spawn claude ENOENT"), { code: "ENOENT" });
    expect(codeOf(() => interpretOutcome(outcome({ spawnError: missing }), config))).toBe("claudeMissing");
    expect(codeOf(() => interpretOutcome(outcome({ timedOut: true }), config))).toBe("claudeTimeout");
    expect(codeOf(() => interpretOutcome(outcome({ cancelled: true }), config))).toBe("cancelled");
    expect(codeOf(() => interpretOutcome(outcome({ outputOverflow: true }), config))).toBe("claudeInvalidOutput");
  });

  it("never treats model content as an error signal", () => {
    const stdout = success({ structured_output: { questions: [], note: "usage limit 429" } });
    expect(interpretOutcome(outcome({ stdout }), config)).toEqual({ questions: [], note: "usage limit 429" });
  });
});

describe("claude -p invocation", () => {
  it("restricts tools, uses the configured model and passes the schema", () => {
    const args = buildPrintArguments(config, EXTRACTION_SCHEMA);
    expect(args.slice(0, 1)).toEqual(["-p"]);
    expect(args).toContain("--restricted");
    expect(args[args.indexOf("--tools") + 1]).toBe("Read");
    expect(args[args.indexOf("--allowedTools") + 1]).toBe("Read");
    expect(args[args.indexOf("--model") + 1]).toBe("opus");
    expect(args[args.indexOf("--effort") + 1]).toBe("medium");
    expect(JSON.parse(args[args.indexOf("--json-schema") + 1] ?? "")).toEqual(EXTRACTION_SCHEMA);
    expect(args).not.toContain("--dangerously-skip-permissions");
  });

  it("strips API credentials so the subscription is used", () => {
    const env = subscriptionEnvironment(
      { PATH: "/bin", ANTHROPIC_API_KEY: "secret", ANTHROPIC_BASE_URL: "http://x", HOME: "/h" },
      config.cli.strippedEnvironment,
    );
    expect(env).toEqual({ PATH: "/bin", HOME: "/h" });
  });
});
