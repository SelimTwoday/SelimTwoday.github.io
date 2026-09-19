import { describe, expect, it } from 'vitest';
import { calculatePert } from '../calculate';
import { buildPertQueryString, buildPertShareUrl, parsePertSearchParams } from '../url';
import { validatePertForm } from '../validate';

describe('buildPertQueryString', () => {
	it('encodes repeated e params exactly like the product contract', () => {
		const participants = [
			{ o: 6, m: 14, p: 34 },
			{ o: 8, m: 16, p: 28 },
			{ o: 8, m: 16, p: 40 },
		];
		const settings = { meetingHoursPerPerson: 1, hoursPerDay: 8 };

		const query = buildPertQueryString(participants, settings);

		expect(query).toBe('e=6,14,34&e=8,16,28&e=8,16,40');
	});

	it('omits settings params when they equal the defaults (1 and 8)', () => {
		const query = buildPertQueryString([{ o: 1, m: 2, p: 3 }], {
			meetingHoursPerPerson: 1,
			hoursPerDay: 8,
		});
		expect(query).not.toContain('m=');
		expect(query).not.toContain('h=');
	});

	it('includes compact settings params only when they differ from defaults', () => {
		const query = buildPertQueryString([{ o: 1, m: 2, p: 3 }], {
			meetingHoursPerPerson: 2.5,
			hoursPerDay: 6,
		});
		const params = new URLSearchParams(query);
		expect(params.get('m')).toBe('2.5');
		expect(params.get('h')).toBe('6');
	});
});

describe('buildPertShareUrl', () => {
	it('builds a full URL from a base and strips any existing query', () => {
		const url = buildPertShareUrl('https://example.com/verktyg/pert/?old=1', [{ o: 1, m: 2, p: 3 }], {
			meetingHoursPerPerson: 1,
			hoursPerDay: 8,
		});
		expect(url).toBe('https://example.com/verktyg/pert/?e=1,2,3');
	});
});

describe('parsePertSearchParams + round trip', () => {
	it('round-trips participants and settings through a URL and reproduces the exact result', () => {
		const participants = [
			{ o: 6, m: 14, p: 34 },
			{ o: 8, m: 16, p: 28 },
			{ o: 8, m: 16, p: 40 },
			{ o: 10, m: 20, p: 36 },
		];
		const settings = { meetingHoursPerPerson: 1.5, hoursPerDay: 6 };

		const query = buildPertQueryString(participants, settings);
		const parsed = parsePertSearchParams(query);

		expect(parsed.rows).toHaveLength(4);
		expect(parsed.meetingHoursPerPerson).toBe('1.5');
		expect(parsed.hoursPerDay).toBe('6');

		const validation = validatePertForm(parsed.rows, {
			meetingHoursPerPerson: parsed.meetingHoursPerPerson,
			hoursPerDay: parsed.hoursPerDay,
		});

		expect(validation.valid).toBe(true);
		if (!validation.valid) throw new Error('expected valid');

		const expected = calculatePert(participants, settings);
		expect(validation.result).toEqual(expected);
	});

	it('falls back to defaults when settings params are absent', () => {
		const parsed = parsePertSearchParams('e=6,14,34');
		expect(parsed.meetingHoursPerPerson).toBe('1');
		expect(parsed.hoursPerDay).toBe('8');
	});

	it('ignores malformed e params with the wrong number of parts', () => {
		const parsed = parsePertSearchParams('e=6,14,34&e=1,2&e=8,16,28');
		expect(parsed.rows).toEqual([
			{ o: '6', m: '14', p: '34' },
			{ o: '8', m: '16', p: '28' },
		]);
	});

	it('parses a URLSearchParams instance directly', () => {
		const params = new URLSearchParams();
		params.append('e', '1,2,3');
		const parsed = parsePertSearchParams(params);
		expect(parsed.rows).toEqual([{ o: '1', m: '2', p: '3' }]);
	});
});
