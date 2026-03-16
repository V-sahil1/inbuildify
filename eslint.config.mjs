import js from "@eslint/js";
import importPlugin from "eslint-plugin-import";

export default [
  js.configs.recommended,

  {
    plugins: {
      import: importPlugin,
    },

    rules: {
      /*
      |--------------------------------------------------------------------------
      | 🔥 Core JavaScript Safety
      |--------------------------------------------------------------------------
      */
      "no-console": "warn",
      "no-debugger": "warn",
      "no-alert": "warn",
      "no-var": "warn",
      "prefer-const": "warn",
      "eqeqeq": ["warn", "always"],
      "curly": ["warn", "all"],
      "no-duplicate-imports": "warn",
      "no-unreachable": "warn",
      "no-return-await": "off",
      "no-useless-catch": "off",
      "no-useless-return": "warn",
      "no-shadow": "warn",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],

      /*
      |--------------------------------------------------------------------------
      | 📦 Import Rules
      |--------------------------------------------------------------------------
      */
      "import/newline-after-import": ["error", { count: 1 }],
      "import/no-duplicates": "error",
      "import/order": [
        "warn",
        {
          groups: ["builtin", "external", "internal"],
          "newlines-between": "always",
        },
      ],

      /*
      |--------------------------------------------------------------------------
      | 🧼 Strict Spacing & Formatting
      |--------------------------------------------------------------------------
      */
      "indent": ["error", 2],
      "no-multi-spaces": "error",
      "no-trailing-spaces": "error",
      "no-multiple-empty-lines": [
        "error",
        { max: 1, maxEOF: 0, maxBOF: 0 },
      ],
      "no-irregular-whitespace": "warn",
      "eol-last": ["warn", "always"],
      "object-shorthand": "warn",
      "prefer-template": "warn",
      "no-else-return": ["warn", { allowElseIf: false }],
      "no-lonely-if": "warn",
      "no-nested-ternary": "error",
      "no-unneeded-ternary": "error",

      "space-before-blocks": "error",
      "brace-style": ["error", "1tbs", { allowSingleLine: false }],
      "key-spacing": ["error", { beforeColon: false, afterColon: true }],
      "keyword-spacing": ["error", { before: true, after: true }],
      "space-before-function-paren": [
        "error",
        {
          anonymous: "always",
          named: "never",
          asyncArrow: "always",
        },
      ],
      "space-in-parens": ["error", "never"],
      "object-curly-spacing": ["error", "always"],
      "space-infix-ops": "error",
      "comma-spacing": ["error", { before: false, after: true }],
      "arrow-spacing": ["error", { before: true, after: true }],

      /*
      |--------------------------------------------------------------------------
      | ⚡ Best Practice Rules
      |--------------------------------------------------------------------------
      */
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-loop-func": "warn",
      "no-new-func": "error",
      "no-new-wrappers": "error",
      "no-useless-concat": "warn",
      "no-useless-call": "warn",
      "no-useless-computed-key": "warn",
      "no-useless-rename": "warn",
      "no-useless-escape": "warn",

      /*
      |--------------------------------------------------------------------------
      | 🔐 Error Prevention
      |--------------------------------------------------------------------------
      */
      "no-undef": "error",
      "no-redeclare": "error",
      "no-duplicate-case": "error",
      "no-empty": "warn",
      "no-extra-boolean-cast": "warn",
      "no-fallthrough": "warn",
      "no-constant-condition": "warn",
      "no-prototype-builtins": "warn",

      /*
      |--------------------------------------------------------------------------
      | 📏 Code Style
      |--------------------------------------------------------------------------
      */
      "consistent-return": "warn",
      "dot-notation": "warn",
      "no-extra-semi": "error",
      "semi": ["error", "always"],
      "quotes": ["error", "double"],
      "comma-dangle": ["warn", "always-multiline"],
    },
  },
];
