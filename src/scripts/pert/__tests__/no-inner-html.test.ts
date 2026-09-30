import { describe, expect, it } from 'vitest';

const sources = import.meta.glob(['../**/*.ts', '!../__tests__/**'], {
	query: '?raw',
	import: 'default',
	eager: true,
}) as Record<string, string>;

describe('PERT client scripts', () => {
	it('never write HTML strings into the DOM', () => {
		const files = Object.keys(sources);
		expect(files.length).toBeGreaterThan(5);
		const offenders = files.filter((file) => /innerHTML|insertAdjacentHTML|outerHTML|document\.write/.test(sources[file]));
		expect(offenders).toEqual([]);
	});
});
