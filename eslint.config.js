import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['dist/**', 'out/**', 'node_modules/**', 'eslint.config.js'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      // Only the two classic, long-established hooks rules. eslint-plugin-
      // react-hooks v7's "recommended" bundles the much stricter React
      // Compiler rule suite (no ref reads during render, effect purity, etc.)
      // — this project isn't adopting the React Compiler, and several
      // deliberate patterns from this refactor (useCommandHistory/StoryRuntime
      // caching state in refs and reading them synchronously, documented in
      // their own comments) are correct designs that those rules would flag.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // The codebase leans on `any` deliberately at a few storage/IPC/DOM
      // boundaries (see Phase 2-7 notes) — not worth blocking on repo-wide.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['electron/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      globals: globals.node,
    },
  }
);
