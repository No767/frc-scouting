import pluginRouter from "@tanstack/eslint-plugin-router";
import eslintPluginBetterTailwindcss from "eslint-plugin-better-tailwindcss";
import oxlint from "eslint-plugin-oxlint";
import reactDom from "eslint-plugin-react-dom";
import reactJsx from "eslint-plugin-react-jsx";
import reactX from "eslint-plugin-react-x";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores([
    "node_modules",
    "dist",

    // Automatically generated code
    "src/routeTree.gen.ts",

    // Shadcn/ui components
    "src/components/ui",
  ]),

  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      tseslint.configs.base,

      eslintPluginBetterTailwindcss.configs.recommended,
      pluginRouter.configs["flat/recommended"],

      oxlint.configs["flat/recommended"],
    ],
    plugins: {
      "react-dom": reactDom,
      "react-jsx": reactJsx,
      "react-x": reactX,
    },
    rules: {
      "react-dom/no-use-form-state": "error",
      "react-jsx/no-leaked-dollar": "error",
      "react-jsx/no-leaked-semicolon": "error",
      "react-x/no-context-provider": "error",
      "react-x/no-create-ref": "error",
      "react-x/no-forward-ref": "error",
      "react-x/no-use-context": "error",

      // TailwindCSS - Oxfmt handles these already
      "better-tailwindcss/enforce-consistent-class-order": "off",
      "better-tailwindcss/enforce-consistent-line-wrapping": "off",
      "better-tailwindcss/no-unnecessary-whitespace": "off",
    },
    settings: {
      "better-tailwindcss": {
        cwd: import.meta.dirname,
        entryPoint: "src/styles.css",
      },
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
]);
