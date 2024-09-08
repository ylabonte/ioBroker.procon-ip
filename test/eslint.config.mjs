import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import eslintPluginPrettier from 'eslint-plugin-prettier';

export default [
	{
		languageOptions: {
			parserOptions: {
				project: true,
				ecmaVersion: 'latest',
				sourceType: 'module',
			},
		},
	},
	eslint.configs.recommended,
	eslintConfigPrettier,
	{
		files: [
			'eslint.config.mjs',
			'./**/*.js',
		],
		ignores: [
		],
		plugins: {
			prettier: eslintPluginPrettier
		},
		rules: {
			'prettier/prettier': 'error',
			'@typescript-eslint/no-unsafe-argument': 'warn',
			'@typescript-eslint/no-unsafe-assignment': 'warn',
			'@typescript-eslint/no-unsafe-call': 'warn',
			'@typescript-eslint/no-unsafe-member-access': 'warn',
			'@typescript-eslint/no-unsafe-return': 'warn',
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-unsafe-enum-comparison': 'warn',
		},
	},
];