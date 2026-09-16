import type { CommandRunner } from "../auth/ports.ts";
import { COMMAND_TIMEOUT_MS } from "../auth/command-runner.ts";
import { isAzureDevOpsHost, isGitHubHost } from "../../shared/contracts/provenance.ts";
import { ProviderError } from "../providers/errors.ts";
import { GithubProviderError } from "../providers/github/rest.ts";
import type { GitProviderKind, ProviderRepositoryReader } from "../providers/ports.ts";
import type {
  ConfiguredRepositoryPort,
  ConfiguredRepositoryRecord,
} from "../repositories/ports.ts";

export type ParsedGitRemote = {
  provider: GitProviderKind;
  host: string;
  owner: string;
  name: string;
};

export type ConfiguredRepositoryErrorCode =
  | "duplicate"
  | "unsupported-host"
  | "auth"
  | "rate"
  | "unavailable"
  | "malformed-response"
  | "not-found"
  | "denied";

export class ConfiguredRepositoryError extends Error {
  readonly code: ConfiguredRepositoryErrorCode;
  readonly status: number;

  constructor(code: ConfiguredRepositoryErrorCode, message: string) {
    super(message);
    this.name = "ConfiguredRepositoryError";
    this.code = code;
    this.status = statusFor(code);
  }
}

export type AddConfiguredRepositoryInput =
  | { url: string }
  | { provider: GitProviderKind; host: string; owner: string; name: string };

export type ConfiguredRepositoryList = {
  repositories: ConfiguredRepositoryRecord[];
  error?: { code: ConfiguredRepositoryErrorCode; message: string };
};

export type ConfiguredRepositoryService = {
  list: () => Promise<ConfiguredRepositoryList>;
  add: (input: unknown) => Promise<{ repository: ConfiguredRepositoryRecord }>;
  remove: (id: string) => Promise<{ ok: true }>;
};

export function parseGitRemote(value: string | undefined): ParsedGitRemote | undefined {
  if (!value?.trim()) return undefined;
  const raw = value.trim();
  return parseHttpRemote(raw) ?? parseScpRemote(raw) ?? parseSshUrlRemote(raw);
}

export async function readGitOriginUrl(runner: CommandRunner): Promise<string | undefined> {
  const result = await runner.run({
    argv: ["git", "remote", "get-url", "origin"],
    timeoutMs: COMMAND_TIMEOUT_MS,
    maxOutputBytes: 4096,
  });
  if (result.commandMissing || result.timedOut || result.code !== 0) return undefined;
  const url = result.stdout.trim().split(/\r?\n/, 1)[0]?.trim();
  return url || undefined;
}

export function createConfiguredRepositoryService(options: {
  configured: ConfiguredRepositoryPort;
  collectionPresent: () => Promise<boolean>;
  originRemoteUrl: () => Promise<string | undefined>;
  readers: { ado: ProviderRepositoryReader; github: ProviderRepositoryReader };
}): ConfiguredRepositoryService {
  async function persist(
    identity: ParsedGitRemote,
    origin: boolean,
  ): Promise<ConfiguredRepositoryRecord> {
    const reader = identity.provider === "github" ? options.readers.github : options.readers.ado;
    let fetched;
    try {
      fetched = await reader.getRepository(identity);
    } catch (err) {
      throw mapProviderError(err);
    }
    const existing = await options.configured.list();
    if (
      existing.some(
        (row) =>
          row.provider === fetched.provider && row.host === fetched.host && row.id === fetched.id,
      )
    ) {
      throw fail("duplicate", "This repository is already configured");
    }
    const record: ConfiguredRepositoryRecord = {
      provider: fetched.provider,
      host: fetched.host,
      id: fetched.id,
      owner: fetched.owner,
      name: fetched.name,
      webUrl: fetched.webUrl,
      origin,
    };
    if (fetched.cloneUrl) record.cloneUrl = fetched.cloneUrl;
    await options.configured.add(record);
    return record;
  }

  return {
    async list() {
      const repositories = await options.configured.list();
      if ((await options.collectionPresent()) || repositories.length > 0) {
        return { repositories };
      }
      const originUrl = await options.originRemoteUrl();
      if (!originUrl?.trim()) return { repositories };
      const parsed = parseGitRemote(originUrl);
      if (!parsed) {
        return {
          repositories,
          error: { code: "unsupported-host", message: "unsupported git host" },
        };
      }
      try {
        return { repositories: [await persist(parsed, true)] };
      } catch (err) {
        if (err instanceof ConfiguredRepositoryError) {
          if (err.code === "duplicate") return { repositories };
          return { repositories, error: { code: err.code, message: err.message } };
        }
        throw err;
      }
    },

    async add(input) {
      return { repository: await persist(parseAddInput(parseAddConfiguredRepositoryInput(input)), false) };
    },

    async remove(id) {
      const repositories = await options.configured.list();
      if (!repositories.some((row) => row.id === id)) {
        throw fail("not-found", "Repository was not found");
      }
      await options.configured.remove(id);
      return { ok: true as const };
    },
  };
}

function parseAddConfiguredRepositoryInput(input: unknown): AddConfiguredRepositoryInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw fail("unsupported-host", "unsupported git host");
  }
  const row = input as Record<string, unknown>;
  if (typeof row.url === "string") return { url: row.url };
  if (
    (row.provider === "azure-devops" || row.provider === "github") &&
    typeof row.host === "string" &&
    typeof row.owner === "string" &&
    typeof row.name === "string"
  ) {
    return {
      provider: row.provider,
      host: row.host,
      owner: row.owner,
      name: row.name,
    };
  }
  throw fail("unsupported-host", "unsupported git host");
}

