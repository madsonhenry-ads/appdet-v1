import prettier from 'eslint-config-prettier';

export default [
    {
        files: ['**/*.js'],
        ignores: ['node_modules/**', 'public/**', 'server.original.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                console: 'readonly',
                process: 'readonly',
                require: 'readonly',
                module: 'readonly',
                exports: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                setTimeout: 'readonly',
                setInterval: 'readonly',
                clearTimeout: 'readonly',
                clearInterval: 'readonly',
                Buffer: 'readonly',
                URL: 'readonly',
                URLSearchParams: 'readonly',
                Date: 'readonly',
                JSON: 'readonly',
                Promise: 'readonly',
                Set: 'readonly',
                Map: 'readonly'
            }
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_|^next$|^req$|^res$' }],
            'no-undef': 'error',
            'no-constant-condition': 'warn',
            'no-dupe-keys': 'error',
            'no-duplicate-case': 'error',
            'no-empty': ['warn', { allowEmptyCatch: true }],
            'no-extra-semi': 'warn',
            'no-unreachable': 'warn',
            'eqeqeq': ['warn', 'smart'],
            'no-var': 'warn',
            'prefer-const': ['warn', { destructuring: 'all' }]
        }
    },
    prettier
];
