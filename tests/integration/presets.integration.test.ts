import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * These are integration tests on purpose: they resolve the presets through the package's
 * own `exports` map and then ask the real TypeScript compiler what each one actually
 * produces. Asserting the JSON file contents directly would only restate the file and
 * would not catch a broken `exports` entry, a broken `extends` chain, or a preset that
 * silently stopped inheriting base strictness.
 */

const packageRoot = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(path.join(packageRoot, 'package.json'));

const presets = ['base', 'node', 'browser', 'react'] as const;
type Preset = (typeof presets)[number];

interface PackageManifest {
	readonly files: readonly string[];
	readonly exports: Readonly<Record<string, string>>;
}

interface ResolvedConfig {
	readonly compilerOptions: Readonly<Record<string, unknown>>;
}

const manifest = JSON.parse(
	readFileSync(path.join(packageRoot, 'package.json'), 'utf8'),
) as PackageManifest;

function resolvedConfigFor(preset: Preset): ResolvedConfig {
	const scratch = mkdtempSync(path.join(tmpdir(), `tsconfig-${preset}-`));
	// `files: []` keeps tsc from reporting "no inputs"; --showConfig never compiles.
	writeFileSync(
		path.join(scratch, 'tsconfig.json'),
		JSON.stringify({ extends: require.resolve(`@mikode13/tsconfig/${preset}`), files: [] }),
	);
	const output = execFileSync(
		process.execPath,
		[require.resolve('typescript/bin/tsc'), '--showConfig', '-p', scratch],
		{ encoding: 'utf8' },
	);
	return JSON.parse(output) as ResolvedConfig;
}

// The options the TypeScript standard documents for each entry point.
const baseOptions: Readonly<Record<string, unknown>> = {
	strict: true,
	noUncheckedIndexedAccess: true,
	noImplicitOverride: true,
	noFallthroughCasesInSwitch: true,
	verbatimModuleSyntax: true,
	isolatedModules: true,
	moduleDetection: 'force',
	skipLibCheck: true,
};

const documented: Readonly<Record<Preset, Readonly<Record<string, unknown>>>> = {
	base: baseOptions,
	node: {
		...baseOptions,
		module: 'nodenext',
		target: 'es2023',
		lib: ['es2023'],
		declaration: true,
		declarationMap: true,
		sourceMap: true,
	},
	browser: {
		...baseOptions,
		module: 'esnext',
		moduleResolution: 'bundler',
		target: 'es2022',
		lib: ['es2022', 'dom', 'dom.iterable'],
		noEmit: true,
	},
	react: {
		...baseOptions,
		module: 'esnext',
		moduleResolution: 'bundler',
		target: 'es2022',
		lib: ['es2022', 'dom', 'dom.iterable'],
		noEmit: true,
		jsx: 'react-jsx',
	},
};

describe('published entry points', () => {
	it.each(presets)('exposes %s through the package exports map', preset => {
		expect(manifest.exports[`./${preset}`]).toBe(`./${preset}.json`);
		expect(require.resolve(`@mikode13/tsconfig/${preset}`)).toBe(
			path.join(packageRoot, `${preset}.json`),
		);
	});

	it.each(presets)('ships %s in the published tarball', preset => {
		expect(manifest.files).toContain(`${preset}.json`);
	});
});

describe('resolved compiler options', () => {
	it.each(presets)('matches the TypeScript standard for %s', preset => {
		const { compilerOptions } = resolvedConfigFor(preset);

		for (const [option, value] of Object.entries(documented[preset])) {
			expect(compilerOptions[option], `${preset}: ${option}`).toStrictEqual(value);
		}
	});

	it.each(presets)('keeps every base strictness option enabled in %s', preset => {
		const { compilerOptions } = resolvedConfigFor(preset);

		for (const [option, value] of Object.entries(baseOptions)) {
			expect(compilerOptions[option], `${preset} weakened ${option}`).toStrictEqual(value);
		}
	});
});
