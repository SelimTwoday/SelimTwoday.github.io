import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..');

function sourceFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(path);
		return entry.name.endsWith('.ts') ? [path] : [];
	});
}

describe('PERT client scripts', () => {
	it('never write HTML strings into the DOM', () => {
		const files = sourceFiles(root);
		expect(files.length).toBeGreaterThan(0);
		const offenders = files.filter((file) => /innerHTML|insertAdjacentHTML|outerHTML|document\.write/.test(readFileSync(file, 'utf8')));
		expect(offenders).toEqual([]);
	});
});
