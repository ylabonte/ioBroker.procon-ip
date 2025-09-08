// ioBroker eslint template configuration file for js and ts files
// Please note that esm or react based modules need additional modules loaded.
import config from '@iobroker/eslint-config';

export default [
    ...config,
    {
        // specify files to exclude from linting here
        ignores: [
            '.dev-server/',
            '.idea/',
            '.vscode/',
            '*.test.js',
            'test/**/*.js',
            '**/*.config.mjs',
            '**/*.setup.mjs',
            'admin/build',
            'admin/words.js',
            'admin/admin.d.ts',
            'admin/blockly.js',
            'admin/i18n/**/*.json',
            '**/adapter-config.d.ts',
            'build',
            'docker',
            'dist',
            'iobroker-data'
        ],
    },
    {
        // you may disable some 'jsdoc' warnings - but using jsdoc is highly recommended
        // as this improves maintainability. jsdoc warnings will not block buiuld process.
        rules: {
            // 'jsdoc/require-jsdoc': 'off',
            // 'jsdoc/require-param': 'off',
            // 'jsdoc/require-param-description': 'off',
            // 'jsdoc/require-returns-description': 'off',
            // 'jsdoc/require-returns-check': 'off',
            '@typescript-eslint/consistent-type-imports': 'off',
        },
    },
];
