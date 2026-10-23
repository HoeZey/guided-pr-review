import assert from "node:assert/strict";
import { test } from "node:test";
import type { CredentialResult, CommandRunRequest, CommandRunner } from "./ports.ts";
import { ADO_RESOURCE, createCliCredentialSource } from "./cli-credentials.ts";

const FUTURE_EXP = 4102444800;
const PAST_EXP = 1_000_000_000;
const GH_TOKEN = "gho_FIXTURE_TOKEN_abcdef1234567890";
const ADO_LOGIN = "ada@contoso.com";
const GH_LOGIN = "octocat";

function jwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

function adoStdout(token: string): string {
  return JSON.stringify({ accessToken: token, tokenType: "Bearer" });
}

function ghStatus(login: string): string {
  return `github.com\n  ✓ Logged in to github.com account ${login} (keyring)\n  - Active account: true\n`;
}

function recordingRunner(
  script: (request: CommandRunRequest) => Partial<CommandRunResult> | Promise<Partial<CommandRunResult>>,
): CommandRunner & { argvLog: string[][] } {
  const argvLog: string[][] = [];
  return {
    argvLog,
    async run(request) {
      argvLog.push([...request.argv]);
      const result = await script(request);
      return {
        code: 0,
        stdout: "",
        stderr: "",
        timedOut: false,
        commandMissing: false,
        ...result,
      };
    },
  };
}

type CommandRunResult = import("./ports.ts").CommandRunResult;

function dumpPublic(result: CredentialResult): string {
  if (result.status === "connected") {
    const { token: _token, ...rest } = result;
    return JSON.stringify(rest);
  }
  return JSON.stringify(result);
}

test("reports one ADO and one GitHub identity independently", async () => {
  const adoToken = jwt({ unique_name: ADO_LOGIN, exp: FUTURE_EXP });
  const runner = recordingRunner((request) => {
    if (request.argv[0] === "az") return { stdout: adoStdout(adoToken) };
    if (request.argv[2] === "token") return { stdout: `${GH_TOKEN}\n` };
    if (request.argv[2] === "status") return { stdout: ghStatus(GH_LOGIN) };
    throw new Error(`unexpected argv ${request.argv.join(" ")}`);
  });
  const source = createCliCredentialSource({ runner });

  const ado = await source.getAccessToken({ provider: "azure-devops", host: "dev.azure.com" });
  const github = await source.getAccessToken({ provider: "github", host: "github.com" });

  assert.equal(ado.status, "connected");
  if (ado.status === "connected") {
    assert.deepEqual(ado.identity, {
      provider: "azure-devops",
      host: "dev.azure.com",
      login: ADO_LOGIN,
    });
    assert.equal(ado.token, adoToken);
  }
  assert.equal(github.status, "connected");
  if (github.status === "connected") {
    assert.deepEqual(github.identity, {
      provider: "github",
      host: "github.com",
      login: GH_LOGIN,
    });
    assert.equal(github.token, GH_TOKEN);
  }

  assert.ok(runner.argvLog.some((argv) => argv.join(" ") === `az account get-access-token --resource ${ADO_RESOURCE} --output json`));
  assert.ok(runner.argvLog.some((argv) => argv.join(" ") === "gh auth token --hostname github.com"));
  assert.ok(runner.argvLog.some((argv) => argv.join(" ") === "gh auth status --hostname github.com"));
  assert.equal(
    runner.argvLog.some((argv) => argv.includes("--show-token") || argv.includes(adoToken) || argv.includes(GH_TOKEN)),
    false,
  );
  assert.equal(dumpPublic(ado).includes(adoToken), false);
  assert.equal(dumpPublic(github).includes(GH_TOKEN), false);
});

