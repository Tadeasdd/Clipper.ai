// U5 — ESLint flat config. Quality gate for the frontend: catches React-hook
// misuse and accessibility regressions without enforcing stylistic churn on the
// bespoke marketing JSX. `npm run lint` is green at 0 errors; genuine smells are
// surfaced as warnings.
import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    plugins: { react, 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      // The marketing copy is intentionally prose-rich and these add noise
      // without catching bugs in a no-TypeScript, automatic-JSX-runtime app.
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/no-unescaped-entities': 'off',
      // Real smells, surfaced but non-blocking (rules-of-hooks stays an error).
      'react-hooks/exhaustive-deps': 'warn',
      'no-unused-vars': 'warn',
    },
  },
];
