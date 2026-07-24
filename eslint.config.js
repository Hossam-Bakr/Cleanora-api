/**
 * @desc ESLint flat config for Cleanora CommonJS TypeScript.
 * @access Maintainer tooling
 * @explanation Keeps lint rules aligned with NodeNext/CommonJS without forcing ESM.
 */
const js = require("@eslint/js");
const tseslint = require("typescript-eslint");

module.exports = tseslint.config(
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
      "src/generated/**",
      "**/*.md"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,cjs,mjs}"],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2024,
        sourceType: "module"
      }
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ]
    }
  }
);
