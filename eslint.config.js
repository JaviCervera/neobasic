import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["dist/**", "node_modules/**", "tests/integration/fixtures/**/*.js"],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // QJS shims reference QuickJS-specific globals and esbuild-injected names.
    files: ["src/shims/**"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",   // injected by esbuild --inject at bundle time
        scriptArgs: "readonly", // QuickJS built-in global
      },
    },
  },
);
