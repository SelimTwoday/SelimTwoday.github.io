import { describe, expect, it } from 'vitest';
import { calculatePert } from '../calculate';
import {
	MAX_GROUPS,
	MAX_PARTICIPANTS,
	MAX_QUERY_LENGTH,
	MAX_TASKS_PER_GROUP,
	MAX_TEXT_LENGTH,
} from '../types';
import {
	buildGroupTaskPertQueryString,
	buildPertQueryString,
	buildTaskPertQueryString,
	parsePertSearchParams,
	parseTaskLinkImport,
} from '../url';
import { validatePertForm } from '../validate';

const settings = { meetingHoursPerPerson: 1, hoursPerDay: 8 };

describe('legacy and new group links', () => {
	it('parses a legacy link without mode as participants and keeps the result', () => {
		const parsed = parsePertSearchParams('e=6,14,34&e=8,16,28&m=1.5&h=6');
		expect(parsed.mode).toBe('participants');
		expect(parsed.errors).toEqual([]);

		const validation = validatePertForm(parsed.rows, {
			meetingHoursPerPerson: parsed.meetingHoursPerPerson,
			hoursPerDay: parsed.hoursPerDay,
		});
		if (!validation.valid) throw new Error('expected valid');
		expect(validation.result).toEqual(
			calculatePert([{ o: 6, m: 14, p: 34 }, { o: 8, m: 16, p: 28 }], { meetingHoursPerPerson: 1.5, hoursPerDay: 6 }),
		);
	});

	it('parses mode=group as participants', () => {
		expect(parsePertSearchParams('mode=group&e=1,2,3').mode).toBe('participants');
	});

	it('treats unknown modes as participants, including prototype keys', () => {
		expect(parsePertSearchParams('mode=foo&e=1,2,3').mode).toBe('participants');
		expect(parsePertSearchParams('mode=constructor&e=1,2,3').mode).toBe('participants');
	});

	it('round-trips through build, parse and validate', () => {
		const participants = [{ o: 6, m: 14, p: 34 }, { o: 8, m: 16, p: 28 }];
		const parsed = parsePertSearchParams(buildPertQueryString(participants, settings));
		const validation = validatePertForm(parsed.rows, {
			meetingHoursPerPerson: parsed.meetingHoursPerPerson,
			hoursPerDay: parsed.hoursPerDay,
		});
		if (!validation.valid) throw new Error('expected valid');
		expect(validation.result).toEqual(calculatePert(participants, settings));
	});

	it('rejects group links in the user import with a clear message', () => {
		const result = parseTaskLinkImport('https://example.com/verktyg/pert/?mode=group&e=1,2,3', 'Simon');
		expect(result).toEqual({ valid: false, message: 'Gruppestimat-länkar kan inte importeras som användare.' });
	});
});

describe('names in group links', () => {
	it('round-trips names including commas, ampersands and emoji', () => {
		const names = ['Anna', 'Åsa & Bo', 'Lind, Per', 'Nisse 🚀', ''];
		const participants = names.map((name, index) => ({ o: index + 1, m: index + 2, p: index + 3, name }));

		const parsed = parsePertSearchParams(buildPertQueryString(participants, settings));

		expect(parsed.errors).toEqual([]);
		expect(parsed.rows.map((row) => row.name)).toEqual(names);
	});

	it('writes a row without a name exactly like before', () => {
		expect(buildPertQueryString([{ o: 1, m: 2, p: 3, name: '  ' }], settings)).toBe('mode=group&e=1,2,3');
	});

	it('encodes a non-empty name as the fourth value', () => {
		expect(buildPertQueryString([{ o: 1, m: 2, p: 3, name: 'Åsa & Bo' }], settings))
			.toBe('mode=group&e=1,2,3,%C3%85sa%20%26%20Bo');
	});

	it('parses a mix of named and unnamed rows', () => {
		const parsed = parsePertSearchParams('e=1,2,3,Anna&e=4,5,6');
		expect(parsed.rows).toEqual([
			{ o: '1', m: '2', p: '3', name: 'Anna' },
			{ o: '4', m: '5', p: '6', name: '' },
		]);
	});

	it('rejects a name over the length limit', () => {
		const parsed = parsePertSearchParams(`e=1,2,3,${'a'.repeat(MAX_TEXT_LENGTH + 1)}`);
		expect(parsed.rows).toEqual([]);
		expect(parsed.errors).toHaveLength(1);
		expect(parsePertSearchParams(`e=1,2,3,${'a'.repeat(MAX_TEXT_LENGTH)}`).errors).toEqual([]);
	});

	it('does not let names change the calculation', () => {
		const withNames = validatePertForm(
			parsePertSearchParams('e=1,2,3,Anna&e=4,5,9,Bo').rows,
			{ meetingHoursPerPerson: '1', hoursPerDay: '8' },
		);
		const withoutNames = validatePertForm(
			parsePertSearchParams('e=1,2,3&e=4,5,9').rows,
			{ meetingHoursPerPerson: '1', hoursPerDay: '8' },
		);
		expect(withNames).toEqual(withoutNames);
	});
});

