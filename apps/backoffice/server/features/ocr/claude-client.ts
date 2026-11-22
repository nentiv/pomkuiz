import { tmpdir } from "node:os";
import type { AppConfig } from "../../config/app-config.ts";
import { MISSING_EXECUTABLE_ERRORS } from "../../config/ocr-settings.ts";
import { AppError } from "../../shared/app-error.ts";
import { runProcess, type ProcessOutcome, type ProcessRunner } from "../../shared/process-runner.ts";
import { findClaudeExecutable, isExecutable } from "./find-claude-executable.ts";

type OcrConfig = AppConfig["ocr"];

interface ClaudeEnvelope {
  type?: unknown;
  subtype?: unknown;
  is_error?: unknown;
  result?: unknown;
  structured_output?: unknown;
  api_error_status?: unknown;
}

interface ClaudeStatus {
  executable: string | null;
  loggedIn: boolean;
  authMethod: string | null;
  subscription: string | null;
}

interface StructuredRequest {
  prompt: string;
  schema: object;
  workspace: string;
  signal?: AbortSignal;
}

interface ClaudeClient {
  status(): Promise<ClaudeStatus>;
  requestStructured(request: StructuredRequest): Promise<unknown>;
}

function subscriptionEnvironment(environment: NodeJS.ProcessEnv, stripped: readonly string[]): NodeJS.ProcessEnv {
  const copy = { ...environment };
  for (const name of stripped) delete copy[name];
  return copy;
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function parseEnvelope(stdout: string, resultType: string): ClaudeEnvelope | null {
  const whole = parseJsonObject(stdout.trim());
  if (whole?.type === resultType) return whole;
  const lines = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines.toReversed()) {
    const event = parseJsonObject(line);
    if (event?.type === resultType) return event;
  }
  return null;
}

function matchesAny(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function classifyFailure(details: string, config: OcrConfig): AppError {
  const { errorPatterns } = config.cli;
  if (matchesAny(details, errorPatterns.signedOut)) return new AppError("claudeSignedOut", details);
  if (matchesAny(details, errorPatterns.rateLimited)) return new AppError("claudeRateLimited", details);
  return new AppError("claudeFailed", details);
}

function readStructuredOutput(envelope: ClaudeEnvelope, config: OcrConfig): unknown {
  if (envelope.is_error === true || envelope.subtype !== config.cli.successSubtype) {
    const details = [envelope.subtype, envelope.api_error_status, envelope.result]
      .filter((part) => part !== undefined && part !== null)
      .map(String)
      .join(" ");
    throw classifyFailure(details, config);
  }
  if (envelope.structured_output !== undefined && envelope.structured_output !== null)
    return envelope.structured_output;
  if (typeof envelope.result === "string") {
    const parsed = parseJsonObject(envelope.result);
    if (parsed) return parsed;
  }
  throw new AppError("claudeInvalidOutput", "missing structured output");
}

function interpretOutcome(outcome: ProcessOutcome, config: OcrConfig): unknown {
  if (outcome.spawnError) {
    const missing = MISSING_EXECUTABLE_ERRORS.includes(outcome.spawnError.code ?? "");
    throw new AppError(missing ? "claudeMissing" : "claudeFailed", outcome.spawnError.message);
  }
  if (outcome.cancelled) throw new AppError("cancelled");
  if (outcome.timedOut) throw new AppError("claudeTimeout");
  if (outcome.outputOverflow) throw new AppError("claudeInvalidOutput", "output too large");
  const envelope = parseEnvelope(outcome.stdout, config.cli.resultType);
  if (envelope) return readStructuredOutput(envelope, config);
  const diagnostics = `${outcome.stderr}\n${outcome.stdout}`.slice(0, config.diagnosticCharacters);
  if (outcome.code !== 0) throw classifyFailure(diagnostics, config);
  throw new AppError("claudeInvalidOutput", diagnostics);
}

function buildPrintArguments(config: OcrConfig, schema: object): string[] {
  return [
    ...config.cli.printArgs,
    config.cli.modelArg,
    config.model,
    config.cli.effortArg,
    config.effort,
    config.cli.schemaArg,
    JSON.stringify(schema),
  ];
}

interface ClientOptions {
  config: OcrConfig;
  run?: ProcessRunner;
  environment?: NodeJS.ProcessEnv;
  executable?: string | null;
}

function createClaudeClient({
  config,
  run = runProcess,
  environment = process.env,
  executable = findClaudeExecutable({ override: config.executableOverride, env: environment }),
}: ClientOptions): ClaudeClient {
  const env = subscriptionEnvironment(environment, config.cli.strippedEnvironment);
  const baseRequest = {
    env,
    killGraceMs: config.killGraceMs,
    maxOutputBytes: config.maxOutputBytes,
    maxDiagnosticCharacters: config.diagnosticCharacters,
  };

  const requireExecutable = (): string => {
    if (!isExecutable(executable)) throw new AppError("claudeMissing");
    return executable;
  };

  return {
    async status() {
      if (!isExecutable(executable)) return { executable: null, loggedIn: false, authMethod: null, subscription: null };
      const outcome = await run({
        ...baseRequest,
        command: executable,
        args: config.cli.authStatusArgs,
        cwd: tmpdir(),
        timeoutMs: config.statusTimeoutMs,
      });
      const report = parseJsonObject(outcome.stdout) ?? {};
      return {
        executable,
        loggedIn: report.loggedIn === true,
        authMethod: typeof report.authMethod === "string" ? report.authMethod : null,
        subscription: typeof report.subscriptionType === "string" ? report.subscriptionType : null,
      };
    },
    async requestStructured({ prompt, schema, workspace, signal }) {
      const outcome = await run({
        ...baseRequest,
        command: requireExecutable(),
        args: buildPrintArguments(config, schema),
        input: prompt,
        cwd: workspace,
        timeoutMs: config.timeoutMs,
        signal,
      });
      return interpretOutcome(outcome, config);
    },
  };
}

export {
  subscriptionEnvironment,
  parseEnvelope,
  classifyFailure,
  interpretOutcome,
  buildPrintArguments,
  createClaudeClient,
};
export type { StructuredRequest, ClaudeClient };
