import type { QuickTane } from "./client";

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  /** True when the command completed with a zero exit code. */
  ok: boolean;
}

export interface ExecOptions {
  language?: string;
  timeout?: number;
}

const TERMINAL = new Set(["stopped", "error"]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Filesystem access for a session workspace. */
export class Files {
  constructor(private readonly sandbox: Sandbox) {}

  async write(path: string, content: string): Promise<void> {
    await this.sandbox.request("POST", "/files", { path, content });
  }

  async read(path: string): Promise<string> {
    const data = await this.sandbox.request("GET", "/files", { path });

    return (data.content as string) ?? "";
  }
}

/** A live interactive session — run many commands in one persistent environment. */
export class Sandbox {
  readonly files: Files;

  constructor(
    private readonly client: QuickTane,
    public readonly sessionId: number,
    public readonly language: string,
    public status: string,
  ) {
    this.files = new Files(this);
  }

  /** Run code (in the session language, or `options.language`) in the sandbox. */
  async exec(code: string, options: ExecOptions = {}): Promise<ExecResult> {
    return this.run({
      language: options.language ?? this.language,
      code,
      timeout: options.timeout ?? 30,
    });
  }

  /** Run a shell command in the sandbox. */
  async execCommand(command: string, options: { timeout?: number } = {}): Promise<ExecResult> {
    return this.run({ command, timeout: options.timeout ?? 30 });
  }

  /** Stop the session and free its pod. */
  async kill(): Promise<void> {
    await this.request("DELETE", "");
    this.status = "stopped";
  }

  private async run(payload: Record<string, unknown>): Promise<ExecResult> {
    const data = await this.request("POST", "/exec", payload);
    const exitCode = (data.exit_code ?? null) as number | null;
    const timedOut = Boolean(data.timed_out);

    return {
      stdout: (data.stdout as string) ?? "",
      stderr: (data.stderr as string) ?? "",
      exitCode,
      timedOut,
      ok: exitCode === 0 && !timedOut,
    };
  }

  /** @internal */
  async waitReady(pollInterval: number, maxWait: number): Promise<void> {
    const start = Date.now();

    while (this.status !== "ready" && !TERMINAL.has(this.status)) {
      if (Date.now() - start >= maxWait) {
        throw new Error(`Session ${this.sessionId} was not ready within ${maxWait}ms`);
      }

      await sleep(pollInterval);
      const data = await this.client.json("GET", `/sessions/${this.sessionId}`);
      this.status = data.status as string;
    }

    if (this.status !== "ready") {
      throw new Error(`Session ${this.sessionId} entered status "${this.status}"`);
    }
  }

  /** @internal */
  request(method: string, path: string, data?: Record<string, unknown>): Promise<Record<string, any>> {
    return this.client.json(method, `/sessions/${this.sessionId}${path}`, data);
  }
}
