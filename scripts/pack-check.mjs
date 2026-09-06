import { spawnSync } from 'node:child_process';
import process from 'node:process';

/**
 * The Package capability must verify artifact contents, not merely produce a dry-run
 * report. `pnpm pack --dry-run` exits 0 even when a public file stops being published,
 * so this asserts the exact packed file set: removing a preset, dropping the license, or
 * leaking a development file all fail here, before release.
 */

const packageDirectory = new URL('../', import.meta.url);

const result = spawnSync('pnpm', ['pack', '--dry-run', '--json'], {
	cwd: packageDirectory,
	encoding: 'utf8',
});

if (result.status !== 0) {
	process.stderr.write(result.stderr);
	process.exit(result.status ?? 1);
}

const report = JSON.parse(result.stdout);
const packed = new Set(report.files.map(file => file.path));

// Every file a consumer is entitled to receive, and nothing else.
const expected = new Set([
	'LICENSE',
	'README.md',
	'base.json',
	'browser.json',
	'node.json',
	'package.json',
	'react.json',
]);

const missing = [...expected].filter(file => !packed.has(file)).sort();
const unexpected = [...packed].filter(file => !expected.has(file)).sort();

if (missing.length > 0 || unexpected.length > 0) {
	if (missing.length > 0) {
		process.stderr.write(`Package is missing required file(s): ${missing.join(', ')}\n`);
	}
	if (unexpected.length > 0) {
		process.stderr.write(`Package contains unexpected file(s): ${unexpected.join(', ')}\n`);
	}
	process.exit(1);
}

process.stdout.write(`Packed artifact contains exactly its ${expected.size} expected files.\n`);
