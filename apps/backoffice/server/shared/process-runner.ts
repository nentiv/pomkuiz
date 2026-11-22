import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { PROCESS_SIGNALS } from "../config/ocr-settings.ts";

interface ProcessOutcome {
  code: number | null;
  stdout: string;
  stderr: string;
  spawnError: NodeJS.ErrnoException | null;
  timedOut: boolean;
  cancelled: boolean;
  outputOverflow: boolean;
}

interface ProcessRequest {
  command: string;
  args: readonly string[];
  input?: string;
  env: NodeJS.ProcessEnv;
  cwd: string;
  timeoutMs: number;
  killGraceMs: number;
  maxOutputBytes: number;
  maxDiagnosticCharacters: number;
  signal?: AbortSignal;
}

type ProcessRunner = (request: ProcessRequest) => Promise<ProcessOutcome>;

function signalGroup(child: ChildProcess, signal: NodeJS.Signals): void {
  try {
    if (child.pid) process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
}

async function collect(stream: NodeJS.ReadableStream, maxBytes: number, onOverflow: () => void): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    if (size + buffer.length > maxBytes) {
      chunks.push(buffer.subarray(0, Math.max(0, maxBytes - size)));
      size = maxBytes;
      onOverflow();
      continue;
    }
    chunks.push(buffer);
    size += buffer.length;
  }
  return Buffer.concat(chunks);
}

const runProcess: ProcessRunner = async (request) => {
  const stop = new AbortController();
  const timeout = AbortSignal.timeout(request.timeoutMs);
  const anyStop = AbortSignal.any([timeout, stop.signal, ...(request.signal ? [request.signal] : [])]);
  let outputOverflow = false;
  const outcome = (fields: Partial<ProcessOutcome>): ProcessOutcome => ({
    code: null,
    stdout: "",
    stderr: "",
    spawnError: null,
    timedOut: timeout.aborted,
    cancelled: Boolean(request.signal?.aborted),
    outputOverflow,
    ...fields,
  });

  let child: ChildProcess;
  try {
    child = spawn(request.command, request.args, {
      cwd: request.cwd,
      env: request.env,
      shell: false,
      detached: true,
      stdio: [request.input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    });
  } catch (error) {
    return outcome({ spawnError: error as NodeJS.ErrnoException });
  }

  const terminate = () => {
    signalGroup(child, PROCESS_SIGNALS.terminate as NodeJS.Signals);
    const force = setTimeout(() => signalGroup(child, PROCESS_SIGNALS.kill as NodeJS.Signals), request.killGraceMs);
    child.once("close", () => clearTimeout(force));
  };
  anyStop.addEventListener("abort", terminate, { once: true });

  if (request.input !== undefined && child.stdin) {
    child.stdin.on("error", () => {});
    child.stdin.end(request.input);
  }

  try {
    const spawnFailure = once(child, "error").then(([error]) => error as NodeJS.ErrnoException);
    const completion = Promise.all([
      collect(child.stdout!, request.maxOutputBytes, () => {
        outputOverflow = true;
        stop.abort();
      }),
      collect(child.stderr!, request.maxDiagnosticCharacters, () => {}),
      once(child, "close"),
    ]);
    const result = await Promise.race([completion, spawnFailure]);
    if (result instanceof Error) return outcome({ spawnError: result });
    const [stdout, stderr, [code]] = result;
    return outcome({
      code: code as number | null,
      stdout: stdout.toString("utf8"),
      stderr: stderr.toString("utf8").slice(0, request.maxDiagnosticCharacters),
    });
  } catch (error) {
    return outcome({ spawnError: error as NodeJS.ErrnoException });
  } finally {
    anyStop.removeEventListener("abort", terminate);
  }
};

export { runProcess };
export type { ProcessOutcome, ProcessRunner };
