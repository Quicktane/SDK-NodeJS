import { raiseForStatus } from "./errors";
import { Run } from "./models";
import { Sandbox } from "./sandbox";

const DEFAULT_BASE_URL = "https://api.quicktane.com";
const VERSION = "0.1.0";

export interface QuickTaneOptions {
  apiKey?: string;
  baseUrl?: string;
  /** HTTP request timeout in milliseconds (default 30000). */
  timeout?: number;
  /** Custom fetch implementation (defaults to the global `fetch`). */
  fetch?: typeof fetch;
}

export interface RunOptions {
  /** Sandbox time limit in seconds (default 30). */
  timeout?: number;
}

export interface RunAndWaitOptions extends RunOptions {
  /** Milliseconds between status polls (default 1000). */
  pollInterval?: number;
  /** Give up after this many milliseconds (default 300000). */
  maxWait?: number;
}

export class QuickTane {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(apiKey?: string, options: QuickTaneOptions = {}) {
    const key = apiKey ?? options.apiKey ?? process.env.QUICKTANE_API_KEY;

    if (!key) {
      throw new Error(
        "A QuickTane API key is required. Pass it in or set QUICKTANE_API_KEY.",
      );
    }

    this.apiKey = key;
    this.baseUrl = (
      options.baseUrl ??
      process.env.QUICKTANE_BASE_URL ??
      DEFAULT_BASE_URL
    ).replace(/\/+$/, "");
    this.timeoutMs = options.timeout ?? 30_000;
    this.fetchImpl = options.fetch ?? globalThis.fetch;

    if (!this.fetchImpl) {
      throw new Error(
        "Global fetch is not available. Upgrade to Node 18+ or pass a `fetch` implementation.",
      );
    }
  }

  /** Queue a sandbox run and return immediately (status is usually `running`). */
  async run(code: string, language = "python", options: RunOptions = {}): Promise<Run> {
    const response = await this.request("POST", "/run", {
      language,
      code,
      timeout: options.timeout ?? 30,
    });

    return Run.fromJSON(await response.json());
  }

  /** Fetch the current state of a run. */
  async getRun(runId: number | string): Promise<Run> {
    const response = await this.request("GET", `/runs/${runId}`);

    return Run.fromJSON(await response.json());
  }

  /** Queue a run and poll until it reaches a terminal state, then return it. */
  async runAndWait(
    code: string,
    language = "python",
    options: RunAndWaitOptions = {},
  ): Promise<Run> {
    const pollInterval = options.pollInterval ?? 1000;
    const maxWait = options.maxWait ?? 300_000;

    let run = await this.run(code, language, { timeout: options.timeout });
    const start = Date.now();

    while (!run.isTerminal) {
      if (Date.now() - start >= maxWait) {
        throw new Error(`Run ${run.runId} did not finish within ${maxWait}ms`);
      }

      await sleep(pollInterval);
      run = await this.getRun(run.runId);
    }

    return run;
  }

  /** Start a live interactive session and (by default) wait until it is ready. */
  async createSandbox(
    language = "python",
    options: { wait?: boolean; pollInterval?: number; maxWait?: number } = {},
  ): Promise<Sandbox> {
    const data = await this.json("POST", "/sessions", { language });
    const sandbox = new Sandbox(this, data.session_id, data.language, data.status);

    if (options.wait ?? true) {
      await sandbox.waitReady(options.pollInterval ?? 1000, options.maxWait ?? 120_000);
    }

    return sandbox;
  }

  /** Reconnect to an existing session by id. */
  async getSandbox(sessionId: number): Promise<Sandbox> {
    const data = await this.json("GET", `/sessions/${sessionId}`);

    return new Sandbox(this, data.session_id, data.language, data.status);
  }

  /** @internal — JSON request/response helper used by sessions. */
  async json(method: string, path: string, data?: Record<string, unknown>): Promise<Record<string, any>> {
    let url = path;
    let body: unknown;

    if (method === "GET") {
      if (data && Object.keys(data).length > 0) {
        url = `${path}?${new URLSearchParams(data as Record<string, string>).toString()}`;
      }
    } else if (data !== undefined) {
      body = data;
    }

    const response = await this.request(method, url, body);
    const text = await response.text();

    return text ? JSON.parse(text) : {};
  }

  private async request(method: string, path: string, body?: unknown): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;

    try {
      response = await this.fetchImpl(`${this.baseUrl}/v1${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/json",
          "User-Agent": `quicktane-node/${VERSION}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    await raiseForStatus(response);

    return response;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
