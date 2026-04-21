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
