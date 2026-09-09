import hmppsConfig from '@ministryofjustice/eslint-config-hmpps'

export default [
  ...hmppsConfig(),
  {
    ignores: ['local-stack/component-api/__files/assets/js/**/*.js'],
  },
  {
    // Standalone node scripts are modern ESM; the shared config pins ecmaVersion to 2018,
    // which predates import.meta.
    files: ['scripts/**/*.mjs'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
    rules: {
      // These are command line tools: printing to stdout is the point, and the sequential
      // awaits are deliberate (paging an API, and capping concurrency).
      'no-console': 'off',
      'no-await-in-loop': 'off',
    },
  },
  {
    files: ['**/*.{test,spec}.{ts,js,mjs,tsx,jsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
]
