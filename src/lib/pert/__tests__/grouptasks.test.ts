import { describe, expect, it } from 'vitest';
import { calculateGroupTaskPert, calculateTaskPert } from '../calculate';
import { validateGroupTaskPertForm } from '../validate';
import { buildGroupTaskPertShareUrl, buildTaskPertShareUrl, parsePertSearchParams, parseTaskLinkImport } from '../url';
import type { TaskGroupEstimate } from '../types';

const task = (title: string, o = 8, m = 10, p = 20) => ({ title, o, m, p });
const groups: TaskGroupEstimate[] = [
	{ name: 'Anna', tasks: Array.from({ length: 7 }, (_, i) => task(`A ${i + 1}`, 10, 10, 10)) },
	{ name: 'Bo', tasks: Array.from({ length: 4 }, (_, i) => task(`B ${i + 1}`, 20, 20, 20)) },
];
const rawGroups = (values: TaskGroupEstimate[]) => values.map((group) => ({
	name: group.name,
	tasks: group.tasks.map((value) => ({
		title: value.title, o: String(value.o), m: String(value.m), p: String(value.p),
	})),
}));

describe('Enterprise equal-weight estimation', () => {
	it('gives seven and four tasks equal user weight, without summing or averaging all rows', () => {
		const result = calculateGroupTaskPert(groups, 8);
		expect(result.groups.map((group) => group.expectedHours)).toEqual([70, 80]);
		expect(result.expectedHours).toBe(75);
		expect(result.averageM).toBe(75);
		expect(result.withinVariance).toBe(0);
		expect(result.betweenVariance).toBe(25);
		expect(result.standardDeviation).toBe(5);
		expect(result.groups.map((group) => group.deviationHours)).toEqual([-5, 5]);
		expect(result.workdays).toBe(9.375);
	});

	it('reduces to PERT Pro for one user', () => {
		const tasks = [task('Bygg'), task('Test')];
		const individual = calculateTaskPert(tasks, 6);
		const result = calculateGroupTaskPert([{ name: 'Anna', tasks }], 6);
		expect(result.expectedHours).toBe(individual.expectedHours);
		expect(result.variance).toBe(individual.variance);
		expect(result.betweenVariance).toBe(0);
		expect(result.teamDisagreement).toBe(false);
	});

	it('combines mean task variance with population variance of project totals', () => {
		const result = calculateGroupTaskPert([
			{ name: 'A', tasks: [task('A', 4, 10, 16)] },
			{ name: 'B', tasks: [task('B', 8, 20, 32)] },
		], 8);
		expect(result.expectedHours).toBe(15);
		expect(result.withinVariance).toBe(10);
		expect(result.betweenVariance).toBe(25);
		expect(result.variance).toBe(35);
		expect(result.confidenceIntervals[1].upperHours).toBeCloseTo(15 + 2 * Math.sqrt(35));
	});

	it('does not shrink project uncertainty when identical users are added', () => {
		const group = { name: 'A', tasks: [task('Bygg')] };
		const single = calculateGroupTaskPert([group], 8);
		const repeated = calculateGroupTaskPert([group, { ...group, name: 'B' }], 8);
		expect(repeated.variance).toBe(single.variance);
		expect(repeated.expectedHours).toBe(single.expectedHours);
	});

	it('handles zero estimates and clamps negative interval bounds', () => {
		const zero = calculateGroupTaskPert([{ name: 'A', tasks: [task('A', 0, 0, 0)] }], 8);
		expect(zero.standardDeviation).toBe(0);
		expect(zero.relativeDisagreement).toBe(0);
		expect(zero.confidenceIntervals.every((interval) => interval.lowerHours === 0)).toBe(true);
		const uncertain = calculateGroupTaskPert([{ name: 'A', tasks: [task('A', 0, 0, 60)] }], 8);
		expect(uncertain.highUncertainty).toBe(true);
		expect(uncertain.confidenceIntervals[2].lowerHours).toBe(0);
	});

	it('flags disagreement at the existing threshold, not at or below it', () => {
		const estimate = (value: number) => ({ name: String(value), tasks: [task('A', value, value, value)] });
		expect(calculateGroupTaskPert([estimate(3), estimate(7)], 8).teamDisagreement).toBe(false);
		expect(calculateGroupTaskPert([estimate(2), estimate(8)], 8).teamDisagreement).toBe(true);
	});
});

