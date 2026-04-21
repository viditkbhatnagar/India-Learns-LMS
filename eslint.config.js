import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import globals from 'globals';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.vite/**',
      '**/coverage/**',
      'webapp/**',
      'mobile/**',
      'claude-code-docs/**',
      '**/*.tsbuildinfo',
    ],
  },
  js.configs.recommended,
  ...compat.extends('airbnb-base'),
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
    settings: {
      'import/resolver': {
        typescript: { project: ['./api/tsconfig.json', './web/tsconfig.json', './packages/shared-types/tsconfig.json'] },
      },
    },
    rules: {
      'import/extensions': 'off',
      'import/prefer-default-export': 'off',
      'import/no-extraneous-dependencies': 'off',
      'import/no-unresolved': 'off',
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      // Mongoose-heavy codebase: `_id` is idiomatic, `for..of` is allowed, service
      // helpers often define hoisted-referenced functions near each other.
      'no-underscore-dangle': ['error', { allow: ['_id', '__v'] }],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ForInStatement',
          message: 'for..in iterates over prototype chain; use Object.{keys,values,entries} plus for..of.',
        },
        {
          selector: 'LabeledStatement',
          message: 'Labels are a sign of spaghetti.',
        },
        {
          selector: 'WithStatement',
          message: '`with` is disallowed in strict mode.',
        },
      ],
      'no-nested-ternary': 'off',
      'max-classes-per-file': 'off',
      'no-use-before-define': ['error', { functions: false, classes: true, variables: true }],
      '@typescript-eslint/no-use-before-define': ['error', { functions: false, classes: true, variables: true }],
    },
  },
  {
    files: ['api/tests/**/*.{ts,tsx}', 'api/scripts/**/*.{ts,tsx}'],
    rules: {
      'no-console': 'off',
      'no-promise-executor-return': 'off',
      'prefer-destructuring': 'off',
      'no-void': 'off',
      'no-await-in-loop': 'off',
    },
  },
  {
    // Adapter classes are stubs by design; some methods legitimately ignore `this`.
    files: ['api/src/integrations/**/*.{ts,tsx}'],
    rules: {
      'class-methods-use-this': 'off',
    },
  },
  {
    // Mongoose `toJSON` transforms reassign `ret`, and `toObject()` returns plain
    // objects we want to mutate in-place for DTO conversions.
    files: ['api/src/models/**/*.{ts,tsx}', 'api/src/services/**/*.{ts,tsx}'],
    rules: {
      'no-param-reassign': ['error', { props: false }],
    },
  },
  {
    // Fee + suspension + reminder services intentionally sequence DB writes
    // (per-installment allocation, idempotent reminder append) so await-in-loop
    // is required for correctness. Service-wide, continue + lonely-if are
    // readable control-flow for the state machines here.
    files: ['api/src/services/**/*.{ts,tsx}'],
    rules: {
      'no-await-in-loop': 'off',
      'no-continue': 'off',
      'no-lonely-if': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['web/**/*.{ts,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
    settings: { react: { version: 'detect' } },
  },
  {
    files: ['api/tests/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: [
      'eslint.config.js',
      '**/vite.config.ts',
      '**/vitest.config.ts',
      '**/tailwind.config.ts',
      '**/postcss.config.js',
    ],
    rules: {
      'import/no-extraneous-dependencies': 'off',
      'import/no-unresolved': 'off',
      'no-underscore-dangle': 'off',
    },
  },
  prettier,
];
