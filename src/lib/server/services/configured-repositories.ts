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

export type SearchableRepository = {
  provider: GitProviderKind;
  host: string;
  owner: string;
  name: string;
  webUrl?: string;
};

export type SearchableRepositoryList = {
  repositories: SearchableRepository[];
  error?: { code: ConfiguredRepositoryErrorCode; message: string };
};

export type AdoListScope = {
  organization: string;
  project: string;
};

export type HostRepositoryLister = {
  listGithub: () => Promise<SearchableRepository[]>;
  listAdo: (scope?: AdoListScope) => Promise<SearchableRepository[]>;
};

export type ConfiguredRepositoryService = {
  list: () => Promise<ConfiguredRepositoryList>;
  search: (query?: string, ado?: AdoListScope) => Promise<SearchableRepositoryList>;
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
  hostList?: HostRepositoryLister;
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

    async search(query, ado) {
      const hostList = options.hostList;
      if (!hostList) return { repositories: [] };
      const organization = ado?.organization?.trim();
      const project = ado?.project?.trim();
      const adoScope = organization && project ? { organization, project } : undefined;
      const rows: SearchableRepository[] = [];
      let error: SearchableRepositoryList["error"];
      const lists = [
        () => hostList.listGithub(),
        () => hostList.listAdo(adoScope),
      ];
      for (const list of lists) {
        try {
          rows.push(...(await list()));
        } catch (err) {
          error = {
            code: "unavailable",
            message: messageOf(err, "Repository list failed"),
          };
        }
      }
      const needle = query?.trim().toLowerCase() ?? "";
      const repositories = needle
        ? rows.filter((row) =>
            `${row.owner}/${row.name} ${row.webUrl ?? ""}`.toLowerCase().includes(needle),
          )
        : rows;
      return error ? { repositories, error } : { repositories };
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

export function createCliHostRepositoryLister(runner: CommandRunner): HostRepositoryLister {
  const run = (argv: readonly string[]) =>
    runner.run({ argv, timeoutMs: COMMAND_TIMEOUT_MS, maxOutputBytes: 256 * 1024 });

  return {
    async listGithub() {
      const result = await run([
        "gh",
        "repo",
        "list",
        "--limit",
        "100",
        "--json",
        "name,owner,url,nameWithOwner",
      ]);
      if (result.commandMissing || result.timedOut || result.code !== 0) {
        throw fail("unavailable", messageOfCli(result, "gh repo list failed"));
      }
      let payload: unknown;
      try {
        payload = JSON.parse(result.stdout);
      } catch {
        throw fail("malformed-response", "gh repo list returned unexpected JSON");
      }
      if (!Array.isArray(payload)) {
        throw fail("malformed-response", "gh repo list returned unexpected JSON");
      }
      const rows: SearchableRepository[] = [];
      for (const item of payload) {
        if (!item || typeof item !== "object") continue;
        const row = item as Record<string, unknown>;
        const name = typeof row.name === "string" ? row.name : "";
        const ownerLogin =
          row.owner && typeof row.owner === "object"
            ? typeof (row.owner as { login?: unknown }).login === "string"
              ? (row.owner as { login: string }).login
              : ""
            : typeof row.nameWithOwner === "string"
              ? row.nameWithOwner.split("/")[0] ?? ""
              : "";
        if (!name || !ownerLogin) continue;
        const webUrl =
          typeof row.url === "string"
            ? row.url
            : typeof row.nameWithOwner === "string"
              ? `https://github.com/${row.nameWithOwner}`
              : undefined;
        const entry: SearchableRepository = {
          provider: "github",
          host: "github.com",
          owner: ownerLogin,
          name,
        };
        if (webUrl) entry.webUrl = webUrl;
        rows.push(entry);
      }
      return rows;
    },

    async listAdo(explicit?: AdoListScope) {
      let scope: { organization: string; organizationUrl: string; project: string } | undefined;
      if (explicit) {
        scope = adoScopeFromNames(explicit.organization, explicit.project);
        if (!scope) throw fail("unavailable", "Azure DevOps organization and project are required");
      } else {
        const defaults = await run(["az", "devops", "configure", "--list"]);
        if (defaults.commandMissing || defaults.timedOut || defaults.code !== 0) {
          throw fail("unavailable", messageOfCli(defaults, "az devops configure failed"));
        }
        scope = parseAzDevOpsDefaults(defaults.stdout);
        if (!scope) throw fail("unavailable", "az devops has no organization or project defaults");
      }
      const result = await run([
        "az",
        "repos",
        "list",
        "--organization",
        scope.organizationUrl,
        "--project",
        scope.project,
        "--output",
        "json",
      ]);
      if (result.commandMissing || result.timedOut || result.code !== 0) {
        throw fail("unavailable", messageOfCli(result, "az repos list failed"));
      }
      let payload: unknown;
      try {
        payload = JSON.parse(result.stdout);
      } catch {
        throw fail("malformed-response", "az repos list returned unexpected JSON");
      }
      if (!Array.isArray(payload)) {
        throw fail("malformed-response", "az repos list returned unexpected JSON");
      }
      const org = scope.organization;
      const rows: SearchableRepository[] = [];
      for (const item of payload) {
        if (!item || typeof item !== "object") continue;
        const row = item as Record<string, unknown>;
        const name = typeof row.name === "string" ? row.name : "";
        if (!name) continue;
        const project =
          row.project && typeof row.project === "object"
            ? typeof (row.project as { name?: unknown }).name === "string"
              ? (row.project as { name: string }).name
              : scope.project
            : scope.project;
        const webUrl =
          typeof row.webUrl === "string"
            ? row.webUrl
            : `https://dev.azure.com/${org}/${project}/_git/${name}`;
        rows.push({
          provider: "azure-devops",
          host: "dev.azure.com",
          owner: `${org}/${project}`,
          name,
          webUrl,
        });
      }
      return rows;
    },
  };
}

function adoScopeFromNames(
  organization: string,
  project: string,
): { organization: string; organizationUrl: string; project: string } | undefined {
  const projectName = project.trim();
  const raw = organization.trim();
  if (!raw || !projectName) return undefined;
  if (/^https?:\/\//i.test(raw) || /dev\.azure\.com|visualstudio\.com/i.test(raw)) {
    return parseAzDevOpsDefaults(`organization = ${raw}\nproject = ${projectName}`);
  }
  return {
    organization: raw,
    organizationUrl: `https://dev.azure.com/${raw}`,
    project: projectName,
  };
}

function parseAzDevOpsDefaults(
  text: string,
): { organization: string; organizationUrl: string; project: string } | undefined {
  let organizationUrl = "";
  let project = "";
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(organization|project)\s*=\s*(.+?)\s*$/i);
    if (!match) continue;
    if (match[1].toLowerCase() === "organization") organizationUrl = match[2];
    else project = match[2];
  }
  if (!organizationUrl || !project) return undefined;
  let organization = organizationUrl;
  try {
    const url = new URL(organizationUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    organization = parts[0] || url.hostname.replace(/\.visualstudio\.com$/i, "");
    if (!organizationUrl.startsWith("http")) organizationUrl = `https://dev.azure.com/${organization}`;
  } catch {
    organization = organizationUrl.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
    if (organization.endsWith(".visualstudio.com")) {
      organization = organization.slice(0, -".visualstudio.com".length);
    } else if (organization.toLowerCase().startsWith("dev.azure.com/")) {
      organization = organization.slice("dev.azure.com/".length);
    }
    organizationUrl = `https://dev.azure.com/${organization}`;
  }
  if (!organization) return undefined;
  return { organization, organizationUrl, project };
}

function messageOfCli(
  result: { stderr: string; stdout: string },
  fallback: string,
): string {
  const text = `${result.stderr}\n${result.stdout}`.trim();
  return text || fallback;
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
