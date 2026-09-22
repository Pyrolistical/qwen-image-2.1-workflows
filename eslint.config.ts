import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import prettier from "eslint-plugin-prettier";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    plugins: {
      prettier,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
    rules: {
      "prettier/prettier": "error",
      "no-control-regex": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",

      curly: "error",
      eqeqeq: "error",
      "default-case-last": "error",
      "guard-for-in": "error",
      "logical-assignment-operators": "error",
      "no-implicit-coercion": "error",
      "no-lonely-if": "error",
      "no-nested-ternary": "error",
      "no-param-reassign": "error",
      "no-unneeded-ternary": "error",
      "no-useless-rename": "error",
      "object-shorthand": "error",
      "prefer-object-spread": "error",
      "prefer-promise-reject-errors": "error",
      "prefer-template": "error",

      "@typescript-eslint/class-methods-use-this": [
        "error",
        { ignoreClassesThatImplementAnInterface: "public-fields" },
      ],
      "@typescript-eslint/consistent-type-exports": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/default-param-last": "error",
      "@typescript-eslint/method-signature-style": "error",
      "@typescript-eslint/no-confusing-void-expression": [
        "error",
        { ignoreArrowShorthand: true },
      ],
      "@typescript-eslint/no-empty-function": [
        "error",
        { allow: ["arrowFunctions", "methods"] },
      ],
      "@typescript-eslint/no-import-type-side-effects": "error",
      "@typescript-eslint/no-shadow": "error",
      "@typescript-eslint/no-unnecessary-boolean-literal-compare": [
        "error",
        { allowComparingNullableBooleansToTrue: false },
      ],
      "@typescript-eslint/no-unnecessary-parameter-property-assignment":
        "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/parameter-properties": [
        "error",
        { prefer: "parameter-property" },
      ],
      "@typescript-eslint/prefer-readonly": "error",
      "@typescript-eslint/return-await": ["error", "always"],

      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportDeclaration[specifiers.length=0]",
          message: "Do not import for side effects. Import a name and call it.",
        },
        {
          selector:
            "ReturnStatement[argument.type='Identifier'][argument.name='undefined']",
          message:
            "Do not explicitly return undefined. Use a bare 'return;' instead.",
        },
        {
          selector:
            "BinaryExpression[left.property.name='length'][operator='==='][right.value=0]",
          message:
            "Do not use '.length === 0'. Use implicit falsy checks like '!x.length' instead.",
        },
        {
          selector:
            "MemberExpression[object.name=/^(describe|test|it)$/][property.name=/^(only|skip)$/]",
          message: "Do not commit focused or skipped tests (.only / .skip).",
        },
        {
          selector:
            "MemberExpression[object.type='MetaProperty'][property.name=/^(dir|file|path|main|require|env)$/]",
          message:
            "Do not use Bun import.meta properties. Use import.meta.dirname or import.meta.filename.",
        },
      ],
    },
  },
  {
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "Bun", message: "Use node: modules outside of tests." },
      ],
    },
  },
  eslintConfigPrettier,
);
