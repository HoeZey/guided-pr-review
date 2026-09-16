import { spawn } from "node:child_process";
import { redactSecrets } from "../auth/command-runner.ts";
import type { GitProcessRequest, GitProcessResult, GitProcessRunner } from "./ports.ts";

export const GIT_TIMEOUT_MS = 30_000;
export const GIT_MAX_OUTPUT_BYTES = 8 * 1024 * 1024;

export function redactGitOutput(text: string, token?: string): string {
  let out = redactSecrets(text).replace(/https?:\/\/[^/@\s]+:[^/@\s]+@/gi, "https://[redacted]@");
  if (token) out = out.split(token).join("[redacted]");
  return out;
}

export function createGitProcessRunner(): GitProcessRunner {
  return { run: runGitProcess };
}

function runGitProcess(request: GitProcessRequest): Promise<GitProcessResult> {
  const [command, ...args] = request.argv;
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;
    let child: ReturnType<typeof spawn>;
    const token = request.env?.GUIDED_PR_REVIEW_GIT_ASKPASS_TOKEN;

    const finish = (result: GitProcessResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ...result,
        stdout: redactGitOutput(result.stdout, token),
        stderr: redactGitOutput(result.stderr, token),
      });
    };

    const env: NodeJS.ProcessEnv = { ...process.env, ...request.env };
    delete env.GIT_DIR;
    delete env.GIT_WORK_TREE;
    delete env.GIT_INDEX_FILE;
    env.GIT_TERMINAL_PROMPT = "0";
    env.GIT_LFS_SKIP_SMUDGE = "1";
    env.GIT_CONFIG_NOSYSTEM = "1";
    env.GIT_CONFIG_GLOBAL = "/dev/null";

    try {
      child = spawn(command, args, {
        cwd: request.cwd,
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });
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
