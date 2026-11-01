// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: { globals: { process: 'readonly', console: 'readonly', Buffer: 'readonly', fetch: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', AbortSignal: 'readonly', Response: 'readonly', URL: 'readonly', __dirname: 'readonly', require: 'readonly', module: 'writable' } },
    rules: {
      // Unused arguments are part of a signature (Nest guards, filters); a leading underscore marks them on purpose.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      // App code has no `any`: guard flags are typed by AccessRequest, provider JSON by narrow interfaces checked at runtime.
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // Tests and scripts read untyped JSON responses; `as any` there is the plain way to do it.
    files: ['test/**/*.ts', 'scripts/**/*.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
);