function parseAddInput(input: AddConfiguredRepositoryInput): ParsedGitRemote {
  if ("url" in input) {
    const parsed = parseGitRemote(input.url);
    if (!parsed) throw fail("unsupported-host", "unsupported git host");
    return parsed;
  }
  if (input.provider === "github" ? !isGitHubHost(input.host) : !isAzureDevOpsHost(input.host)) {
    throw fail("unsupported-host", "unsupported git host");
  }
  if (!input.owner.trim() || !input.name.trim()) {
    throw fail("not-found", "Repository was not found");
  }
  return {
    provider: input.provider,
    host: input.host,
    owner: input.owner.trim(),
    name: input.name.trim(),
  };
}

function mapProviderError(err: unknown): ConfiguredRepositoryError {
  const code = (err as { code?: string }).code;
  if (code === "denied") return fail("denied", "Access to this repository was denied");
  if (err instanceof ProviderError) {
    if (err.code === "auth") return fail("auth", err.message);
    if (err.code === "not-found") return fail("not-found", err.message);
    if (err.code === "rate") return fail("rate", err.message);
    if (err.code === "unavailable") return fail("unavailable", err.message);
    if (err.code === "malformed-response") return fail("malformed-response", err.message);
  }
  if (err instanceof GithubProviderError) {
    if (err.code === "unauthorized" || err.code === "credential") return fail("auth", err.message);
    if (err.code === "not-found") return fail("not-found", err.message);
    if (err.code === "identity") return fail("unsupported-host", "unsupported git host");
    if (err.code === "rate-limited") return fail("rate", err.message);
    if (err.code === "unavailable") return fail("unavailable", err.message);
    if (err.code === "malformed") return fail("malformed-response", err.message);
  }
  if (code === "auth") return fail("auth", messageOf(err, "Authentication failed"));
  if (code === "not-found") return fail("not-found", messageOf(err, "Repository was not found"));
  return fail("auth", messageOf(err, "Authentication failed"));
}

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error && err.message.trim() ? err.message : fallback;
}

function fail(code: ConfiguredRepositoryErrorCode, message: string): ConfiguredRepositoryError {
  return new ConfiguredRepositoryError(code, message);
}

function statusFor(code: ConfiguredRepositoryErrorCode): number {
  switch (code) {
    case "duplicate":
      return 409;
    case "unsupported-host":
      return 400;
    case "auth":
      return 401;
    case "rate":
      return 429;
    case "unavailable":
      return 503;
    case "malformed-response":
      return 400;
    case "not-found":
      return 404;
    case "denied":
      return 403;
  }
}

function stripGitSuffix(name: string): string {
  return name.replace(/\.git$/i, "");
}

function parseHttpRemote(raw: string): ParsedGitRemote | undefined {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:" && url.protocol !== "git:") {
    return undefined;
  }
  return identityFromHostPath(url.hostname, url.pathname);
}

function parseSshUrlRemote(raw: string): ParsedGitRemote | undefined {
  if (!raw.startsWith("ssh://")) return undefined;
  try {
    const url = new URL(raw);
    return identityFromHostPath(url.hostname, url.pathname);
  } catch {
    return undefined;
  }
}

function parseScpRemote(raw: string): ParsedGitRemote | undefined {
  const match = raw.match(/^git@([^:]+):(.+)$/);
  if (!match) return undefined;
  return identityFromHostPath(match[1], match[2]);
}

function identityFromHostPath(host: string, path: string): ParsedGitRemote | undefined {
  const hostname = host.toLowerCase();
  const parts = path
    .replace(/^\/+/, "")
    .split("/")
    .map((part) => decodeURIComponent(part))
    .filter(Boolean);
  if (parts.length === 0) return undefined;

  if (hostname === "github.com" || hostname === "www.github.com") {
    if (parts.length < 2) return undefined;
    return {
      provider: "github",
      host: "github.com",
      owner: parts[0],
      name: stripGitSuffix(parts[1]),
    };
  }

  if (hostname === "ssh.dev.azure.com") {
    const sliced = parts[0]?.toLowerCase() === "v3" ? parts.slice(1) : parts;
    if (sliced.length < 3) return undefined;
    return {
      provider: "azure-devops",
      host: "dev.azure.com",
      owner: `${sliced[0]}/${sliced[1]}`,
      name: stripGitSuffix(sliced[2]),
    };
  }

  if (hostname === "dev.azure.com") {
    const gitAt = parts.indexOf("_git");
    if (gitAt < 2 || !parts[gitAt + 1]) return undefined;
    return {
      provider: "azure-devops",
      host: "dev.azure.com",
      owner: `${parts[0]}/${parts[1]}`,
      name: stripGitSuffix(parts[gitAt + 1]),
    };
  }

  if (hostname.endsWith(".visualstudio.com")) {
    const org = hostname.slice(0, -".visualstudio.com".length);
    const rest = parts[0]?.toLowerCase() === "defaultcollection" ? parts.slice(1) : parts;
    const gitAt = rest.indexOf("_git");
    if (gitAt < 1 || !rest[gitAt + 1]) return undefined;
    return {
      provider: "azure-devops",
      host: hostname,
      owner: `${org}/${rest[0]}`,
      name: stripGitSuffix(rest[gitAt + 1]),
    };
  }

  return undefined;
}
