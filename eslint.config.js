import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**'] },
  js.configs.recommended,
  {
    files: ['site/**/*.js'],
    languageOptions: { globals: { ...globals.browser, marked: 'readonly', katex: 'readonly' } },
  },
  { files: ['tests/**/*.js', '*.js'], languageOptions: { globals: globals.node } },
  {
    rules: {
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
    },
  },
];
