import { MEBIBYTE, MINUTE_MS, SECOND_MS } from "./measurement-units.ts";

const OCR_EFFORTS = Object.freeze(["low", "medium", "high", "xhigh", "max"]);

const OCR_DEFAULTS = Object.freeze({
  model: "opus",
  effort: "medium",
  maxAttempts: 3,
  concurrency: 3,
  maxConcurrency: 8,
  maxAttemptsCeiling: 6,
  timeoutMs: 8 * MINUTE_MS,
  statusTimeoutMs: 20 * SECOND_MS,
  killGraceMs: 2 * SECOND_MS,
  maxOutputBytes: 4 * MEBIBYTE,
  diagnosticCharacters: 4000,
  textLayerMaxCharacters: 16000,
  imageFileName: "segment.png",
  workspacePrefix: "pomkuiz-ocr-",
});

const CLAUDE_CLI = Object.freeze({
  command: "claude",
  printArgs: Object.freeze([
    "-p",
    "--output-format",
    "json",
    "--no-session-persistence",
    "--safe-mode",
    "--restricted",
    "--strict-mcp-config",
    "--disable-slash-commands",
    "--permission-mode",
    "dontAsk",
    "--tools",
    "Read",
    "--allowedTools",
    "Read",
  ]),
  modelArg: "--model",
  effortArg: "--effort",
  schemaArg: "--json-schema",
  authStatusArgs: Object.freeze(["auth", "status"]),
  resultType: "result",
  successSubtype: "success",
  strippedEnvironment: Object.freeze([
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_AUTH_TOKEN",
    "ANTHROPIC_BASE_URL",
    "ANTHROPIC_MODEL",
    "CLAUDE_CODE_USE_BEDROCK",
    "CLAUDE_CODE_USE_VERTEX",
    "CLAUDE_CODE_USE_FOUNDRY",
  ]),
  candidates: Object.freeze({
    home: Object.freeze([".local/bin/claude", ".claude/local/claude", ".npm-global/bin/claude", ".bun/bin/claude"]),
    system: Object.freeze(["/opt/homebrew/bin/claude", "/usr/local/bin/claude"]),
    nvmVersionsDirectory: ".nvm/versions/node",
    nvmBinDirectory: "bin",
    editorExtensionDirectories: Object.freeze([
      ".vscode/extensions",
      ".vscode-insiders/extensions",
      ".cursor/extensions",
      ".windsurf/extensions",
    ]),
    editorExtensionPrefix: "anthropic.claude-code-",
    editorBinaryPath: Object.freeze(["resources", "native-binary", "claude"]),
  }),
  errorPatterns: Object.freeze({
    signedOut: Object.freeze([
      /not logged in/i,
      /please run \/login/i,
      /invalid api key/i,
      /\b401\b/,
      /oauth token (?:has )?expired/i,
      /authentication[_ ]error/i,
    ]),
    rateLimited: Object.freeze([/usage limit/i, /rate[_ ]limit/i, /\b429\b/, /limit (?:reached|exceeded)/i]),
  }),
  versionPrefix: /^v/,
  versionSeparator: ".",
});

const PROCESS_SIGNALS = Object.freeze({ terminate: "SIGTERM", kill: "SIGKILL" });

const MISSING_EXECUTABLE_ERRORS = Object.freeze(["ENOENT", "EACCES", "ENOTDIR"]);

export { OCR_EFFORTS, OCR_DEFAULTS, CLAUDE_CLI, PROCESS_SIGNALS, MISSING_EXECUTABLE_ERRORS };