describe('Enterprise validation', () => {
	it('accepts Swedish decimals and different task counts', () => {
		const inputs = rawGroups(groups);
		inputs[0].tasks[0] = { title: 'Test', o: '8,5', m: '10', p: '12' };
		const result = validateGroupTaskPertForm(inputs, '7,5');
		expect(result.valid).toBe(true);
		if (!result.valid) throw new Error('expected valid');
		expect(result.groups[0].tasks[0].o).toBe(8.5);
		expect(result.result.hoursPerDay).toBe(7.5);
	});

	it('targets the right user and row for errors and rejects the entire invalid group', () => {
		const inputs = rawGroups(groups);
		inputs[1].name = ' ';
		inputs[1].tasks[2].o = '99';
		const result = validateGroupTaskPertForm(inputs, '0');
		expect(result.valid).toBe(false);
		expect(result.errors.map((error) => error.field)).toEqual([
			'group-1-name', 'group-1-row-2-order', 'settings-hoursPerDay',
		]);
		expect(result.result).toBe(null);
	});

	it('requires users, task lists, names, titles and numeric estimates', () => {
		expect(validateGroupTaskPertForm([], '8').valid).toBe(false);
		const empty = validateGroupTaskPertForm([{ name: 'A', tasks: [] }], '8');
		expect(empty.errors[0].field).toBe('group-0-tasks');
		const invalid = validateGroupTaskPertForm([{ name: 'A', tasks: [{ title: '', o: '', m: '-1', p: 'hej' }] }], '8');
		expect(invalid.errors.map((error) => error.code)).toEqual(['required', 'required', 'negative', 'not-a-number']);
	});

	it('rejects finite values whose combined calculation overflows', () => {
		const overflowing = '1' + '0'.repeat(308);
		const huge = [{ name: 'A', tasks: [{ title: 'A', o: '0', m: overflowing, p: overflowing }] }];
		const taskOverflow = validateGroupTaskPertForm(huge, '8');
		expect(taskOverflow.valid).toBe(false);
		expect(taskOverflow.errors[0].field).toBe('group-0-tasks');
		const large = '1' + '0'.repeat(200);
		const spread = [
			{ name: 'A', tasks: [{ title: 'A', o: large, m: large, p: large }] },
			{ name: 'B', tasks: [{ title: 'B', o: '0', m: '0', p: '0' }] },
		];
		const result = validateGroupTaskPertForm(spread, '8');
		expect(result.valid).toBe(false);
		expect(result.errors[0].field).toBe('groups');
	});
});

describe('Enterprise URLs and atomic imports', () => {
	it('round-trips small decimals without converting them into rejected scientific input', () => {
		const values = [{ name: 'A', tasks: [task('A', 1e-8, 2e-8, 3e-8)] }];
		const url = buildGroupTaskPertShareUrl('https://example.com/verktyg/pert/', values, 1e-7);
		const parsed = parsePertSearchParams(new URL(url).search);
		const validation = validateGroupTaskPertForm(parsed.groups, parsed.hoursPerDay);
		expect(parsed.groups[0].tasks[0].o).toBe('0.00000001');
		expect(parsed.hoursPerDay).toBe('0.0000001');
		expect(validation.valid).toBe(true);
		if (!validation.valid) throw new Error('expected valid');
		expect(validation.result).toEqual(calculateGroupTaskPert(values, 1e-7));
	});

	it('round-trips user names, task order, decimals and workday settings', () => {
		const values = [{ name: 'Åsa & Bo, "team"', tasks: [task('API & test, åäö', 1.5, 2.5, 3.5)] }, ...groups];
		const url = buildGroupTaskPertShareUrl('https://example.com/verktyg/pert/?old=1', values, 6);
		const parsed = parsePertSearchParams(new URL(url).search);
		expect(parsed.mode).toBe('grouptasks');
		expect(parsed.groups).toEqual(rawGroups(values));
		expect(parsed.hoursPerDay).toBe('6');
		expect(parsed.errors).toEqual([]);
		const validation = validateGroupTaskPertForm(parsed.groups, parsed.hoursPerDay);
		expect(validation.valid).toBe(true);
		if (!validation.valid) throw new Error('expected valid');
		expect(validation.result).toEqual(calculateGroupTaskPert(values, 6));
	});

	it('imports a tasks link as one named user and an Enterprise link as all users', () => {
		const taskUrl = buildTaskPertShareUrl('https://example.com/verktyg/pert/', [task('A')], 8);
		const single = parseTaskLinkImport(taskUrl, 'Namn');
		expect(single).toMatchObject({ valid: true, sourceMode: 'tasks', groups: [{ name: 'Namn' }] });
		const groupUrl = buildGroupTaskPertShareUrl('https://example.com/verktyg/pert/', groups, 8);
		expect(parseTaskLinkImport(groupUrl, '')).toMatchObject({ valid: true, groups: rawGroups(groups) });
	});

	it.each([
		'not a url', 'javascript:alert(1)', 'https://example.com/?e=1,2,3',
		'https://example.com/?mode=tasks', 'https://example.com/?mode=grouptasks',
		'https://example.com/?mode=tasks&t=broken',
		'https://example.com/?mode=grouptasks&g=["A",[[1,2,3,4]]]',
		'https://example.com/?mode=grouptasks&g=["A",[]]',
		'https://example.com/?mode=tasks&t=["A",4,2,3]',
		'https://example.com/?mode=tasks&t=["A",1,2,3]&h=0',
		'https://example.com/?mode=tasks&t=["A",1,2,3]&t=broken',
		'https://example.com/?mode=grouptasks&g=["A",[["A",1,2,3]]]&g=broken',
	])('rejects malformed/invalid imports without importing partial data: %s', (url) => {
		expect(parseTaskLinkImport(url, 'A').valid).toBe(false);
	});
});
