import { spawn } from "node:child_process";
import type { CommandRunner, CommandRunRequest, CommandRunResult } from "./ports.ts";

export const COMMAND_TIMEOUT_MS = 8_000;
export const MAX_OUTPUT_BYTES = 64 * 1024;

export function redactSecrets(text: string): string {
  return text
    .replace(/\b(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]+/g, "[redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/("accessToken"\s*:\s*")[^"]*(")/gi, "$1[redacted]$2");
}

export function boundCommandRunner(runner: CommandRunner, max = 2): CommandRunner {
  let active = 0;
  const waiters: Array<() => void> = [];
  return {
    async run(request) {
      while (active >= max) {
        await new Promise<void>((resolve) => {
          waiters.push(resolve);
        });
      }
      active += 1;
      try {
        return await runner.run(request);
      } finally {
        active -= 1;
        waiters.shift()?.();
      }
    },
  };
}

export function createProcessCommandRunner(): CommandRunner {
  return {
    run: runProcess,
  };
}

function runProcess(request: CommandRunRequest): Promise<CommandRunResult> {
  const [command, ...args] = request.argv;
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;
    let child: ReturnType<typeof spawn>;

    const finish = (result: Omit<CommandRunResult, "stderr"> & { stderr: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ...result,
        stderr: redactSecrets(result.stderr),
      });
    };

    try {
      child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    } catch (err) {
      const missing = (err as NodeJS.ErrnoException).code === "ENOENT";
      finish({
        code: null,
        stdout: "",
        stderr: "",
        timedOut: false,
        commandMissing: missing,
      });
      return;
    }

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, request.timeoutMs);

    const onChunk = (kind: "stdout" | "stderr") => (chunk: Buffer) => {
      if (kind === "stdout") stdout += chunk.toString("utf8");
      else stderr += chunk.toString("utf8");
      if (stdout.length + stderr.length > request.maxOutputBytes) {
        child.kill("SIGKILL");
      }
    };

    child.stdout?.on("data", onChunk("stdout"));
    child.stderr?.on("data", onChunk("stderr"));
    child.on("error", (err) => {
      const missing = (err as NodeJS.ErrnoException).code === "ENOENT";
      finish({
        code: null,
        stdout: "",
        stderr: err.message,
        timedOut: false,
        commandMissing: missing,
      });
    });
    child.on("close", (code) => {
      finish({
        code,
        stdout,
        stderr,
        timedOut,
        commandMissing: false,
      });
    });
  });
}
