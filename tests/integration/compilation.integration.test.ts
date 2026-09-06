import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Compiles real consumer code against each published preset. Inspecting the resolved
 * option list (see presets.integration.test.ts) cannot prove behaviour: a preset could
 * report `strict: true` while a sibling option such as `strictNullChecks: false` quietly
 * disables what strict is supposed to buy. Only the compiler settles that, so every
 * MiKode-owned invariant here is expressed as code that must compile or must fail.
 *
 * Fixtures are materialised under node_modules/.cache so that module and type resolution
 * walks up to this repository's own node_modules, which is what makes the React preset
 * resolvable at all.
 */

const packageRoot = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(path.join(packageRoot, 'package.json'));
const tsc = require.resolve('typescript/bin/tsc');
const fixtureRoot = path.join(packageRoot, 'node_modules/.cache/tsconfig-fixtures');

type Preset = 'base' | 'node' | 'browser' | 'react';

interface Fixture {
	readonly preset: Preset;
	readonly files: Readonly<Record<string, string>>;
}

interface CompileResult {
	readonly ok: boolean;
	readonly output: string;
}

function compile(name: string, fixture: Fixture): CompileResult {
	const directory = path.join(fixtureRoot, name);
	rmSync(directory, { recursive: true, force: true });
	mkdirSync(directory, { recursive: true });

	// A real ESM consumer: `module: nodenext` resolves .ts as CommonJS without this.
	writeFileSync(path.join(directory, 'package.json'), '{ "type": "module" }');
	writeFileSync(
		path.join(directory, 'tsconfig.json'),
		JSON.stringify({
			extends: path.join(packageRoot, `${fixture.preset}.json`),
			compilerOptions: { noEmit: true },
			include: ['**/*.ts', '**/*.tsx'],
		}),
	);
	for (const [file, source] of Object.entries(fixture.files)) {
		writeFileSync(path.join(directory, file), source);
	}

	try {
		execFileSync(process.execPath, [tsc, '-p', directory], { encoding: 'utf8' });
		return { ok: true, output: '' };
	} catch (error) {
		const { stdout } = error as { stdout?: string };
		return { ok: false, output: stdout ?? '' };
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}

const presets = ['base', 'node', 'browser', 'react'] as const;

describe('positive fixtures compile', () => {
	it('accepts strict, well-typed code under base', () => {
		const result = compile('base-valid', {
			preset: 'base',
			files: {
				'index.ts': `export function firstWord(value: string): string | undefined {
	return value.split(' ')[0];
}
`,
			},
		});

		expect(result.output).toBe('');
		expect(result.ok).toBe(true);
	});

	it('accepts ES2023 library features and NodeNext resolution under node', () => {
		const result = compile('node-valid', {
			preset: 'node',
			files: {
				'helper.ts': `export const values: readonly number[] = [1, 2, 3];\n`,
				'index.ts': `import { values } from './helper.js';

// findLast requires lib ES2023, so this also proves the preset's lib setting.
export function lastEven(): number | undefined {
	return values.findLast(value => value % 2 === 0);
}
`,
			},
		});

		expect(result.output).toBe('');
		expect(result.ok).toBe(true);
	});

	it('accepts DOM globals under browser', () => {
		const result = compile('browser-valid', {
			preset: 'browser',
			files: {
				'index.ts': `export function title(): string {
	return document.title;
}
`,
			},
		});

		expect(result.output).toBe('');
		expect(result.ok).toBe(true);
	});

	it('accepts JSX without importing React under react', () => {
		const result = compile('react-valid', {
			preset: 'react',
			files: {
				'app.tsx': `export function Greeting({ name }: { readonly name: string }) {
	return <p>{name}</p>;
}
`,
			},
		});

		expect(result.output).toBe('');
		expect(result.ok).toBe(true);
	});
});

describe('negative fixtures fail on MiKode-owned invariants', () => {
	it.each(presets)('rejects assigning null to a non-nullable type under %s', preset => {
		const result = compile(`${preset}-null`, {
			preset,
			files: { 'index.ts': `export const value: string = null;\n` },
		});

		expect(result.ok).toBe(false);
		expect(result.output).toContain('error TS2322');
		expect(result.output).toContain("Type 'null' is not assignable");
	});

	it.each(presets)('rejects unchecked index access under %s', preset => {
		const result = compile(`${preset}-index`, {
			preset,
			files: {
				'index.ts': `const items: readonly string[] = [];
export const first: string = items[0];
`,
			},
		});

		expect(result.ok).toBe(false);
		expect(result.output).toContain('error TS2322');
		expect(result.output).toContain('undefined');
	});

	it('rejects an override without the override modifier under base', () => {
		const result = compile('base-override', {
			preset: 'base',
			files: {
				'index.ts': `export class Base {
	describe(): string {
		return 'base';
	}
}

export class Derived extends Base {
	describe(): string {
		return 'derived';
	}
}
`,
			},
		});

		expect(result.ok).toBe(false);
		expect(result.output).toContain('error TS4114');
	});

	it('rejects a fallthrough switch case under base', () => {
		const result = compile('base-fallthrough', {
			preset: 'base',
			files: {
				'index.ts': `export function label(value: number): string {
	switch (value) {
		case 1: {
			const unused = 'one';
			void unused;
		}
		case 2:
			return 'two';
		default:
			return 'other';
	}
}
`,
			},
		});

		expect(result.ok).toBe(false);
		expect(result.output).toContain('error TS7029');
	});

	it('rejects a value-style import of a type under base', () => {
		const result = compile('base-verbatim', {
			preset: 'base',
			files: {
				'shape.ts': `export interface Shape {\n\treadonly size: number;\n}\n`,
				'index.ts': `import { Shape } from './shape.js';

export const shape: Shape = { size: 1 };
`,
			},
		});

		expect(result.ok).toBe(false);
		expect(result.output).toContain('error TS1484');
	});

	it('rejects DOM globals under node, whose lib is ES2023 only', () => {
		const result = compile('node-dom', {
			preset: 'node',
			files: { 'index.ts': `export const title: string = document.title;\n` },
		});

		expect(result.ok).toBe(false);
		expect(result.output).toContain('error TS2584');
	});

	it('rejects an extensionless relative import under node module resolution', () => {
		const result = compile('node-extensionless', {
			preset: 'node',
			files: {
				'helper.ts': `export const marker = 'ok';\n`,
				'index.ts': `import { marker } from './helper';\n\nexport const value = marker;\n`,
			},
		});

		expect(result.ok).toBe(false);
		expect(result.output).toContain('error TS2835');
	});

	it('rejects JSX under browser, which does not enable it', () => {
		const result = compile('browser-jsx', {
			preset: 'browser',
			files: { 'app.tsx': `export const element = <p>text</p>;\n` },
		});

		expect(result.ok).toBe(false);
		expect(result.output).toContain('error TS17004');
	});
});
