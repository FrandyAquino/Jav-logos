import { defineConfig } from "vitest/config";
export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    include: ["tests/perf/*-perf.test.tsx", "tests/perf/quit-path.test.tsx"],
    environment: "jsdom",
    testTimeout: 180_000,
    fileParallelism: false,
  },
});
