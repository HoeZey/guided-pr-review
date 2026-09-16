import { isAzureDevOpsHost } from "../../shared/contracts/provenance.ts";
import type { GitProviderKind } from "../providers/ports.ts";
import {
  boundCommandRunner,
  COMMAND_TIMEOUT_MS,
  MAX_OUTPUT_BYTES,
} from "./command-runner.ts";
import type {
  CommandRunResult,
  CommandRunner,
  CredentialFailure,
  CredentialResult,
  CredentialSource,
} from "./ports.ts";

export const ADO_RESOURCE = "499b84ac-1321-427f-aa17-267ca6975798";

export function createCliCredentialSource(options: {
  runner: CommandRunner;
  now?: () => number;
  timeoutMs?: number;
  maxOutputBytes?: number;
}): CredentialSource {
  const runner = boundCommandRunner(options.runner);
  const now = options.now ?? Date.now;
  const timeoutMs = options.timeoutMs ?? COMMAND_TIMEOUT_MS;
  const maxOutputBytes = options.maxOutputBytes ?? MAX_OUTPUT_BYTES;
  const inflight = new Map<string, Promise<CredentialResult>>();

  const run = (argv: readonly string[]) => runner.run({ argv, timeoutMs, maxOutputBytes });

  async function probe(provider: GitProviderKind, host: string): Promise<CredentialResult> {
    if (provider === "azure-devops") {
      if (!isAzureDevOpsHost(host)) return fail("azure-devops", host, "malformed");
      return readAdo(host);
    }
    if (host.toLowerCase() !== "github.com") return fail("github", host, "malformed");
    return readGithub(host);
  }

  async function readAdo(host: string): Promise<CredentialResult> {
    const result = await run([
      "az",
      "account",
      "get-access-token",
      "--resource",
      ADO_RESOURCE,
      "--output",
      "json",
    ]);
    if (result.commandMissing || result.timedOut || result.code !== 0) {
      return classify("azure-devops", host, result);
    }
    const token = adoToken(result.stdout);
    if (!token) return fail("azure-devops", host, "malformed");
    const identity = jwtIdentity(token, now());
    if (identity === "expired") return fail("azure-devops", host, "expired");
    if (identity === "malformed") return fail("azure-devops", host, "malformed");
    return {
      status: "connected",
      identity: { provider: "azure-devops", host, login: identity },
      token,
    };
  }

  async function readGithub(host: string): Promise<CredentialResult> {
    const tokenResult = await run(["gh", "auth", "token", "--hostname", host]);
    if (tokenResult.commandMissing || tokenResult.timedOut || tokenResult.code !== 0) {
      return classify("github", host, tokenResult);
    }
    const token = tokenResult.stdout.trim();
    if (!token) return fail("github", host, "malformed");
    const statusResult = await run(["gh", "auth", "status", "--hostname", host]);
    if (statusResult.commandMissing || statusResult.timedOut || statusResult.code !== 0) {
      return classify("github", host, statusResult);
    }
    const login = githubLogin(statusResult.stdout);
    if (!login) return fail("github", host, "malformed");
    return {
      status: "connected",
      identity: { provider: "github", host, login },
      token,
    };
  }

  return {
    getAccessToken(input) {
      const key = `${input.provider}:${input.host.toLowerCase()}`;
      const existing = inflight.get(key);
      if (existing) return existing;
      const pending = probe(input.provider, input.host).finally(() => {
        inflight.delete(key);
      });
      inflight.set(key, pending);
      return pending;
    },
  };
}

function recovery(provider: GitProviderKind): string {
  return provider === "github" ? "gh auth login" : "az login";
}

function fail(
  provider: GitProviderKind,
  host: string,
  status: CredentialFailure["status"],
): CredentialFailure {
  return { status, provider, host, recovery: recovery(provider) };
}

function classify(
  provider: GitProviderKind,
  host: string,
  result: CommandRunResult,
): CredentialFailure {
  if (result.commandMissing) return fail(provider, host, "command-missing");
  if (result.timedOut) return fail(provider, host, "timeout");
  const text = `${result.stderr}\n${result.stdout}`.toLowerCase();
  if (
    /aadsts65001|aadsts70011|insufficient|denied.*scope|missing required scope|required scope/.test(
      text,
    )
  ) {
    return fail(provider, host, "denied-scope");
  }
  if (/aadsts700082|aadsts50078|expired|refresh token/.test(text)) {
    return fail(provider, host, "expired");
  }
  if (
    /az login|gh auth login|not logged|please run|authentication required|no subscriptions/.test(
      text,
    )
  ) {
    return fail(provider, host, "login-required");
  }
  if (result.code !== 0 && result.code !== null) return fail(provider, host, "login-required");
  return fail(provider, host, "malformed");
}

function adoToken(stdout: string): string | undefined {
  const trimmed = stdout.trim();
  try {
    const parsed = JSON.parse(trimmed) as { accessToken?: unknown };
    if (typeof parsed.accessToken === "string" && parsed.accessToken.trim()) {
      return parsed.accessToken.trim();
    }
  } catch {
    if (trimmed.split(".").length === 3 && trimmed.startsWith("eyJ")) return trimmed;
  }
  return undefined;
}

function jwtIdentity(token: string, nowMs: number): string | "expired" | "malformed" {
  const parts = token.split(".");
  if (parts.length < 2) return "malformed";
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
    if (typeof payload.exp === "number" && payload.exp * 1000 <= nowMs) return "expired";
    const login =
      asLogin(payload.unique_name) ??
      asLogin(payload.upn) ??
      asLogin(payload.preferred_username) ??
      asLogin(payload.email);
    return login ?? "malformed";
  } catch {
    return "malformed";
  }
}

function asLogin(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function githubLogin(stdout: string): string | undefined {
  const trimmed = stdout.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as {
        hosts?: unknown;
        login?: unknown;
        active_account?: { login?: unknown };
        accounts?: Array<{ login?: unknown; active?: unknown }>;
      };
      const hosts = Array.isArray(parsed.hosts) ? parsed.hosts : [parsed];
      for (const row of hosts) {
        if (!row || typeof row !== "object") continue;
        const host = row as {
          login?: unknown;
          active_account?: { login?: unknown };
          accounts?: Array<{ login?: unknown; active?: unknown }>;
        };
        const active = asLogin(host.active_account?.login) ?? asLogin(host.login);
        if (active) return active;
        const accounts = host.accounts;
        if (!Array.isArray(accounts)) continue;
        const preferred =
          accounts.find((account) => account?.active && asLogin(account.login)) ??
          accounts.find((account) => asLogin(account.login));
        const login = asLogin(preferred?.login);
        if (login) return login;
      }
    } catch {
      // Fall through to text.
    }
  }
  return trimmed.match(/Logged in to \S+ (?:account |as )(\S+)/)?.[1];
}
