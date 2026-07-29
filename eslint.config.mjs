import hmppsConfig from '@ministryofjustice/eslint-config-hmpps'

export default [
  ...hmppsConfig(),
  {
    ignores: ['local-stack/component-api/__files/assets/js/**/*.js'],
  },
  {
    files: ['**/*.{test,spec}.{ts,js,mjs,tsx,jsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
]
