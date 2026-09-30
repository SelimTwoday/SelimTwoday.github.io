import { describe, expect, it } from 'vitest';
import { findScopeGaps } from '../scope';

const group = (name: string, ...titles: string[]) => ({
	name,
	tasks: titles.map((title) => ({ title, o: '1', m: '2', p: '3' })),
});

describe('findScopeGaps', () => {
	it('returns no gaps for identical lists', () => {
		expect(findScopeGaps([group('A', 'x', 'y'), group('B', 'y', 'x')])).toEqual([]);
	});

	it('lists what each person lacks compared with the others', () => {
		expect(findScopeGaps([group('A', 'x', 'y'), group('B', 'x')])).toEqual([
			{ groupIndex: 1, missingTitles: ['y'] },
		]);
	});

	it('treats case and whitespace differences as the same title', () => {
		expect(findScopeGaps([group('A', 'Löpande  flöden'), group('B', ' löpande flöden ')])).toEqual([]);
	});

	it('normalizes Unicode composition', () => {
		expect(findScopeGaps([group('A', 'a\u030a'), group('B', '\u00e5')])).toEqual([]);
	});

	it('ignores empty titles', () => {
		expect(findScopeGaps([group('A', 'x', '  '), group('B', 'x')])).toEqual([]);
	});

	it('uses the first occurrence as display title', () => {
		expect(findScopeGaps([group('A', 'API-kontrakt'), group('B', 'api-kontrakt'), group('C', 'annat')])).toEqual([
			{ groupIndex: 0, missingTitles: ['annat'] },
			{ groupIndex: 1, missingTitles: ['annat'] },
			{ groupIndex: 2, missingTitles: ['API-kontrakt'] },
		]);
	});
});