describe('link size limits', () => {
	const taskToken = (title = 'x') => `t=${encodeURIComponent(JSON.stringify([title, 1, 2, 3]))}`;

	it('accepts exactly the participant limit and rejects one more', () => {
		const atLimit = Array.from({ length: MAX_PARTICIPANTS }, () => 'e=1,2,3').join('&');
		expect(parsePertSearchParams(atLimit).rows).toHaveLength(MAX_PARTICIPANTS);
		const over = parsePertSearchParams(`${atLimit}&e=1,2,3`);
		expect(over.rows).toEqual([]);
		expect(over.errors).toHaveLength(1);
	});

	it('accepts exactly the group limit and rejects one more', () => {
		const groups = Array.from({ length: MAX_GROUPS }, (_, i) => ({ name: `P${i}`, tasks: [{ title: 'a', o: 1, m: 2, p: 3 }] }));
		const query = buildGroupTaskPertQueryString(groups, 8);
		expect(parsePertSearchParams(query).groups).toHaveLength(MAX_GROUPS);
		const over = parsePertSearchParams(buildGroupTaskPertQueryString([...groups, groups[0]], 8));
		expect(over.groups).toEqual([]);
		expect(over.errors).toHaveLength(1);
	});

	it('limits tasks per group and in PERT Pro links', () => {
		const tasks = (count: number) => Array.from({ length: count }, (_, i) => ({ title: `T${i}`, o: 1, m: 2, p: 3 }));
		expect(parsePertSearchParams(buildTaskPertQueryString(tasks(MAX_TASKS_PER_GROUP), 8)).tasks).toHaveLength(MAX_TASKS_PER_GROUP);
		expect(parsePertSearchParams(buildTaskPertQueryString(tasks(MAX_TASKS_PER_GROUP + 1), 8)).errors).toHaveLength(1);

		const perGroup = (count: number) => buildGroupTaskPertQueryString([{ name: 'P', tasks: tasks(count) }], 8);
		expect(parsePertSearchParams(perGroup(MAX_TASKS_PER_GROUP)).groups[0].tasks).toHaveLength(MAX_TASKS_PER_GROUP);
		const over = parsePertSearchParams(perGroup(MAX_TASKS_PER_GROUP + 1));
		expect(over.groups).toEqual([]);
		expect(over.errors).toHaveLength(1);
	});

	it('limits title and name length', () => {
		const long = 'a'.repeat(MAX_TEXT_LENGTH + 1);
		const ok = 'a'.repeat(MAX_TEXT_LENGTH);
		expect(parsePertSearchParams(taskToken(ok)).tasks).toHaveLength(1);
		const tooLongTitle = parsePertSearchParams(taskToken(long));
		expect(tooLongTitle.tasks).toEqual([]);
		expect(tooLongTitle.errors).toHaveLength(1);

		const tooLongName = parsePertSearchParams(
			buildGroupTaskPertQueryString([{ name: long, tasks: [{ title: 'a', o: 1, m: 2, p: 3 }] }], 8),
		);
		expect(tooLongName.groups).toEqual([]);
		expect(tooLongName.errors).toHaveLength(1);
	});

	it('limits the total query length', () => {
		const pad = (length: number) => `e=1,2,3&x=${'a'.repeat(length - 'e=1,2,3&x='.length)}`;
		expect(parsePertSearchParams(pad(MAX_QUERY_LENGTH)).rows).toHaveLength(1);
		const over = parsePertSearchParams(pad(MAX_QUERY_LENGTH + 1));
		expect(over.rows).toEqual([]);
		expect(over.errors).toHaveLength(1);
	});
});
