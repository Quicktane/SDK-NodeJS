# QuickTane Node SDK

Run code in isolated, ephemeral cloud sandboxes ([QuickTane](https://quicktane.com)) — one API call. TypeScript-native, zero runtime dependencies (uses the built-in `fetch`).

```bash
npm install @quicktane/sdk
```

Requires Node 18+.

## Quickstart

```ts
import { QuickTane } from "@quicktane/sdk";

const qt = new QuickTane("sk_live_...");        // or set QUICKTANE_API_KEY

const run = await qt.runAndWait("print('hello from the sandbox')", "python");

console.log(run.status);    // "completed"
console.log(run.output);    // "hello from the sandbox\n"
console.log(run.exitCode);  // 0
```

Supported languages: `python`, `node`.

## Fire-and-forget + webhooks

```ts
const run = await qt.run("console.log(2 + 2)", "node");
console.log(run.runId, run.status); // 42 "running"

const finished = await qt.getRun(run.runId);
```

Register a webhook endpoint in your dashboard, then verify deliveries with the **raw** body:

```ts
import { verifySignature } from "@quicktane/sdk";

if (!verifySignature(rawBody, req.headers["x-quicktane-signature"], signingSecret)) {
  return res.status(400).end();
}
```

## Configuration

```ts
new QuickTane(apiKey, {
  baseUrl,          // override the API base (e.g. "http://localhost:8000" for local dev)
  timeout,          // HTTP request timeout in ms (default 30000)
});
```

`apiKey` falls back to `QUICKTANE_API_KEY`; `baseUrl` to `QUICKTANE_BASE_URL`.

## Errors

All errors extend `QuickTaneError`: `AuthenticationError` (401/403), `NotFoundError` (404),
`ValidationError` (422), `RateLimitError` (429), `APIError` (other). Each carries
`.statusCode` and `.body`.

## Development

```bash
pnpm install
pnpm test     # vitest
pnpm build    # tsup → dist (ESM + CJS + types)
```

MIT licensed.
