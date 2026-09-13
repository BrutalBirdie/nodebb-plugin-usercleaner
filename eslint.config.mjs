// Minimal ESLint config for NodeBB plugin (style guide: https://docs.nodebb.org/development/style-guide/)
// Run: npm run lint
export default [
	{ ignores: ['eslint.config.mjs'] },
	// Node/CommonJS (library.js, lib/*.js) — default
	{
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'script',
			globals: {
				require: 'readonly',
				module: 'readonly',
				exports: 'writable',
				__dirname: 'readonly',
				__filename: 'readonly',
				process: 'readonly',
				Buffer: 'readonly',
				setTimeout: 'readonly',
				clearTimeout: 'readonly',
				setInterval: 'readonly',
				clearInterval: 'readonly',
				Promise: 'readonly',
				Set: 'readonly',
				Map: 'readonly',
				Number: 'readonly',
				Date: 'readonly',
				JSON: 'readonly',
				Array: 'readonly',
				Object: 'readonly',
				String: 'readonly',
				Math: 'readonly',
				parseInt: 'readonly',
				parseFloat: 'readonly',
			},
		},
		rules: {
			'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
		},
	},
	// ES modules (config, ACP scripts) — override for these files
	{
		files: ['**/*.mjs', 'public/lib/**/*.js'],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
			globals: {
				$: 'readonly',
				window: 'readonly',
				app: 'readonly',
				ajaxify: 'readonly',
				config: 'readonly',
				socket: 'readonly',
				setInterval: 'readonly',
				clearInterval: 'readonly',
				Promise: 'readonly',
				Date: 'readonly',
				Math: 'readonly',
				String: 'readonly',
				parseInt: 'readonly',
			},
		},
		rules: {
			'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
		},
	},
];
