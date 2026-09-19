import { describe, expect, it } from 'vitest';
import { validatePertForm } from '../validate';

const settings = (overrides: Partial<{ meetingHoursPerPerson: string; hoursPerDay: string }> = {}) => ({
	meetingHoursPerPerson: '1',
	hoursPerDay: '8',
	...overrides,
});

describe('validatePertForm', () => {
	it('accepts a valid single row and computes a result', () => {
		const result = validatePertForm([{ o: '6', m: '14', p: '34' }], settings());

		expect(result.valid).toBe(true);
		if (!result.valid) throw new Error('expected valid');
		expect(result.result.pertHours).toBeCloseTo((6 + 4 * 14 + 34) / 6, 10);
		expect(result.result.peopleCount).toBe(1);
	});

	it('accepts Swedish decimal commas', () => {
		const result = validatePertForm([{ o: '6,5', m: '14,5', p: '34,5' }], settings());
		expect(result.valid).toBe(true);
		if (!result.valid) throw new Error('expected valid');
		expect(result.participants[0]).toEqual({ o: 6.5, m: 14.5, p: 34.5 });
	});

	it('rejects when a field is empty (incomplete row)', () => {
		const result = validatePertForm([{ o: '', m: '14', p: '34' }], settings());
		expect(result.valid).toBe(false);
		if (result.valid) throw new Error('expected invalid');
		expect(result.errors.some((e) => e.field === 'row-0-o' && e.code === 'required')).toBe(true);
	});

	it('rejects non-numeric values', () => {
		const result = validatePertForm([{ o: 'abc', m: '14', p: '34' }], settings());
		expect(result.valid).toBe(false);
		if (result.valid) throw new Error('expected invalid');
		expect(result.errors.some((e) => e.field === 'row-0-o' && e.code === 'not-a-number')).toBe(
			true,
		);
	});

	it('rejects negative values', () => {
		const result = validatePertForm([{ o: '-1', m: '14', p: '34' }], settings());
		expect(result.valid).toBe(false);
		if (result.valid) throw new Error('expected invalid');
		expect(result.errors.some((e) => e.field === 'row-0-o' && e.code === 'negative')).toBe(true);
	});

	it('accepts the boundary O = M = P', () => {
		const result = validatePertForm([{ o: '5', m: '5', p: '5' }], settings());
		expect(result.valid).toBe(true);
	});

	it('rejects when O > M', () => {
		const result = validatePertForm([{ o: '20', m: '14', p: '34' }], settings());
		expect(result.valid).toBe(false);
		if (result.valid) throw new Error('expected invalid');
		expect(result.errors.some((e) => e.code === 'order')).toBe(true);
	});

	it('rejects when M > P', () => {
		const result = validatePertForm([{ o: '6', m: '40', p: '34' }], settings());
		expect(result.valid).toBe(false);
		if (result.valid) throw new Error('expected invalid');
		expect(result.errors.some((e) => e.code === 'order')).toBe(true);
	});

	it('requires hoursPerDay to be strictly positive', () => {
		const result = validatePertForm(
			[{ o: '6', m: '14', p: '34' }],
			settings({ hoursPerDay: '0' }),
		);
		expect(result.valid).toBe(false);
		if (result.valid) throw new Error('expected invalid');
		expect(
			result.errors.some(
				(e) => e.field === 'settings-hoursPerDay' && e.code === 'must-be-positive',
			),
		).toBe(true);
	});

	it('allows meetingHoursPerPerson of exactly 0', () => {
		const result = validatePertForm(
			[{ o: '6', m: '14', p: '34' }],
			settings({ meetingHoursPerPerson: '0' }),
		);
		expect(result.valid).toBe(true);
		if (!result.valid) throw new Error('expected valid');
		expect(result.result.meetingTotalHours).toBe(0);
	});

	it('rejects an empty participant list', () => {
		const result = validatePertForm([], settings());
		expect(result.valid).toBe(false);
		if (result.valid) throw new Error('expected invalid');
		expect(result.errors.some((e) => e.code === 'no-participants')).toBe(true);
	});

	it('supports multiple rows and averages them like the reference tool', () => {
		const result = validatePertForm(
			[
				{ o: '6', m: '14', p: '34' },
				{ o: '8', m: '16', p: '28' },
				{ o: '8', m: '16', p: '40' },
				{ o: '10', m: '20', p: '36' },
			],
			settings(),
		);
		expect(result.valid).toBe(true);
		if (!result.valid) throw new Error('expected valid');
		expect(result.result.averageO).toBe(8);
		expect(result.result.averageM).toBe(16.5);
		expect(result.result.meetingTotalHours).toBe(4);
	});
});
