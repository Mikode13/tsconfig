import { runPackageManager } from '@mikode13/cross-platform';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/**
 * The Package capability must verify artifact contents, not merely produce a dry-run
 * report. `pnpm pack --dry-run` exits 0 even when a public file stops being published,
 * so this asserts the exact packed file set: removing a preset, dropping the license, or
 * leaking a development file all fail here, before release.
 */

const packageDirectory = fileURLToPath(new URL('../', import.meta.url));

// `runPackageManager` spawns the package manager through its own entry point, so the check
// also runs on Windows, where `pnpm` is a `.cmd` shim that `execFile` refuses to execute.
let stdout;

try {
	({ stdout } = await runPackageManager(['pack', '--dry-run', '--json'], {
		cwd: packageDirectory,
	}));
} catch (error) {
	// The package manager explains its own failure better than a stack trace does.
	process.stderr.write(error.stderr ?? `${error.message}\n`);
	process.exit(typeof error.code === 'number' ? error.code : 1);
}

const report = JSON.parse(stdout);
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
