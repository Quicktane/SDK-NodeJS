import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  QuickTane,
  RateLimitError,
  ValidationError,
  verifySignature,
} from "../src/index";

type Handler = (url: string, init: RequestInit) => { status: number; body: unknown };

function mockFetch(handler: Handler): typeof fetch {
  return (async (url: string, init: RequestInit) => {
    const { status, body } = handler(url, init);
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

const runBody = (overrides: Record<string, unknown> = {}) => ({
  run_id: 1,
  status: "running",
  language: "python",
  exit_code: null,
  duration_ms: null,
  output: null,
  created_at: "2026-07-15T12:00:00+00:00",
  ...overrides,
});

describe("QuickTane", () => {
  it("runAndWait polls until terminal", async () => {
    let polls = 0;
    const qt = new QuickTane("sk_test", {
      baseUrl: "https://api.example.com",
      fetch: mockFetch((_url, init) => {
        if (init.method === "POST") {
          return { status: 202, body: runBody() };
        }
        polls += 1;
        return {
          status: 200,
          body: runBody({
            status: polls >= 2 ? "completed" : "running",
            exit_code: 0,
            duration_ms: 4247,
            output: "42\n",
          }),
        };
      }),
    });

    const run = await qt.runAndWait("print(42)", "python", { pollInterval: 0 });

    expect(run.status).toBe("completed");
    expect(run.succeeded).toBe(true);
    expect(run.output).toBe("42\n");
    expect(run.durationMs).toBe(4247);
  });

  it("throws RateLimitError on 429", async () => {
    const qt = new QuickTane("sk_test", {
      baseUrl: "https://x",
      fetch: mockFetch(() => ({ status: 429, body: { message: "Too many" } })),
    });
    await expect(qt.run("x")).rejects.toBeInstanceOf(RateLimitError);
  });

  it("throws ValidationError on 422", async () => {
    const qt = new QuickTane("sk_test", {
      baseUrl: "https://x",
      fetch: mockFetch(() => ({
        status: 422,
        body: { message: "Validation failed", errors: { code: ["required"] } },
      })),
    });
    await expect(qt.run("")).rejects.toBeInstanceOf(ValidationError);
  });

  it("verifies webhook signatures", () => {
    const secret = "whsec_abc";
    const body = '{"type":"run.completed"}';
    const sig = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");

    expect(verifySignature(body, sig, secret)).toBe(true);
    expect(verifySignature(body, "sha256=deadbeef", secret)).toBe(false);
    expect(verifySignature(body, "", secret)).toBe(false);
  });
});
