import { describe, expect, it } from 'vitest';
import {
	BETWEEN_PEOPLE_TITLE,
	calculateGroupTaskPert,
	calculateTaskPert,
	groupVarianceShares,
	varianceShares,
	withMeeting,
} from '../calculate';
import {
	buildGroupTaskPertQueryString,
	buildTaskPertQueryString,
	parsePertSearchParams,
} from '../url';

const person = (name: string, tasks: [string, number, number, number][]) => ({
	name,
	tasks: tasks.map(([title, o, m, p]) => ({ title, o, m, p })),
});

describe('groupVarianceShares', () => {
	const groups = calculateGroupTaskPert([
		person('Simon', [['API', 8, 10, 16], ['Sync', 4, 6, 10], ['Flöden', 12, 16, 24]]),
		person('Anna', [['api', 6, 10, 14], ['Sync', 4, 8, 12]]),
	], 8);

	it('sums to 1 and is sorted largest first', () => {
		const shares = groupVarianceShares(groups);
		expect(shares.reduce((sum, item) => sum + item.share, 0)).toBeCloseTo(1);
		expect(shares.map((item) => item.variance)).toEqual([...shares.map((item) => item.variance)].sort((a, b) => b - a));
	});

	it('merges tasks with the same title across people and adds a disagreement row', () => {
		const shares = groupVarianceShares(groups);
		expect(shares.filter((item) => item.title.toLowerCase() === 'api')).toHaveLength(1);
		expect(shares.map((item) => item.title)).toContain(BETWEEN_PEOPLE_TITLE);
		expect(shares).toHaveLength(4);
	});

	it('gives each task its variance divided by the number of people', () => {
		const shares = groupVarianceShares(groups);
		const flows = shares.find((item) => item.title === 'Flöden');
		expect(flows?.variance).toBeCloseTo(((24 - 12) / 6) ** 2 / 2);
	});

	it('returns only zeros when there is no uncertainty at all', () => {
		const flat = calculateGroupTaskPert([person('A', [['x', 5, 5, 5]]), person('B', [['x', 5, 5, 5]])], 8);
		expect(groupVarianceShares(flat).every((item) => item.share === 0)).toBe(true);
	});

	it('for one person matches PERT Pro: no disagreement row, same shares', () => {
		const tasks = person('Solo', [['A', 8, 10, 16], ['B', 4, 6, 10]]);
		const single = calculateGroupTaskPert([tasks], 8);
		const plain = calculateTaskPert(tasks.tasks, 8);
		expect(single.expectedHours).toBeCloseTo(plain.expectedHours);
		expect(single.standardDeviation).toBeCloseTo(plain.standardDeviation);
		const shares = groupVarianceShares(single);
		expect(shares.map((item) => item.title)).not.toContain(BETWEEN_PEOPLE_TITLE);
		expect(shares.map((item) => item.share)).toEqual(varianceShares(plain).map((item) => item.share));
	});
});

describe('withMeeting', () => {
	it('shifts the estimate and intervals without widening them', () => {
		const base = calculateTaskPert([{ title: 'A', o: 4, m: 6, p: 10 }], 8);
		const adjusted = withMeeting(base.expectedHours, base.standardDeviation, 2, 8);
		expect(adjusted.finalHours).toBeCloseTo(base.expectedHours + 2);
		expect(adjusted.workdays).toBeCloseTo((base.expectedHours + 2) / 8);
		const [one] = adjusted.confidenceIntervals;
		expect(one.upperHours - one.lowerHours).toBeCloseTo(2 * base.standardDeviation);
	});

	it('is identical to the plain estimate without a meeting', () => {
		const base = calculateTaskPert([{ title: 'A', o: 4, m: 6, p: 10 }], 8);
		const adjusted = withMeeting(base.expectedHours, base.standardDeviation, 0, 8);
		expect(adjusted.confidenceIntervals).toEqual(base.confidenceIntervals);
	});

	it('clamps the lower bound at 0', () => {
		const adjusted = withMeeting(1, 5, 0, 8);
		expect(adjusted.confidenceIntervals.every((interval) => interval.lowerHours >= 0)).toBe(true);
	});
});

describe('meeting in PERT Pro and Enterprise links', () => {
	const tasks = [{ title: 'A', o: 1, m: 2, p: 3 }];

	it('writes nothing about meetings unless one was added, so old links are unchanged', () => {
		expect(buildTaskPertQueryString(tasks, 8)).not.toMatch(/[?&]m=|[?&]n=/);
		expect(buildGroupTaskPertQueryString([{ name: 'P', tasks }], 8)).not.toMatch(/[?&]m=|[?&]n=/);
	});

	it('always writes m when a meeting is added, even for the default 1 h', () => {
		const query = buildTaskPertQueryString(tasks, 8, { hoursPerPerson: 1 });
		const parsed = parsePertSearchParams(query);
		expect(parsed.meetingPresent).toBe(true);
		expect(parsed.meetingHoursPerPerson).toBe('1');
		expect(new URLSearchParams(query).has('n')).toBe(false);
	});

	it('writes only m for Enterprise', () => {
		const query = buildGroupTaskPertQueryString([{ name: 'P', tasks }], 8, { hoursPerPerson: 1.5 });
		expect(new URLSearchParams(query).get('m')).toBe('1.5');
		expect(new URLSearchParams(query).has('n')).toBe(false);
	});

	it('reports no meeting for links without m', () => {
		expect(parsePertSearchParams(buildTaskPertQueryString(tasks, 8)).meetingPresent).toBe(false);
	});
});
