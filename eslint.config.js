import { defineConfig, globalIgnores } from "eslint/config";
import reactDom from "eslint-plugin-react-dom";
import reactJsx from "eslint-plugin-react-jsx";
import reactX from "eslint-plugin-react-x";
import globals from "globals";
import tseslint from "typescript-eslint";

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
      tseslint.configs.base,

    ],
    // Only rules oxlint has no native equivalent for; everything else lives in .oxlintrc.json
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
