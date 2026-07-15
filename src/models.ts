export type RunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "timeout"
  | "error"
  | "killed";

const TERMINAL: ReadonlySet<string> = new Set([
  "completed",
  "failed",
  "timeout",
  "error",
  "killed",
]);

/** A sandbox execution. */
export class Run {
  constructor(
    public readonly runId: number,
    public readonly status: string,
    public readonly language: string,
    public readonly exitCode: number | null,
    public readonly durationMs: number | null,
    public readonly output: string | null,
    public readonly createdAt: string | null,
  ) {}

  /** True once the run has finished (in any terminal state). */
  get isTerminal(): boolean {
    return TERMINAL.has(this.status);
  }

  /** True when the run completed with a zero exit code. */
  get succeeded(): boolean {
    return this.status === "completed" && (this.exitCode === 0 || this.exitCode === null);
  }

  static fromJSON(data: Record<string, unknown>): Run {
    return new Run(
      data.run_id as number,
      data.status as string,
      data.language as string,
      (data.exit_code as number | null) ?? null,
      (data.duration_ms as number | null) ?? null,
      (data.output as string | null) ?? null,
      (data.created_at as string | null) ?? null,
    );
  }
}
