import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import eslintPluginPrettier from 'eslint-plugin-prettier';

export default tseslint.config(
	{
		languageOptions: {
			parserOptions: {
				project: true,
				ecmaVersion: 'latest',
				sourceType: 'module',
			}
		},
	},
	eslint.configs.recommended,
	...tseslint.configs.recommendedTypeChecked,
	eslintConfigPrettier,
	{
		files: [
			'eslint.config.mjs',
			'./src/*.ts',
		],
		ignores: [
			'build/',
			'.prettierrc.js',
			'eslint.config.mjs',
			'admin/alt/words.js',
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
);


// module.exports = {
// 	root: true, // Don't look outside this project for inherited configs
// 	parser: '@typescript-eslint/parser', // Specifies the ESLint parser
// 	parserOptions: {
// 		ecmaVersion: 2020, // Allows for the parsing of modern ECMAScript features
// 		sourceType: 'module', // Allows for the use of imports
// 		project: './tsconfig.json',
// 	},
// 	extends: [
// 		'plugin:@typescript-eslint/recommended', // Uses the recommended rules from the @typescript-eslint/eslint-plugin
// 		'plugin:prettier/recommended', // Enables eslint-plugin-prettier and displays prettier errors as ESLint errors. Make sure this is always the last configuration in the extends array.
// 	],
// 	ignores: [
// 		'build/',
// 		'.prettierrc.js',
// 		'eslint.config.mjs',
// 		'admin/alt/words.js'
// 	],
// 	plugins: [],
// 	rules: {
// 		'@typescript-eslint/no-parameter-properties': 'off',
// 		'@typescript-eslint/no-explicit-any': 'off',
// 		'@typescript-eslint/no-use-before-define': [
// 			'error',
// 			{
// 				functions: false,
// 				typedefs: false,
// 				classes: false,
// 			},
// 		],
// 		'@typescript-eslint/no-unused-vars': [
// 			'error',
// 			{
// 				ignoreRestSiblings: true,
// 				argsIgnorePattern: '^_',
// 			},
// 		],
// 		'@typescript-eslint/explicit-function-return-type': [
// 			'warn',
// 			{
// 				allowExpressions: true,
// 				allowTypedFunctionExpressions: true,
// 			},
// 		],
// 		'@typescript-eslint/no-object-literal-type-assertion': 'off',
// 		'@typescript-eslint/interface-name-prefix': 'off',
// 		'@typescript-eslint/no-non-null-assertion': 'off', // This is necessary for Map.has()/get()!
// 		'no-var': 'error',
// 		'prefer-const': 'error',
// 		'no-trailing-spaces': 'error',
// 	},
// 	overrides: [
// 		{
// 			files: ['*.test.ts'],
// 			rules: {
// 				'@typescript-eslint/explicit-function-return-type': 'off',
// 			},
// 		},
// 	],
// };
