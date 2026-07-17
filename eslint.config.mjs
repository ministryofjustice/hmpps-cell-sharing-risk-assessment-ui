import hmppsConfig from '@ministryofjustice/eslint-config-hmpps'

export default [
  ...hmppsConfig(),
  {
    files: ['**/*.{test,spec}.{ts,js,mjs,tsx,jsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
]