test("maps fake CLI outcomes onto every credential status", async () => {
  const adoToken = jwt({ unique_name: ADO_LOGIN, exp: FUTURE_EXP });
  const rows: Array<{
    name: string;
    provider: "azure-devops" | "github";
    result: Partial<CommandRunResult>;
    status: CredentialResult["status"];
    recovery: string;
  }> = [
    {
      name: "command-missing",
      provider: "azure-devops",
      result: { commandMissing: true, code: null },
      status: "command-missing",
      recovery: "az login",
    },
    {
      name: "login-required",
      provider: "azure-devops",
      result: { code: 1, stderr: "Please run 'az login' to setup account." },
      status: "login-required",
      recovery: "az login",
    },
    {
      name: "expired",
      provider: "azure-devops",
      result: { code: 1, stderr: "AADSTS700082: The refresh token has expired due to inactivity." },
      status: "expired",
      recovery: "az login",
    },
    {
      name: "denied-scope",
      provider: "azure-devops",
      result: { code: 1, stderr: "AADSTS65001: The user or administrator has not consented to use the application." },
      status: "denied-scope",
      recovery: "az login",
    },
    {
      name: "timeout",
      provider: "github",
      result: { timedOut: true, code: null },
      status: "timeout",
      recovery: "gh auth login",
    },
    {
      name: "ado-malformed",
      provider: "azure-devops",
      result: { code: 0, stdout: "{}" },
      status: "malformed",
      recovery: "az login",
    },
    {
      name: "malformed",
      provider: "github",
      result: { code: 0, stdout: "not-a-token-or-status" },
      status: "malformed",
      recovery: "gh auth login",
    },
    {
      name: "gh-login-required",
      provider: "github",
      result: { code: 1, stderr: "You are not logged into any GitHub hosts. Run gh auth login to authenticate." },
      status: "login-required",
      recovery: "gh auth login",
    },
    {
      name: "gh-denied-scope",
      provider: "github",
      result: { code: 1, stderr: "missing required scope: repo" },
      status: "denied-scope",
      recovery: "gh auth login",
    },
  ];

  for (const row of rows) {
    const runner = recordingRunner(() => row.result);
    const source = createCliCredentialSource({ runner });
    const host = row.provider === "azure-devops" ? "dev.azure.com" : "github.com";
    const got = await source.getAccessToken({ provider: row.provider, host });
    assert.equal(got.status, row.status, row.name);
    if (got.status !== "connected") {
      assert.equal(got.recovery, row.recovery, row.name);
      assert.equal(got.provider, row.provider, row.name);
      assert.equal(got.host, host, row.name);
      assert.equal("token" in got, false, row.name);
    }
  }

  const expiredJwt = jwt({ unique_name: ADO_LOGIN, exp: PAST_EXP });
  const expiredSource = createCliCredentialSource({
    runner: recordingRunner(() => ({ stdout: adoStdout(expiredJwt) })),
    now: () => PAST_EXP * 1000 + 1000,
  });
  const expired = await expiredSource.getAccessToken({
    provider: "azure-devops",
    host: "dev.azure.com",
  });
  assert.equal(expired.status, "expired");
  if (expired.status !== "connected") assert.equal(expired.recovery, "az login");
  assert.equal(JSON.stringify(expired).includes(expiredJwt), false);

  const connectedSource = createCliCredentialSource({
    runner: recordingRunner(() => ({ stdout: adoStdout(adoToken) })),
  });
  const connected = await connectedSource.getAccessToken({
    provider: "azure-devops",
    host: "dev.azure.com",
  });
  assert.equal(connected.status, "connected");
});

test("shares in-flight token requests per provider host", async () => {
  let running = 0;
  let peak = 0;
  let adoStarts = 0;
  const runner: CommandRunner = {
    async run(request) {
      running += 1;
      peak = Math.max(peak, running);
      if (request.argv[0] === "az") adoStarts += 1;
      await new Promise((resolve) => setTimeout(resolve, 40));
      running -= 1;
      if (request.argv[0] === "az") {
        return {
          code: 0,
          stdout: adoStdout(jwt({ unique_name: ADO_LOGIN, exp: FUTURE_EXP })),
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
        stdout: ghStatus(GH_LOGIN),
        stderr: "",
        timedOut: false,
        commandMissing: false,
      };
    },
  };
  const source = createCliCredentialSource({ runner });
  const [a, b, c, d] = await Promise.all([
    source.getAccessToken({ provider: "azure-devops", host: "dev.azure.com" }),
    source.getAccessToken({ provider: "azure-devops", host: "dev.azure.com" }),
    source.getAccessToken({ provider: "github", host: "github.com" }),
    source.getAccessToken({ provider: "github", host: "github.com" }),
  ]);
  assert.equal(a.status, "connected");
  assert.equal(b.status, "connected");
  assert.equal(c.status, "connected");
  assert.equal(d.status, "connected");
  assert.equal(adoStarts, 1);
  assert.equal(a, b);
  assert.equal(c, d);
  assert.ok(peak <= 2);
});
