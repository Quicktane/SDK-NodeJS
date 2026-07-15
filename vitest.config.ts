import { defineConfig } from "vitest/config";

// Own config so vitest doesn't walk up into the parent Laravel app's vite config.
export default defineConfig({
  test: {
    root: __dirname,
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
