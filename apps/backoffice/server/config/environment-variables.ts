const ENV_VARIABLES = Object.freeze({
  port: "POMKUIZ_PORT",
  dataDirectory: "POMKUIZ_DATA_DIR",
  workspaceDirectory: "POMKUIZ_WORKSPACE_DIR",
  claudePath: "POMKUIZ_CLAUDE_PATH",
  ocrModel: "POMKUIZ_OCR_MODEL",
  ocrEffort: "POMKUIZ_OCR_EFFORT",
  ocrConcurrency: "POMKUIZ_OCR_CONCURRENCY",
  ocrMaxAttempts: "POMKUIZ_OCR_MAX_ATTEMPTS",
  autoResume: "POMKUIZ_AUTO_RESUME",
});

type Environment = Readonly<Record<string, string | undefined>>;

class ConfigError extends Error {
  constructor(variable: string, expectation: string) {
    super(`${variable}: ${expectation}`);
    this.name = "ConfigError";
  }
}

function readString(env: Environment, variable: string, fallback: string, allowed?: readonly string[]): string {
  const value = env[variable]?.trim();
  if (!value) return fallback;
  if (allowed && !allowed.includes(value)) throw new ConfigError(variable, allowed.join(" | "));
  return value;
}

function readInteger(env: Environment, variable: string, fallback: number, minimum: number, maximum: number): number {
  const raw = env[variable]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum)
    throw new ConfigError(variable, `${minimum}..${maximum}`);
  return value;
}

const TRUE_VALUES = Object.freeze(["1", "true", "yes", "on"]);
const FALSE_VALUES = Object.freeze(["0", "false", "no", "off"]);

function readBoolean(env: Environment, variable: string, fallback: boolean): boolean {
  const raw = env[variable]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (TRUE_VALUES.includes(raw)) return true;
  if (FALSE_VALUES.includes(raw)) return false;
  throw new ConfigError(variable, [...TRUE_VALUES, ...FALSE_VALUES].join(" | "));
}

export { ENV_VARIABLES, readString, readInteger, readBoolean };
export type { Environment };
