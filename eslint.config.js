import js from '@eslint/js';

export default [
	js.configs.recommended,
	{
		ignores: ['base.json', 'node.json', 'browser.json', 'react.json'],
	},
];
