import js from "@eslint/js";
import typescript from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import prettier from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";
import customRules from "./tools/eslint-rules/index.js";

export default [
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: {
      "@typescript-eslint": typescript,
      prettier: prettier,
      custom: customRules,
    },
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: [
          "./tsconfig.json",
          "./apps/*/tsconfig.json",
          "./packages/*/tsconfig.json",
        ],
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        React: "readonly",
        JSX: "readonly",
        HTMLElement: "readonly",
        HTMLFormElement: "readonly",
        FormData: "readonly",
      },
    },
    rules: {
      ...typescript.configs.recommended.rules,
      ...prettierConfig.rules,
      "prettier/prettier": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/no-require-imports": "off",

      // 動的インポートを制限（特定のファイルは除外）
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportExpression",
          message:
            "Dynamic imports are not allowed. Use static imports instead.",
        },
      ],

      // 特定のパスからの再エクスポートを制限
      "no-restricted-exports": [
        "error",
        {
          restrictDefaultExports: {
            direct: false,
            named: false,
            defaultFrom: false,
            namedFrom: false,
            namespaceFrom: false,
          },
        },
      ],

      "custom/no-scattered-types": [
        "error",
        {
          allowedPaths: [
            "packages/shared/src/types",
            "packages/remote-api-types/src",
            "tools/eslint-rules",
            ".d.ts",
            "packages/ui/src",
          ],
          allowComponentProps: true,
          allowedPatterns: [
            ".*\\.d\\.ts$",
            ".*\\.test\\.ts$",
            ".*\\.spec\\.ts$",
          ],
        },
      ],

      // 型の再エクスポートを制限
      "custom/no-type-reexport": "error",
    },
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    plugins: {
      prettier: prettier,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      ...prettierConfig.rules,
      "prettier/prettier": "error",
    },
  },
  {
    // 動的インポートを許可する特定のファイル
    files: ["**/src/main.ts", "**/src/main/**/*.ts", "**/mcp-http-server.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  {
    // remote-api-types package specific overrides
    files: ["packages/remote-api-types/**/*.ts"],
    rules: {
      "custom/no-type-reexport": "off",
    },
  },
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/out/**",
      "**/.webpack/**",
      "**/coverage/**",
      "**/.turbo/**",
      "**/build/**",
      "**/.next/**",
      "**/public/**",
      "**/*.min.js",
      "**/*.d.ts",
      "**/forge.config.ts",
      "**/.eslintrc.json",
    ],
  },
];
