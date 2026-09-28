import assert from "node:assert/strict";
import { test } from "node:test";
import { ConnectionList } from "../../shared/contracts/connections.ts";
import { createCliCredentialSource } from "../auth/cli-credentials.ts";
import type { CommandRunRequest, CommandRunner, CredentialSource } from "../auth/ports.ts";
import { createHttpHandlers } from "../http.ts";
import { createAppServices } from "./app.ts";
import { createConnectionService } from "./connections.ts";

const FUTURE_EXP = 4102444800;
const GH_TOKEN = "gho_FIXTURE_TOKEN_abcdef1234567890";
const ADO_LOGIN = "ada@contoso.com";
const GH_LOGIN = "octocat";

function jwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

function unused(name: string) {
  return async () => {
    throw new Error(`unexpected ${name}`);
  };
}

function fakeRepos() {
  return {
    listReviews: unused("listReviews"),
    getReview: unused("getReview"),
    addReview: unused("addReview"),
    addReviewFromTool: unused("addReviewFromTool"),
    upsertReview: unused("upsertReview"),
    upsertReviewFromTool: unused("upsertReviewFromTool"),
    removeReview: unused("removeReview"),
    setActive: unused("setActive"),
    chapterReview: unused("chapterReview"),
    seedIfEmpty: unused("seedIfEmpty"),
    replaceCatalog: unused("replaceCatalog"),
    queueAction: unused("queueAction"),
    waitForAction: unused("waitForAction"),
    completeAction: unused("completeAction"),
    publishReviewOutcome: unused("publishReviewOutcome"),
  };
}

function connectedRunner(adoToken: string): CommandRunner {
  return {
    async run(request: CommandRunRequest) {
      if (request.argv[0] === "az") {
        return {
          code: 0,
          stdout: JSON.stringify({ accessToken: adoToken, tokenType: "Bearer" }),
          stderr: "",
          timedOut: false,
          commandMissing: false,
        };
      }
      if (request.argv[2] === "token") {
        return {
          code: 0,
          stdout: GH_TOKEN,
          stderr: "",
          timedOut: false,
          commandMissing: false,
        };
      }
      return {
        code: 0,
        stdout: `github.com\n  ✓ Logged in to github.com account ${GH_LOGIN} (keyring)\n`,
        stderr: "",
        timedOut: false,
        commandMissing: false,
      };
    },
  };
}

test("connection list reports ADO and GitHub independently without tokens", async () => {
  const adoToken = jwt({ unique_name: ADO_LOGIN, exp: FUTURE_EXP });
  const credentials = createCliCredentialSource({ runner: connectedRunner(adoToken) });
  const service = createConnectionService(credentials);
  const listed = await service.list();
  ConnectionList.parse(listed);
  assert.deepEqual(listed.connections, [
    {
      provider: "azure-devops",
      host: "dev.azure.com",
      status: "connected",
      login: ADO_LOGIN,
    },
    {
      provider: "github",
      host: "github.com",
      status: "connected",
      login: GH_LOGIN,
    },
  ]);
  const dumped = JSON.stringify(listed);
  assert.equal(dumped.includes(adoToken), false);
  assert.equal(dumped.includes(GH_TOKEN), false);
  assert.equal(dumped.includes("accessToken"), false);
  assert.equal(dumped.includes("token"), false);
});

test("HTTP connections GET and Retry POST omit tokens from JSON", async () => {
  const adoToken = jwt({ unique_name: ADO_LOGIN, exp: FUTURE_EXP });
  const credentials: CredentialSource = createCliCredentialSource({
    runner: connectedRunner(adoToken),
  });
  const http = createHttpHandlers(createAppServices(fakeRepos(), { credentials }));
  const listed = await http.connections.GET();
  assert.equal(listed.status, 200);
  const body = await listed.json();
  const dumped = JSON.stringify(body);
  assert.equal(dumped.includes(adoToken), false);
  assert.equal(dumped.includes(GH_TOKEN), false);
  assert.equal(body.connections[0].login, ADO_LOGIN);
  assert.equal(body.connections[1].login, GH_LOGIN);

  const retried = await http.connections.POST({
    request: new Request("http://localhost/api/connections", { method: "POST" }),
    params: {},
  });
  assert.equal(retried.status, 200);
  const retryDump = JSON.stringify(await retried.json());
  assert.equal(retryDump.includes(adoToken), false);
  assert.equal(retryDump.includes(GH_TOKEN), false);
});
