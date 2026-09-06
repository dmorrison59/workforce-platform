import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["tests/**/*.test.ts"], maxWorkers: 1 },
  resolve: { alias: {
    "@": fileURLToPath(new URL("./src", import.meta.url)),
    "@yardclock/database": fileURLToPath(new URL("../../src/types/database.ts", import.meta.url)),
  } },
});
