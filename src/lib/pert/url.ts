import {
	DEFAULT_HOURS_PER_DAY,
	DEFAULT_MEETING_HOURS_PER_PERSON,
	type ParticipantEstimate,
	type PertSettings,
	type TaskEstimate,
	type TaskGroupEstimate,
	type TaskGroupInput,
	type TaskRowInput,
	type PertMode,
} from './types';
import { validateGroupTaskPertForm } from './validate';

const ESTIMATE_PARAM = 'e';
const MEETING_PARAM = 'm';
const HOURS_PER_DAY_PARAM = 'h';
const MODE_PARAM = 'mode';
const TASK_PARAM = 't';
const GROUP_PARAM = 'g';

/** Formats a number for URL usage: plain dot-decimal, no trailing zeros. */
function numberToUrlToken(value: number): string {
	const text = String(value);
	if (!text.includes('e')) return text;
	const [coefficient, exponent] = text.split('e');
	const negative = coefficient.startsWith('-');
	const [integer, fraction = ''] = coefficient.replace('-', '').split('.');
	const digits = integer + fraction;
	const point = integer.length + Number(exponent);
	const decimal = point <= 0
		? `0.${'0'.repeat(-point)}${digits}`
		: point >= digits.length
			? digits + '0'.repeat(point - digits.length)
			: `${digits.slice(0, point)}.${digits.slice(point)}`;
	return negative ? `-${decimal}` : decimal;
}

/**
 * Builds the query string (without leading "?") that reproduces the given
 * participants and settings exactly, e.g.
 * "e=6,14,34&e=8,16,28&e=8,16,40". The meeting time and hours/day are only
 * included when they differ from the defaults, keeping URLs short.
 */
export function buildPertQueryString(
	participants: ParticipantEstimate[],
	settings: PertSettings,
): string {
	// Built manually (not via URLSearchParams.toString()) so commas stay
	// literal in the query string, matching the required "?e=6,14,34&..."
	// shape instead of being percent-encoded as "%2C".
	const segments: string[] = [];

	for (const participant of participants) {
		const token = [participant.o, participant.m, participant.p].map(numberToUrlToken).join(',');
		segments.push(`${ESTIMATE_PARAM}=${token}`);
	}

	if (settings.meetingHoursPerPerson !== DEFAULT_MEETING_HOURS_PER_PERSON) {
		segments.push(`${MEETING_PARAM}=${numberToUrlToken(settings.meetingHoursPerPerson)}`);
	}

	if (settings.hoursPerDay !== DEFAULT_HOURS_PER_DAY) {
		segments.push(`${HOURS_PER_DAY_PARAM}=${numberToUrlToken(settings.hoursPerDay)}`);
	}

	return segments.join('&');
}

/** Builds a full shareable URL for the given page origin+pathname. */
export function buildPertShareUrl(
	baseUrl: string,
	participants: ParticipantEstimate[],
	settings: PertSettings,
): string {
	const query = buildPertQueryString(participants, settings);
	const base = baseUrl.split('?')[0];
	return query ? `${base}?${query}` : base;
}

/** Builds a query string for task mode without changing the legacy participant format. */
export function buildTaskPertQueryString(tasks: TaskEstimate[], hoursPerDay: number): string {
	const params = new URLSearchParams();
	params.set(MODE_PARAM, 'tasks');
	for (const task of tasks) {
		params.append(TASK_PARAM, JSON.stringify([task.title, task.o, task.m, task.p]));
	}
	if (hoursPerDay !== DEFAULT_HOURS_PER_DAY) {
		params.set(HOURS_PER_DAY_PARAM, numberToUrlToken(hoursPerDay));
	}
	return params.toString();
}

export function buildTaskPertShareUrl(
	baseUrl: string,
	tasks: TaskEstimate[],
	hoursPerDay: number,
): string {
	const base = baseUrl.split('?')[0];
	return `${base}?${buildTaskPertQueryString(tasks, hoursPerDay)}`;
}

export function buildGroupTaskPertQueryString(groups: TaskGroupEstimate[], hoursPerDay: number): string {
	const params = new URLSearchParams();
	params.set(MODE_PARAM, 'grouptasks');
	for (const group of groups) {
		params.append(GROUP_PARAM, JSON.stringify([
			group.name,
			group.tasks.map((task) => [task.title, task.o, task.m, task.p]),
		]));
	}
	if (hoursPerDay !== DEFAULT_HOURS_PER_DAY) {
		params.set(HOURS_PER_DAY_PARAM, numberToUrlToken(hoursPerDay));
	}
	return params.toString();
}

export function buildGroupTaskPertShareUrl(
	baseUrl: string,
	groups: TaskGroupEstimate[],
	hoursPerDay: number,
): string {
	return `${baseUrl.split('?')[0]}?${buildGroupTaskPertQueryString(groups, hoursPerDay)}`;
}

