import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

import js from "@eslint/js";
import unicorn from 'eslint-plugin-unicorn';
import { importX } from 'eslint-plugin-import-x'
import reactDom from "eslint-plugin-react-dom";
import reactX from "eslint-plugin-react-x"
import reactJsx from "eslint-plugin-react-jsx"
import reactNamingConvention from "eslint-plugin-react-naming-convention";
import reactPerfPlugin from "eslint-plugin-react-perf"
import jsxA11y from "eslint-plugin-jsx-a11y"
import pluginPromise from 'eslint-plugin-promise'

export default defineConfig([
  globalIgnores([
    "node_modules",
    "dist",


    // Automatically generated code
    "src/routeTree.gen.ts",

    // Shadcn/ui components
    "src/components/ui"
  ]),

  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,

      unicorn.configs.recommended,
      importX.flatConfigs["recommended"],
      reactDom.configs.strict,
      reactX.configs["strict"],
      reactJsx.configs.strict,
      reactNamingConvention.configs.recommended,
      reactPerfPlugin.configs.flat.all,
      jsxA11y.flatConfigs.recommended,
      pluginPromise.configs["flat/recommended"]
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        parser: tseslint.parser,
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
]);
