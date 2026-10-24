import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = [
    ...nextVitals,
    ...nextTs,
    {
        rules: {
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-empty-object-type': 'off',
            'react-hooks/set-state-in-effect': 'warn',
        },
    },
    {
        files: ['next.config.js'],
        rules: { '@typescript-eslint/no-require-imports': 'off' },
    },
    {
        ignores: ['.next/**', 'node_modules/**', 'public/**', 'legacy_php_code/**', 'next-env.d.ts'],
    },
]

export default eslintConfig
