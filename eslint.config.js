import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  // `.claude/worktrees/*` holds full repo checkouts created by tooling —
  // don't lint those copies (and don't double-report the real src).
  globalIgnores(["dist", ".claude"]),
  {
    files: ["**/*.{js,jsx}"],
    extends: [
      js.configs.recommended,
      // react-hooks v7 moved flat configs under `configs.flat.*`; the
      // top-level `recommended-latest` is the legacy (eslintrc) shape with
      // `plugins: ["react-hooks"]`, which flat config rejects.
      reactHooks.configs.flat["recommended-latest"],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: "latest",
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    rules: {
      "no-unused-vars": [
        "warn",
        {
          varsIgnorePattern: "^[A-Z_]",
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "no-undef": "error",
      // React Compiler readiness rule. In this codebase the flagged sites are
      // legitimate (DOM measurement/positioning, timed UI highlights, chart
      // init, one-time onboarding triggers) where setState-in-effect is the
      // correct pattern; true derived-state anti-patterns are fixed at source.
      // Keep it visible as a warning rather than blocking. (The compiler bails
      // on these components at runtime regardless of lint severity.)
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    files: ["vite.config.js"],
    languageOptions: {
      globals: {
        process: "readonly",
      },
    },
  },
]);
