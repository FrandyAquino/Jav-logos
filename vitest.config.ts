import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";
export default mergeConfig(
  viteConfig,
  defineConfig({
    // Keep jsdom's origin-scoped storage authoritative on Node 25 as well as Node 24.
    test: { execArgv: ["--no-experimental-webstorage"] },
  }),
);
