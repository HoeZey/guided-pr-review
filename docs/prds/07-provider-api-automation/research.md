# Research: provider API automation

Checked 15 September 2026. Primary sources only.

## Azure DevOps CLI token

[Issue Entra tokens with Azure
CLI](https://learn.microsoft.com/en-us/azure/devops/cli/entra-tokens?view=azure-devops)
documents the Azure DevOps resource id and token command:

```bash
az account get-access-token \
  --resource 499b84ac-1321-427f-aa17-267ca6975798 \
  --query accessToken \
  --output tsv
```

The server may execute this command through an injected credential source and
use the returned token in an Authorization Bearer header. It must not use az
rest or az devops for product operations.

[Azure Repos authentication
overview](https://learn.microsoft.com/en-us/azure/devops/repos/git/auth-overview?view=azure-devops)
says Microsoft Entra tokens are preferred for Git operations and REST APIs.
The same access token can authenticate git fetch. Implementation must keep it
out of command arguments and logs; use an injected process environment or
credential callback and redact child-process errors.

## Azure DevOps repository and pull-request APIs

[Repositories -
List](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/repositories/list?view=azure-devops-rest-7.1)
provides repository identity and remote URLs.

[Pull Requests - Get Pull
Requests](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-requests/get-pull-requests?view=azure-devops-rest-7.1)
supports repository-scoped PR queries, lifecycle filters, reviewer/creator
criteria, and top/skip pagination.

[Pull Requests - Get Pull Requests By
Project](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-requests/get-pull-requests-by-project?view=azure-devops-rest-7.1)
supports project queries when repository identity is already known.

Use API version 7.1. Normalize title, draft/status, refs, source and target
commits, author, reviewer relationship, timestamps, repository id, owner,
name, and web URL. Provider payloads do not cross the adapter.

## GitHub CLI token

[gh auth token](https://cli.github.com/manual/gh_auth_token) prints the token
for the active account on one host. Phase 07 supports one active account per
provider:

```bash
gh auth token --hostname github.com
```

[gh auth login](https://cli.github.com/manual/gh_auth_login) normally stores
credentials in the system credential store and documents web/device login.
Phase 07 does not accept pasted PATs or call gh api. A missing CLI, missing
login, inaccessible credential store, expired token, or insufficient scope
must become a structured connection error with exact recovery copy.

## GitHub pull-request APIs

[REST API endpoints for pull
requests](https://docs.github.com/en/rest/pulls/pulls) provides
GET /repos/{owner}/{repo}/pulls. The response includes author, draft state,
base/head refs and commits, requested reviewers, timestamps, status, URLs, and
pagination.

[REST API endpoints for review
requests](https://docs.github.com/en/rest/pulls/review-requests)
provides requested reviewers for one pull request. Requested reviewers may
disappear after submitting a review, so product grouping should use current
requested-reviewer data and preserve saved reviews independently.

For each configured repository, list active PRs and classify them against the
authenticated user. Include authored drafts. Fetch saved PRs individually when
refresh needs their completed/closed lifecycle. Pin the current documented
GitHub REST version header in the adapter rather than relying on an ambient
default.

## Native OAuth roadmap

[Microsoft Entra OAuth for Azure
DevOps](https://learn.microsoft.com/en-us/azure/devops/integrate/get-started/authentication/entra-oauth?view=azure-devops)
and [GitHub OAuth device
flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
confirm native sign-in is feasible but requires app registration, consent,
token-cache design, and secure persistence.

Do not implement OAuth in phase 07. Run manual CLI-auth acceptance first. Open
a separate PRD only if terminal login, credential refresh, or missing CLI
materially harms normal use.

## Security conclusions

- CLI commands return credentials only. All host reads/writes use server-side
  fetch through provider adapters.
- Never expose tokens to browser JSON, persisted review/catalog data, Guide
  payloads, logs, command arguments, snapshots, or thrown error messages.
- Bound child-process duration and output. Treat stderr as untrusted and redact
  token-shaped data.
- Use same-origin HTTP boundaries. Browser chooses configured repository or
  review ids; server resolves provider URLs and credentials.
- Managed git caches contain repository objects but no persisted token.
- CI uses command, fetch, and git fakes. It never contacts private hosts.