export interface ParsedPertUrl {
	mode: PertMode;
	/** Raw string rows suitable for prefilling the form, "" when absent. */
	rows: { o: string; m: string; p: string }[];
	tasks: { title: string; o: string; m: string; p: string }[];
	groups: TaskGroupInput[];
	errors: string[];
	meetingHoursPerPerson: string;
	hoursPerDay: string;
}

function parseTaskValue(value: unknown): TaskRowInput | null {
	if (
		!Array.isArray(value) ||
		value.length !== 4 ||
		typeof value[0] !== 'string' ||
		!value.slice(1).every((number) => typeof number === 'number' && Number.isFinite(number))
	) return null;
	return {
		title: value[0],
		o: numberToUrlToken(value[1]),
		m: numberToUrlToken(value[2]),
		p: numberToUrlToken(value[3]),
	};
}

function decodeJson(token: string): unknown {
	try {
		return JSON.parse(token);
	} catch {
		return null;
	}
}

function parseGroupValue(value: unknown): TaskGroupInput | null {
	if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== 'string' || !Array.isArray(value[1])) {
		return null;
	}
	const tasks = value[1].map(parseTaskValue);
	if (tasks.some((task) => task === null)) return null;
	return { name: value[0], tasks: tasks.filter((task): task is TaskRowInput => task !== null) };
}

/**
 * Parses PERT parameters out of a URLSearchParams (or query string). Values
 * are returned as raw strings — validation/parsing of Swedish decimals is
 * intentionally left to validatePertForm so URL input goes through the same
 * rules as manual input.
 */
export function parsePertSearchParams(
	search: string | URLSearchParams,
): ParsedPertUrl {
	const params = typeof search === 'string' ? new URLSearchParams(search) : search;

	const rows = params
		.getAll(ESTIMATE_PARAM)
		.map((token) => token.split(','))
		.filter((parts) => parts.length === 3)
		.map(([o, m, p]) => ({ o: o.trim(), m: m.trim(), p: p.trim() }));

	const errors: string[] = [];
	const tasks = params.getAll(TASK_PARAM).map((token) => parseTaskValue(decodeJson(token)));
	const groups = params.getAll(GROUP_PARAM).map((token) => parseGroupValue(decodeJson(token)));
	if (tasks.some((task) => task === null)) errors.push('Länken innehåller en ogiltig deluppgift.');
	if (groups.some((group) => group === null)) errors.push('Länken innehåller en ogiltig användare eller deluppgiftslista.');

	const meetingHoursPerPerson =
		params.get(MEETING_PARAM) ?? String(DEFAULT_MEETING_HOURS_PER_PERSON);
	const hoursPerDay = params.get(HOURS_PER_DAY_PARAM) ?? String(DEFAULT_HOURS_PER_DAY);

	const modeParam = params.get(MODE_PARAM);
	const mode: PertMode = modeParam === 'tasks' || modeParam === 'grouptasks' ? modeParam : 'participants';

	return {
		mode, rows,
		tasks: tasks.filter((task): task is TaskRowInput => task !== null),
		groups: groups.filter((group): group is TaskGroupInput => group !== null),
		errors, meetingHoursPerPerson, hoursPerDay,
	};
}

export type TaskLinkImportResult =
	| { valid: true; groups: TaskGroupInput[]; hoursPerDay: string; sourceMode: 'tasks' | 'grouptasks' }
	| { valid: false; message: string };

/** Reads only encoded estimates; never fetches or executes the pasted URL. */
export function parseTaskLinkImport(value: string, fallbackName: string): TaskLinkImportResult {
	let url: URL;
	try {
		url = new URL(value.trim());
	} catch {
		return { valid: false, message: 'Klistra in en fullständig PERT-länk som börjar med https:// eller http://.' };
	}
	if (url.protocol !== 'https:' && url.protocol !== 'http:') {
		return { valid: false, message: 'Endast http- och https-länkar kan importeras.' };
	}
	const mode = url.searchParams.get(MODE_PARAM);
	if (mode !== 'tasks' && mode !== 'grouptasks') {
		return { valid: false, message: 'Länken måste använda mode=tasks eller mode=grouptasks.' };
	}
	const parsed = parsePertSearchParams(url.searchParams);
	if (parsed.errors.length > 0) return { valid: false, message: parsed.errors.join(' ') };
	const groups = mode === 'tasks'
		? [{ name: fallbackName.trim(), tasks: parsed.tasks }]
		: parsed.groups;
	const validation = validateGroupTaskPertForm(groups, parsed.hoursPerDay);
	if (!validation.valid) {
		return { valid: false, message: `Länken kunde inte importeras: ${validation.errors[0].message}` };
	}
	return { valid: true, groups, hoursPerDay: parsed.hoursPerDay, sourceMode: mode };
}
