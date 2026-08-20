import assert from "node:assert/strict";
import { request, type Server } from "node:http";
import { test } from "node:test";
import app from "../app";
import { getAction1Readiness } from "./action1-recovery";
import { createRecoverySession } from "./recovery-session";

function requestReadiness(
  port: number,
  sessionToken: string,
): Promise<{ body: string; statusCode: number }> {
  return new Promise((resolve, reject) => {
    const clientRequest = request(
      {
        headers: { Cookie: `les_recovery_session=${sessionToken}` },
        hostname: "127.0.0.1",
        method: "GET",
        path: "/api/recovery/readiness",
        port,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          resolve({
            body: Buffer.concat(chunks).toString("utf8"),
            statusCode: response.statusCode ?? 0,
          });
        });
      },
    );
    clientRequest.on("error", reject);
    clientRequest.end();
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

test("readiness uses fresh credentials after an Action1 credential rotation", async () => {
  const originalFetch = globalThis.fetch;
  const originalClientId = process.env["ACTION1_CLIENT_ID"];
  const originalClientSecret = process.env["ACTION1_CLIENT_SECRET"];
  const tokenRequests: string[] = [];
  const authorizationHeaders: string[] = [];

  process.env["ACTION1_CLIENT_ID"] = "old-client-id";
  process.env["ACTION1_CLIENT_SECRET"] = "old-client-secret";
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("/oauth2/token")) {
      tokenRequests.push(String(init?.body));
      const usesRotatedCredentials = tokenRequests.at(-1)?.includes("new-client-id");
      return new Response(
        JSON.stringify({
          access_token: usesRotatedCredentials ? "new-access-token" : "old-access-token",
          expires_in: 3600,
        }),
        { headers: { "Content-Type": "application/json" }, status: 200 },
      );
    }

    const headers = new Headers(init?.headers);
    authorizationHeaders.push(headers.get("authorization") ?? "");
    if (url.includes("/organizations")) {
      return new Response(
        JSON.stringify({
          items: [{ id: "organization-1", name: "Test organization" }],
          total_items: 1,
        }),
        { headers: { "Content-Type": "application/json" }, status: 200 },
      );
    }
    return new Response(
      JSON.stringify({
        items: [{ id: "endpoint-1", name: "Test endpoint", OS: "Windows" }],
        total_items: 1,
      }),
      { headers: { "Content-Type": "application/json" }, status: 200 },
    );
  };

  try {
    const initialReadiness = await getAction1Readiness();
    assert.equal(initialReadiness.status, "READY");
    assert.equal(tokenRequests.length, 1);
    assert.equal(authorizationHeaders.at(-1), "Bearer old-access-token");

    process.env["ACTION1_CLIENT_ID"] = "new-client-id";
    process.env["ACTION1_CLIENT_SECRET"] = "new-client-secret";

    const rotatedReadiness = await getAction1Readiness();
    assert.equal(rotatedReadiness.status, "READY");
    assert.equal(tokenRequests.length, 2);
    assert.match(tokenRequests[0] ?? "", /old-client-id/);
    assert.match(tokenRequests[0] ?? "", /old-client-secret/);
    assert.match(tokenRequests[1] ?? "", /new-client-id/);
    assert.match(tokenRequests[1] ?? "", /new-client-secret/);
    assert.equal(authorizationHeaders.at(-1), "Bearer new-access-token");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalClientId === undefined) {
      delete process.env["ACTION1_CLIENT_ID"];
    } else {
      process.env["ACTION1_CLIENT_ID"] = originalClientId;
    }
    if (originalClientSecret === undefined) {
      delete process.env["ACTION1_CLIENT_SECRET"];
    } else {
      process.env["ACTION1_CLIENT_SECRET"] = originalClientSecret;
    }
  }
});

test("readiness route stays safe when Action1 read access is denied", async () => {
  const originalFetch = globalThis.fetch;
  const originalClientId = process.env["ACTION1_CLIENT_ID"];
  const originalClientSecret = process.env["ACTION1_CLIENT_SECRET"];
  const originalSessionSecret = process.env["SESSION_SECRET"];
  const clientSecret = "test-client-secret";

  process.env["ACTION1_CLIENT_ID"] = "test-client-id";
  process.env["ACTION1_CLIENT_SECRET"] = clientSecret;
  process.env["SESSION_SECRET"] = "test-session-secret";
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/oauth2/token")) {
      return new Response(
        JSON.stringify({ access_token: "test-access-token", expires_in: 3600 }),
        { headers: { "Content-Type": "application/json" }, status: 200 },
      );
    }
    return new Response(
      JSON.stringify({
        error: "forbidden",
        endpoint: "/organizations",
        coordinates: "51.5074,-0.1278",
      }),
      { headers: { "Content-Type": "application/json" }, status: 403 },
    );
  };

  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.once("listening", resolve);
    });
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const session = createRecoverySession();
    const response = await requestReadiness(address.port, session.token);
    const readiness = JSON.parse(response.body) as {
      checkedAt: string;
      message: string;
      status: string;
    };

    assert.equal(response.statusCode, 200);
    assert.equal(readiness.status, "NOT_READY");
    assert.equal(
      readiness.message,
      "Update the Action1 API credentials to grant recovery read access, then retry the readiness check.",
    );
    assert.match(readiness.checkedAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.doesNotMatch(
      response.body,
      /test-client-secret|test-access-token|organizations|51\.5074/,
    );
  } finally {
    await closeServer(server);
    globalThis.fetch = originalFetch;
    if (originalClientId === undefined) {
      delete process.env["ACTION1_CLIENT_ID"];
    } else {
      process.env["ACTION1_CLIENT_ID"] = originalClientId;
    }
    if (originalClientSecret === undefined) {
      delete process.env["ACTION1_CLIENT_SECRET"];
    } else {
      process.env["ACTION1_CLIENT_SECRET"] = originalClientSecret;
    }
    if (originalSessionSecret === undefined) {
      delete process.env["SESSION_SECRET"];
    } else {
      process.env["SESSION_SECRET"] = originalSessionSecret;
    }
  }
});