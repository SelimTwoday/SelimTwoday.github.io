import { describe, expect, it } from 'vitest';
import { formatSwedishNumber, parseSwedishNumber } from '../format';

describe('parseSwedishNumber', () => {
	it('parses comma decimals', () => {
		expect(parseSwedishNumber('8,5')).toBe(8.5);
	});

	it('parses dot decimals (e.g. pasted from URL)', () => {
		expect(parseSwedishNumber('8.5')).toBe(8.5);
	});

	it('parses plain integers', () => {
		expect(parseSwedishNumber('12')).toBe(12);
	});

	it('parses negative numbers', () => {
		expect(parseSwedishNumber('-3,5')).toBe(-3.5);
	});

	it('trims surrounding whitespace', () => {
		expect(parseSwedishNumber('  8,5  ')).toBe(8.5);
	});

	it.each(['', '   ', 'abc', '8,5,5', '8..5', '8,', '1 000', '8,5abc'])(
		'rejects invalid input: %j',
		(input) => {
			expect(parseSwedishNumber(input)).toBeNull();
		},
	);
});

describe('formatSwedishNumber', () => {
	it('formats with a comma decimal separator and one decimal by default', () => {
		expect(formatSwedishNumber(8.5)).toBe('8,5');
	});

	it('respects a custom decimal count', () => {
		expect(formatSwedishNumber(8, 0)).toBe('8');
	});
});
