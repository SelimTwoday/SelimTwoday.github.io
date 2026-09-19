import { describe, expect, it } from 'vitest';
import { average, calculatePert, pertFormula } from '../calculate';

describe('pertFormula', () => {
	it('computes the classic three-point weighted average', () => {
		expect(pertFormula(6, 14, 34)).toBeCloseTo((6 + 4 * 14 + 34) / 6, 10);
	});

	it('returns the same value when O=M=P', () => {
		expect(pertFormula(5, 5, 5)).toBe(5);
	});
});

describe('average', () => {
	it('averages a list of numbers', () => {
		expect(average([6, 8, 8, 10])).toBe(8);
	});
});

describe('calculatePert', () => {
	it('matches the reference calculation (formula + meeting cost)', () => {
		// Values from the reference Obsidian PERT note.
		const participants = [
			{ o: 6, m: 14, p: 34 },
			{ o: 8, m: 16, p: 28 },
			{ o: 8, m: 16, p: 40 },
			{ o: 10, m: 20, p: 36 },
		];
		const settings = { meetingHoursPerPerson: 1, hoursPerDay: 8 };

		const result = calculatePert(participants, settings);

		expect(result.averageO).toBe(8);
		expect(result.averageM).toBe(16.5);
		expect(result.averageP).toBeCloseTo(34.5, 10);

		const expectedPert = (8 + 4 * 16.5 + 34.5) / 6;
		expect(result.pertHours).toBeCloseTo(expectedPert, 10);

		expect(result.peopleCount).toBe(4);
		expect(result.meetingTotalHours).toBe(4); // 4 people * 1h
		expect(result.finalHours).toBeCloseTo(expectedPert + 4, 10);
		expect(result.workdays).toBeCloseTo((expectedPert + 4) / 8, 10);
	});

	it('scales meeting cost with number of people and meeting time', () => {
		const participants = [
			{ o: 1, m: 2, p: 3 },
			{ o: 1, m: 2, p: 3 },
			{ o: 1, m: 2, p: 3 },
		];
		const settings = { meetingHoursPerPerson: 2.5, hoursPerDay: 8 };

		const result = calculatePert(participants, settings);

		expect(result.meetingTotalHours).toBe(7.5); // 3 * 2.5
		expect(result.finalHours).toBeCloseTo(result.pertHours + 7.5, 10);
	});

	it('divides final hours by hoursPerDay to get workdays', () => {
		const participants = [{ o: 8, m: 8, p: 8 }];
		const settings = { meetingHoursPerPerson: 0, hoursPerDay: 4 };

		const result = calculatePert(participants, settings);

		expect(result.pertHours).toBe(8);
		expect(result.finalHours).toBe(8);
		expect(result.workdays).toBe(2);
	});
});
