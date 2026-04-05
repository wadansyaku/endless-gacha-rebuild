import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const fromRoot = (relativePath: string) => fileURLToPath(new URL(relativePath, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@endless-gacha/shared": fromRoot("./packages/shared/src/index.ts"),
      "@endless-gacha/game-core": fromRoot("./packages/game-core/src/index.ts"),
      "@endless-gacha/game-data": fromRoot("./packages/game-data/src/index.ts"),
      "@endless-gacha/firebase-adapter": fromRoot("./packages/firebase-adapter/src/index.ts"),
      "@endless-gacha/ui": fromRoot("./packages/ui/src/index.ts")
    }
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["packages/**/*.test.ts", "apps/web/src/**/*.test.ts?(x)"],
    setupFiles: ["./apps/web/src/test/setup.ts"]
  }
});
