import { describe, expect, it } from 'vitest';
import { buildDiff, getTextStats } from '../index';

describe('getTextStats', () => {
	it('counts common text metrics', () => {
		expect(getTextStats('Hej världen.\n\nDetta är rad två!')).toEqual({
			words: 6,
			characters: 31,
			charactersNoSpaces: 25,
			sentences: 2,
			paragraphs: 2,
			lines: 3,
		});
	});

	it('returns zeroed stats for empty text', () => {
		expect(getTextStats('')).toEqual({
			words: 0,
			characters: 0,
			charactersNoSpaces: 0,
			sentences: 0,
			paragraphs: 0,
			lines: 0,
		});
	});
});

describe('buildDiff', () => {
	it('marks changed, added and removed lines', () => {
		const result = buildDiff('rad ett\nrad två\nrad tre', 'rad ett\nrad 2\nrad tre\nrad fyra');

		expect(result.summary).toEqual({
			equal: 2,
			added: 1,
			removed: 0,
			changed: 1,
		});
		expect(result.rows.map((row) => row.status)).toEqual(['equal', 'change', 'equal', 'add']);
		expect(result.rows[1].leftSegments.some((segment) => segment.type === 'remove')).toBe(true);
		expect(result.rows[1].rightSegments.some((segment) => segment.type === 'add')).toBe(true);
	});

	it('isolates an inserted HTML attribute as the inline change', () => {
		const left = '<p id="diff-empty" class="diff-empty">Inget att jämföra ännu.</p>';
		const right = '<p id="diff-empty" class="diff-empty" aria-hidden="true">Inget att jämföra ännu.</p>';

		const [row] = buildDiff(left, right).rows;

		expect(row?.status).toBe('change');
		expect(row?.leftSegments).toEqual([
			{
				text: '<p id="diff-empty" class="diff-empty">Inget att jämföra ännu.</p>',
				type: 'equal',
			},
		]);
		expect(row?.rightSegments).toEqual([
			{ text: '<p id="diff-empty" class="diff-empty"', type: 'equal' },
			{ text: ' aria-hidden="true"', type: 'add' },
			{ text: '>Inget att jämföra ännu.</p>', type: 'equal' },
		]);
	});

	it('marks both sides of a character replacement', () => {
		const [row] = buildDiff('version 1.2.3', 'version 1.3.3').rows;

		expect(row?.leftSegments).toContainEqual({ text: '2', type: 'remove' });
		expect(row?.rightSegments).toContainEqual({ text: '3', type: 'add' });
	});

	it('falls back to whole-line highlighting for very large inline edits', () => {
		const left = 'a'.repeat(6_000);
		const right = 'b'.repeat(6_000);
		const [row] = buildDiff(left, right).rows;

		expect(row?.leftSegments).toEqual([{ text: left, type: 'remove' }]);
		expect(row?.rightSegments).toEqual([{ text: right, type: 'add' }]);
	});

	it('marks removed-only rows', () => {
		const result = buildDiff('a\nb', 'a');

		expect(result.summary).toEqual({
			equal: 1,
			added: 0,
			removed: 1,
			changed: 0,
		});
		expect(result.rows.at(-1)?.status).toBe('remove');
	});

	it('marks added-only rows even when they appear first', () => {
		const result = buildDiff('', 'ny rad');

		expect(result.summary).toEqual({
			equal: 0,
			added: 1,
			removed: 0,
			changed: 0,
		});
		expect(result.rows).toHaveLength(1);
		expect(result.rows[0]?.status).toBe('add');
	});

	it('normalizes crlf line endings', () => {
		const result = buildDiff('rad ett\r\nrad två', 'rad ett\nrad två');

		expect(result.summary).toEqual({
			equal: 2,
			added: 0,
			removed: 0,
			changed: 0,
		});
		expect(getTextStats('rad ett\r\nrad två').lines).toBe(2);
	});

	it('falls back to a linear diff for larger comparisons', () => {
		const leftLines = Array.from({ length: 500 }, (_, index) => `rad ${index + 1}`);
		const rightLines = [...leftLines];
		rightLines[249] = 'rad 250 uppdaterad';

		const result = buildDiff(leftLines.join('\n'), rightLines.join('\n'));

		expect(result.summary).toEqual({
			equal: 499,
			added: 0,
			removed: 0,
			changed: 1,
		});
		expect(result.rows[249]?.status).toBe('change');
	});

	it('resynchronizes after a large-input insertion', () => {
		const leftLines = Array.from({ length: 500 }, (_, index) => `rad ${index + 1}`);
		const rightLines = [...leftLines];
		rightLines.splice(10, 0, 'inskjuten rad');

		const result = buildDiff(leftLines.join('\n'), rightLines.join('\n'));

		expect(result.summary).toEqual({
			equal: 500,
			added: 1,
			removed: 0,
			changed: 0,
		});
		expect(result.rows[10]?.status).toBe('add');
		expect(result.rows[11]?.status).toBe('equal');
	});
});
