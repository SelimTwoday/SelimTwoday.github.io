import { describe, expect, it } from 'vitest';
import { evaluateRow } from '../validate';

const row = (o: string, m: string, p: string) => ({ o, m, p });

describe('evaluateRow', () => {
	it('is empty when all fields are blank', () => {
		expect(evaluateRow(row('', ' ', ''))).toEqual({
			state: 'empty', expectedHours: null, standardDeviation: null, errors: [],
		});
	});

	it('is incomplete when a field is missing but none is invalid', () => {
		const result = evaluateRow(row('4', '', '10'));
		expect(result.state).toBe('incomplete');
		expect(result.expectedHours).toBeNull();
		expect(result.errors).toEqual([]);
	});

	it('is invalid for non-numbers and negatives, keyed by field', () => {
		const text = evaluateRow(row('abc', '5', '9'));
		expect(text.state).toBe('invalid');
		expect(text.errors.map((error) => error.field)).toEqual(['o']);

		const negative = evaluateRow(row('1', '-2', '9'));
		expect(negative.state).toBe('invalid');
		expect(negative.errors[0]).toMatchObject({ field: 'm', code: 'negative' });
	});

	it('is invalid even when another field is empty', () => {
		expect(evaluateRow(row('x', '', '')).state).toBe('invalid');
	});

	it('flags wrong order', () => {
		const result = evaluateRow(row('10', '5', '20'));
		expect(result.state).toBe('order');
		expect(result.errors[0].code).toBe('order');
		expect(result.expectedHours).toBeNull();
	});

	it('computes expected hours and deviation for a valid row, with Swedish decimals', () => {
		const result = evaluateRow(row('4', '6', '10'));
		expect(result.state).toBe('ok');
		expect(result.expectedHours).toBeCloseTo(38 / 6);
		expect(result.standardDeviation).toBeCloseTo(1);

		expect(evaluateRow(row('1,5', '2,5', '3,5')).expectedHours).toBeCloseTo(2.5);
	});

	it('accepts O = M = P with zero deviation', () => {
		const result = evaluateRow(row('5', '5', '5'));
		expect(result).toMatchObject({ state: 'ok', expectedHours: 5, standardDeviation: 0 });
	});
});
