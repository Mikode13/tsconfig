import codeQuality from '@mikode13/code-quality/base';

export default [
	...codeQuality,
	{
		ignores: ['base.json', 'node.json', 'browser.json', 'react.json'],
	},
];
