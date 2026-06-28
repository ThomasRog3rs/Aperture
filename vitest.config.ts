import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // server-only throws when imported outside of a Next.js server context;
      // replace it with a no-op so unit tests can import server-only modules.
      "server-only": fileURLToPath(
        new URL("./tests/__mocks__/server-only.ts", import.meta.url)
      ),
    },
  },
  test: {
    environment: "jsdom",
    clearMocks: true,
    restoreMocks: true,
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
  },
});
