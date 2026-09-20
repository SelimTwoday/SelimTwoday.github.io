import { describe, expect, it } from 'vitest';
import {
	average,
	calculatePert,
	HIGH_UNCERTAINTY_THRESHOLD,
	pertFormula,
	standardDeviation,
	TEAM_DISAGREEMENT_THRESHOLD,
} from '../calculate';

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

describe('standardDeviation', () => {
	it('returns 0 for identical values', () => {
		expect(standardDeviation([5, 5, 5])).toBe(0);
	});

	it('computes the population standard deviation', () => {
		// mean = 5, squared deviations = [4, 0, 4], variance = 8/3
		expect(standardDeviation([3, 5, 7])).toBeCloseTo(Math.sqrt(8 / 3), 10);
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

	it('computes the PERT confidence interval from the O-P spread', () => {
		const participants = [{ o: 6, m: 14, p: 34 }];
		const settings = { meetingHoursPerPerson: 0, hoursPerDay: 8 };

		const result = calculatePert(participants, settings);

		const expectedStdDev = (34 - 6) / 6;
		expect(result.pertStdDev).toBeCloseTo(expectedStdDev, 10);
		expect(result.pertVariance).toBeCloseTo(expectedStdDev ** 2, 10);
		expect(result.pertLowHours).toBeCloseTo(result.pertHours - expectedStdDev, 10);
		expect(result.pertHighHours).toBeCloseTo(result.pertHours + expectedStdDev, 10);
	});

	it('clamps the low end of the confidence interval to 0', () => {
		const participants = [{ o: 0, m: 0, p: 6 }];
		const settings = { meetingHoursPerPerson: 0, hoursPerDay: 8 };

		const result = calculatePert(participants, settings);

		expect(result.pertLowHours).toBe(0);
	});

	it('shifts the final confidence interval by the fixed meeting time', () => {
		const participants = [{ o: 6, m: 14, p: 34 }];
		const settings = { meetingHoursPerPerson: 2, hoursPerDay: 8 };

		const result = calculatePert(participants, settings);

		expect(result.finalLowHours).toBeCloseTo(result.pertLowHours + result.meetingTotalHours, 10);
		expect(result.finalHighHours).toBeCloseTo(result.pertHighHours + result.meetingTotalHours, 10);
	});

	it('flags high uncertainty when the O-P spread is large relative to the estimate', () => {
		const participants = [{ o: 1, m: 2, p: 20 }];
		const settings = { meetingHoursPerPerson: 0, hoursPerDay: 8 };

		const result = calculatePert(participants, settings);

		expect(result.pertRelativeStdDev).toBeGreaterThan(HIGH_UNCERTAINTY_THRESHOLD);
		expect(result.highUncertainty).toBe(true);
	});

	it('does not flag high uncertainty for a tight O-P spread', () => {
		const participants = [{ o: 9, m: 10, p: 11 }];
		const settings = { meetingHoursPerPerson: 0, hoursPerDay: 8 };

		const result = calculatePert(participants, settings);

		expect(result.highUncertainty).toBe(false);
	});

	it('flags team disagreement when participants diverge on "most likely"', () => {
		const participants = [
			{ o: 1, m: 2, p: 3 },
			{ o: 1, m: 20, p: 30 },
		];
		const settings = { meetingHoursPerPerson: 0, hoursPerDay: 8 };

		const result = calculatePert(participants, settings);

		expect(result.mRelativeStdDev).toBeGreaterThan(TEAM_DISAGREEMENT_THRESHOLD);
		expect(result.teamDisagreement).toBe(true);
	});

	it('does not flag team disagreement when participants agree', () => {
		const participants = [
			{ o: 1, m: 2, p: 3 },
			{ o: 1, m: 2, p: 4 },
			{ o: 2, m: 2, p: 3 },
		];
		const settings = { meetingHoursPerPerson: 0, hoursPerDay: 8 };

		const result = calculatePert(participants, settings);

		expect(result.teamDisagreement).toBe(false);
	});
});
