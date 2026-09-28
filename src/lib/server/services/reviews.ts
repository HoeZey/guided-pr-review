import type { CatalogPullRequest, OpenActionTarget } from "../../shared/contracts/catalog.ts";
import { FileChange, GuideV1 } from "../../shared/contracts/guide.ts";
import type { ListReviewsOutput, ReviewDiff } from "../../shared/contracts/persistence.ts";
import type { StoredOutcome } from "../../shared/contracts/outcomes.ts";
import { isAzureDevOpsHost, isGitHubHost, pullRequestSyncKey } from "../../shared/contracts/provenance.ts";
import { catalogAsSource } from "../../shared/domain/reviews.ts";
import { parseUnifiedDiff } from "../git/parse-unified.ts";
import {
  GitOperationError,
  type GitCommitLog,
  type GitCommitMessage,
  type GitDiff,
  type GitProcessRunner,
  type ManagedGitCache,
} from "../git/ports.ts";
import { GIT_MAX_OUTPUT_BYTES, GIT_TIMEOUT_MS } from "../git/process.ts";
import type {
  ProviderPullRequestMetadata,
  ProviderPullRequestReader,
  ProviderRepositoryReader,
} from "../providers/ports.ts";
import type {
  ConfiguredRepositoryRecord,
  ReviewRepository,
} from "../repositories/ports.ts";

export type DiffSyncResult = {
  reviewId: string;
  skipped: boolean;
};

export type OpenPullRequestResult = {
  id: string;
  chaptered: boolean;
  behind: boolean;
};

export type AddLocalReviewInput = {
  repoPath: string;
  base: string;
  head: string;
  title?: string;
};

export type ReviewDiffOptions = {
  readers: {
    ado: ProviderPullRequestReader;
    github: ProviderPullRequestReader;
  };
  repositoryReaders: {
    ado: ProviderRepositoryReader;
    github: ProviderRepositoryReader;
  };
  listConfigured: () => Promise<ConfiguredRepositoryRecord[]>;
  git: ManagedGitCache & GitDiff & GitCommitLog;
  processRunner: GitProcessRunner;
};

const INTENT_DESCRIPTION_CAP = 8000;
const INTENT_COMMIT_CAP = 100;

function buildIntent(
  description: string | undefined,
  commits: Array<{ sha: string; subject: string; body: string }>,
): NonNullable<ReviewDiff["intent"]> {
  let truncated = false;
  let cappedDescription = description;
  if (cappedDescription !== undefined && cappedDescription.length > INTENT_DESCRIPTION_CAP) {
    cappedDescription = cappedDescription.slice(0, INTENT_DESCRIPTION_CAP);
    truncated = true;
  }
  let cappedCommits = commits;
  if (cappedCommits.length > INTENT_COMMIT_CAP) {
    cappedCommits = cappedCommits.slice(0, INTENT_COMMIT_CAP);
    truncated = true;
  }
  return {
    ...(cappedDescription !== undefined ? { description: cappedDescription } : {}),
    commits: cappedCommits.map((row) => ({
      sha: row.sha,
      subject: row.subject,
      body: row.body,
    })),
    ...(truncated ? { truncated: true as const } : {}),
  };
}

export type ReviewService = {
  list: () => Promise<ListReviewsOutput>;
  get: (
    id: string,
  ) => Promise<{ guide: GuideV1; outcomes: StoredOutcome[]; diff?: ReviewDiff }>;
  add: (input: unknown) => Promise<{ id: string }>;
  addFromTool: (body: unknown) => Promise<{ id: string }>;
  upsert: (input: unknown) => Promise<{ id: string }>;
  upsertFromTool: (body: unknown) => Promise<{ id: string }>;
  remove: (id: string) => Promise<{ ok: true }>;
  setActive: (id: string) => Promise<{ activeId: string }>;
  chapterReview: (input: unknown) => Promise<{ id: string }>;
  seedIfEmpty: (guide: GuideV1) => Promise<void>;
  openDiff: (target: OpenActionTarget) => Promise<DiffSyncResult>;
  updateDiff: (target: OpenActionTarget) => Promise<DiffSyncResult>;
  openPullRequest: (url: string) => Promise<OpenPullRequestResult>;
  addLocalReview: (input: AddLocalReviewInput) => Promise<{ id: string }>;
};

