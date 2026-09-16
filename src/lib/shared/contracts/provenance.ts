import { z } from "zod";

export const Sha = z.string().regex(/^[0-9a-f]{40}$/i);

export function isAzureDevOpsHost(host: string): boolean {
  const normalized = host.toLowerCase();
  return (
    normalized === "dev.azure.com" || normalized.endsWith(".visualstudio.com")
  );
}

export function isGitHubHost(host: string): boolean {
  return host.toLowerCase() === "github.com";
}

export const AzureDevOpsProviderContext = z
  .object({
    kind: z.literal("azure-devops"),
    project: z.string().min(1),
    firstComparingIteration: z.number().int(),
    secondComparingIteration: z.number().int(),
    changes: z.record(
      z.string(),
      z.object({ changeTrackingId: z.number().int() }).strict(),
    ),
  })
  .strict();

export const ProviderContext = z.discriminatedUnion("kind", [
  AzureDevOpsProviderContext,
]);

export const PullRequestSource = z
  .object({
    kind: z.literal("pull-request"),
    provider: z.literal("azure-devops"),
    host: z
      .string()
      .min(1)
      .refine(isAzureDevOpsHost, { message: "unsupported git host" }),
    repository: z
      .object({
        id: z.string().min(1),
        owner: z.string().min(1),
        name: z.string().min(1),
        webUrl: z.string().url(),
      })
      .strict(),
    number: z.number().int().positive(),
    webUrl: z.string().url(),
    sourceRef: z.string().min(1),
    targetRef: z.string().min(1),
    sourceCommit: Sha,
    targetCommit: Sha,
    providerContext: ProviderContext,
  })
  .strict();

export type PullRequestSource = z.infer<typeof PullRequestSource>;
export type AzureDevOpsProviderContext = z.infer<typeof AzureDevOpsProviderContext>;

export function pullRequestSyncKey(source: {
  provider: string;
  host: string;
  repository: { id: string };
  number: number;
}): string {
  return `${source.provider}:${source.host}:${source.repository.id}:${source.number}`;
}
