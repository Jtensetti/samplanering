import { defineConfig } from "vitest/config";
import { cloudflareTest } from "@cloudflare/vitest-plugin";
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: { bindings: { FIREBASE_API_KEY: "test-public-key" } },
    }),
  ],
  test: {
    include: ["tests/worker/**/*.test.mjs"],
    testTimeout: 30000,
    fileParallelism: false,
  },
});
