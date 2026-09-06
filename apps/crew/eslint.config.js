const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  ...expoConfig,
  {
    ignores: [".expo/**", "dist/**"],
  },
  {
    files: ["src/lib/hours-presentation.ts", "src/lib/schedule-presentation.ts"],
    // TypeScript, Vitest, and Metro verify this external workspace alias. The
    // import resolver cannot traverse that Windows path inside the sandbox.
    rules: { "import/no-unresolved": "off" },
  },
]);