function stripHeads(ref: string): string {
  return ref.replace(/^refs\/heads\//i, "");
}

function unchapteredGuide(fetched: {
  title: string;
  files: GuideV1["chapters"][number]["files"];
  source: NonNullable<GuideV1["source"]>;
}): GuideV1 {
  return GuideV1.parse({
    version: 1,
    title: fetched.title,
    base: fetched.source.targetCommit,
    head: fetched.source.sourceCommit,
    range: `${stripHeads(fetched.source.targetRef)}...${stripHeads(fetched.source.sourceRef)}`,
    repo: fetched.source.repository.name,
    unchaptered: true,
    chapters: [
      {
        id: "unchaptered",
        kind: "core",
        title: fetched.title,
        why: "Raw diff until a reading-order guide is generated.",
        files: fetched.files,
      },
    ],
    source: fetched.source,
  });
}

function localUnchapteredGuide(fetched: {
  title: string;
  base: string;
  head: string;
  range: string;
  files: GuideV1["chapters"][number]["files"];
}): GuideV1 {
  return GuideV1.parse({
    version: 1,
    title: fetched.title,
    base: fetched.base,
    head: fetched.head,
    range: fetched.range,
    unchaptered: true,
    chapters: [
      {
        id: "unchaptered",
        kind: "core",
        title: fetched.title,
        why: "Raw diff until a reading-order guide is generated.",
        files: fetched.files,
      },
    ],
  });
}

function withStatus(err: unknown, status: number): Error {
  if (err instanceof Error) {
    if (typeof (err as { status?: number }).status !== "number") {
      (err as { status?: number }).status = status;
    }
    return err;
  }
  return Object.assign(new Error(String(err)), { status });
}

function badRequest(message: string): Error {
  return Object.assign(new Error(message), { status: 400 });
}

type ParsedPullRequestUrl = {
  provider: "azure-devops" | "github";
  host: string;
  owner: string;
  name: string;
  number: number;
};

export function parsePullRequestUrl(raw: string): ParsedPullRequestUrl {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw badRequest("malformed pull request URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw badRequest("malformed pull request URL");
  }
  const host = url.hostname.toLowerCase();
  const parts = url.pathname
    .replace(/\/+$/, "")
    .split("/")
    .map((part) => decodeURIComponent(part))
    .filter(Boolean);

  if (isGitHubHost(host) || host === "www.github.com") {
    const pullAt = parts.indexOf("pull");
    if (pullAt !== 2 || parts.length < 4) throw badRequest("malformed pull request URL");
    const number = Number(parts[3]);
    if (!Number.isInteger(number) || number <= 0) throw badRequest("malformed pull request URL");
    return {
      provider: "github",
      host: "github.com",
      owner: parts[0],
      name: parts[1].replace(/\.git$/i, ""),
      number,
    };
  }

  if (host === "dev.azure.com") {
    const gitAt = parts.indexOf("_git");
    const prAt = parts.findIndex((part) => part.toLowerCase() === "pullrequest");
    if (gitAt !== 2 || prAt !== 4 || parts.length < 6) {
      throw badRequest("malformed pull request URL");
    }
    const number = Number(parts[5]);
    if (!Number.isInteger(number) || number <= 0) throw badRequest("malformed pull request URL");
    return {
      provider: "azure-devops",
      host: "dev.azure.com",
      owner: `${parts[0]}/${parts[1]}`,
      name: parts[3].replace(/\.git$/i, ""),
      number,
    };
  }

  if (isAzureDevOpsHost(host) && host.endsWith(".visualstudio.com")) {
    const org = host.slice(0, -".visualstudio.com".length);
    const rest = parts[0]?.toLowerCase() === "defaultcollection" ? parts.slice(1) : parts;
    const gitAt = rest.indexOf("_git");
    const prAt = rest.findIndex((part) => part.toLowerCase() === "pullrequest");
    if (!org || gitAt !== 1 || prAt !== 3 || rest.length < 5) {
      throw badRequest("malformed pull request URL");
    }
    const number = Number(rest[4]);
    if (!Number.isInteger(number) || number <= 0) throw badRequest("malformed pull request URL");
    return {
      provider: "azure-devops",
      host,
      owner: `${org}/${rest[0]}`,
      name: rest[2].replace(/\.git$/i, ""),
      number,
    };
  }

  throw badRequest("unsupported git host");
}

function parseCommitLog(stdout: string): GitCommitMessage[] {
  const parts = stdout.split("\0");
  const commits: GitCommitMessage[] = [];
  for (let i = 0; i + 2 < parts.length; i += 3) {
    const sha = parts[i]?.trim() ?? "";
    if (!sha) continue;
    commits.push({
      sha,
      subject: parts[i + 1] ?? "",
      body: (parts[i + 2] ?? "").replace(/\n$/, ""),
    });
  }
  return commits;
}

function guideSourceCommit(guide: GuideV1): string {
  return guide.source?.sourceCommit ?? guide.head;
}

function openFlags(review: {
  guide: GuideV1;
  diff?: ReviewDiff;
}): OpenPullRequestResult {
  const diffCommit = review.diff?.sourceCommit;
  const guideCommit = guideSourceCommit(review.guide);
  return {
    id: "",
    chaptered: review.guide.unchaptered !== true,
    behind: Boolean(
      diffCommit && guideCommit.toLowerCase() !== diffCommit.toLowerCase(),
    ),
  };
}

function toCatalogItem(meta: ProviderPullRequestMetadata): CatalogPullRequest {
  return {
    provider: meta.provider,
    host: meta.host,
    repository: {
      id: meta.repository.id,
      owner: meta.repository.owner,
      name: meta.repository.name,
      webUrl: meta.repository.webUrl,
    },
    number: meta.number,
    title: meta.title,
    webUrl: meta.webUrl,
    sourceRef: meta.sourceRef,
    targetRef: meta.targetRef,
    sourceCommit: meta.sourceCommit,
    targetCommit: meta.targetCommit,
    isDraft: meta.isDraft,
    status: meta.status,
    author: meta.author,
    isReviewer: meta.isReviewer,
    isAuthor: meta.isAuthor,
    updatedAt: meta.updatedAt,
  };
}

export function createReviewService(
  repos: ReviewRepository,
  options?: ReviewDiffOptions,
): ReviewService {
  const inflight = new Map<string, Promise<DiffSyncResult>>();

  async function resolveCloneUrl(
    meta: ProviderPullRequestMetadata,
    target: OpenActionTarget,
  ): Promise<string> {
    if (meta.repository.cloneUrl) return meta.repository.cloneUrl;
    const configured = await options!.listConfigured();
    const row = configured.find(
      (item) =>
        item.provider === target.provider &&
        item.host === target.host &&
        item.id === target.repository.id,
    );
    if (row?.cloneUrl) return row.cloneUrl;
    const reader =
      target.provider === "github" ? options!.repositoryReaders.github : options!.repositoryReaders.ado;
    const repository = await reader.getRepository({
      provider: target.provider,
      host: target.host,
      owner: target.repository.owner,
      name: target.repository.name,
    });
    if (repository.cloneUrl) return repository.cloneUrl;
    throw Object.assign(new Error("clone URL required to fetch commits"), { status: 502 });
  }

  async function findExisting(target: OpenActionTarget) {
    const listed = await repos.listReviews();
    const key = pullRequestSyncKey(target);
    return listed.reviews.find((row) => row.syncKey === key);
  }

  async function syncDiff(target: OpenActionTarget): Promise<DiffSyncResult> {
    if (!options) {
      throw Object.assign(new Error("diff sync is not configured"), { status: 500 });
    }
    const reader = target.provider === "github" ? options.readers.github : options.readers.ado;
    const prInput = {
      provider: target.provider,
      host: target.host,
      repository: {
        id: target.repository.id,
        owner: target.repository.owner,
        name: target.repository.name,
      },
      number: target.number,
    };
    const meta = await reader.getPullRequest(prInput);
    const existing = await findExisting({
      provider: meta.provider,
      host: meta.host,
      repository: {
        id: meta.repository.id,
        owner: meta.repository.owner,
        name: meta.repository.name,
        webUrl: meta.repository.webUrl,
      },
      number: meta.number,
    });
    if (
      existing?.diffCommit &&
      existing.diffCommit.toLowerCase() === meta.sourceCommit.toLowerCase()
    ) {
      return { reviewId: existing.id, skipped: true };
    }
    const cloneUrl = await resolveCloneUrl(meta, target);
    const identity = {
      provider: meta.provider,
      host: meta.host,
      repositoryId: meta.repository.id,
    };
    await options.git.ensureBare(identity);
    await options.git.fetchCommits(identity, [meta.sourceCommit, meta.targetCommit], { cloneUrl });
    const raw = await options.git.unifiedThreeDot({
      identity,
      sourceCommit: meta.sourceCommit,
      targetCommit: meta.targetCommit,
    });
    const commits = await options.git.logCommits({
      identity,
      sourceCommit: meta.sourceCommit,
      targetCommit: meta.targetCommit,
    });
    const files = raw.map((file) => FileChange.parse(file));
    const adoContext =
      target.provider === "azure-devops" ? await reader.getCommentContext?.(prInput) : undefined;
    const source = catalogAsSource(
      toCatalogItem(meta),
      meta.sourceCommit,
      meta.targetCommit,
      adoContext,
    );
    const diff: ReviewDiff = {
      sourceCommit: meta.sourceCommit,
      targetCommit: meta.targetCommit,
      files,
      intent: buildIntent(meta.description, commits),
    };
    if (existing && !existing.unchaptered) {
      const got = await repos.getReview(existing.id);
      const { id: reviewId } = await repos.upsertReview({
        guide: got.guide,
        diff,
      });
      return { reviewId, skipped: false };
    }
    const { id: reviewId } = await repos.upsertReview({
      guide: unchapteredGuide({ title: meta.title, files, source }),
      diff,
    });
    return { reviewId, skipped: false };
  }

  async function runDiff(target: OpenActionTarget): Promise<DiffSyncResult> {
    const key = pullRequestSyncKey(target);
    const shared = inflight.get(key);
    if (shared) return shared;
    const pending = (async () => {
      try {
        return await syncDiff(target);
      } catch (err) {
        if (err instanceof GitOperationError) throw withStatus(err, 502);
        throw withStatus(err, (err as { status?: number }).status ?? 502);
      }
    })().finally(() => {
      inflight.delete(key);
    });
    inflight.set(key, pending);
    return pending;
  }

  async function openSavedOrSync(target: OpenActionTarget): Promise<DiffSyncResult> {
    const existing = await findExisting(target);
    if (existing) return { reviewId: existing.id, skipped: true };
    return runDiff(target);
  }

  async function openPullRequest(url: string): Promise<OpenPullRequestResult> {
    if (!options) {
      throw Object.assign(new Error("diff sync is not configured"), { status: 500 });
    }
    const parsed = parsePullRequestUrl(url);
    const reader =
      parsed.provider === "github"
        ? options.repositoryReaders.github
        : options.repositoryReaders.ado;
    let repository;
    try {
      repository = await reader.getRepository({
        provider: parsed.provider,
        host: parsed.host,
        owner: parsed.owner,
        name: parsed.name,
      });
    } catch (err) {
      throw withStatus(err, (err as { status?: number }).status ?? 502);
    }
    const target: OpenActionTarget = {
      provider: parsed.provider,
      host: parsed.host,
      repository: {
        id: repository.id,
        owner: repository.owner,
        name: repository.name,
        webUrl: repository.webUrl,
      },
      number: parsed.number,
    };
    const synced = await runDiff(target);
    const review = await repos.getReview(synced.reviewId);
    const flags = openFlags(review);
    return { id: synced.reviewId, chaptered: flags.chaptered, behind: flags.behind };
  }

  async function runLocalGit(repoPath: string, args: readonly string[]) {
    return options!.processRunner.run({
      argv: ["git", ...args],
      cwd: repoPath,
      timeoutMs: GIT_TIMEOUT_MS,
      maxOutputBytes: GIT_MAX_OUTPUT_BYTES,
    });
  }

  async function addLocalReview(input: AddLocalReviewInput): Promise<{ id: string }> {
    if (!options?.processRunner) {
      throw Object.assign(new Error("local review is not configured"), { status: 500 });
    }
    const inside = await runLocalGit(input.repoPath, ["rev-parse", "--is-inside-work-tree"]);
    if (
      inside.commandMissing ||
      inside.timedOut ||
      inside.code !== 0 ||
      inside.stdout.trim() !== "true"
    ) {
      throw badRequest("path is not a git work tree");
    }

    const resolve = async (ref: string) => {
      const result = await runLocalGit(input.repoPath, ["rev-parse", "--verify", `${ref}^{commit}`]);
      if (result.commandMissing || result.timedOut || result.code !== 0) {
        throw badRequest(`unknown commit ${ref}`);
      }
      const sha = result.stdout.trim().split(/\r?\n/, 1)[0]?.trim() ?? "";
      if (!/^[0-9a-f]{40}$/i.test(sha)) throw badRequest(`unknown commit ${ref}`);
      return sha.toLowerCase();
    };

    const baseSha = await resolve(input.base);
    const headSha = await resolve(input.head);

    const diffResult = await runLocalGit(input.repoPath, [
      "diff",
      "-U3",
      "-M",
      `${baseSha}...${headSha}`,
    ]);
    if (diffResult.commandMissing || diffResult.timedOut || diffResult.code !== 0) {
      throw badRequest("failed to read local diff");
    }
    if (!diffResult.stdout.trim()) throw badRequest("empty diff");
    const files = parseUnifiedDiff(diffResult.stdout).map((file) => FileChange.parse(file));
    if (files.length === 0) throw badRequest("empty diff");

    const logResult = await runLocalGit(input.repoPath, [
      "log",
      "--reverse",
      "--format=%H%x00%s%x00%b%x00",
      `${baseSha}..${headSha}`,
    ]);
    if (logResult.commandMissing || logResult.timedOut || logResult.code !== 0) {
      throw badRequest("failed to read local commit log");
    }
    const commits = parseCommitLog(logResult.stdout);

    let title = input.title?.trim();
    if (!title) {
      const subject = await runLocalGit(input.repoPath, ["log", "-1", "--format=%s", headSha]);
      if (subject.commandMissing || subject.timedOut || subject.code !== 0) {
        throw badRequest("failed to read head commit subject");
      }
      title = subject.stdout.trim().split(/\r?\n/, 1)[0]?.trim() || "Local review";
    }

    const diff: ReviewDiff = {
      sourceCommit: headSha,
      targetCommit: baseSha,
      files,
      intent: buildIntent(undefined, commits),
    };
    const guide = localUnchapteredGuide({
      title,
      base: baseSha,
      head: headSha,
      range: `${input.base}...${input.head}`,
      files,
    });
    return repos.addReview({ guide, diff });
  }

  return {
    list: () => repos.listReviews(),
    get: (id) => repos.getReview(id),
    add: (input) => repos.addReview(input),
    addFromTool: (body) => repos.addReviewFromTool(body),
    upsert: (input) => repos.upsertReview(input),
    upsertFromTool: (body) => repos.upsertReviewFromTool(body),
    remove: (id) => repos.removeReview(id),
    setActive: (id) => repos.setActive(id),
    chapterReview: (input) => repos.chapterReview(input),
    seedIfEmpty: (guide) => repos.seedIfEmpty(guide),
    openDiff: (target) => openSavedOrSync(target),
    updateDiff: (target) => runDiff(target),
    openPullRequest,
    addLocalReview,
  };
}
