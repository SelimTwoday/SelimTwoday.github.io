import {
	DEFAULT_HOURS_PER_DAY,
	DEFAULT_MEETING_HOURS_PER_PERSON,
	MAX_GROUPS,
	MAX_PARTICIPANTS,
	MAX_QUERY_LENGTH,
	MAX_TASKS_PER_GROUP,
	MAX_TEXT_LENGTH,
	type ParticipantEstimate,
	type ParticipantRowInput,
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

/** URL token for the group estimate mode. The internal PertMode stays 'participants'. */
export const GROUP_MODE_TOKEN = 'group';

/** Maps the `mode` URL token to the internal mode. Unknown or missing tokens mean 'participants'. */
export const URL_TOKEN_TO_MODE: ReadonlyMap<string, PertMode> = new Map<string, PertMode>([
	[GROUP_MODE_TOKEN, 'participants'],
	['tasks', 'tasks'],
	['grouptasks', 'grouptasks'],
]);

/** Trims a display name and keeps it within the URL limit; '' means "no name". */
function normalizeName(name: string | undefined): string {
	const trimmed = (name ?? '').trim().slice(0, MAX_TEXT_LENGTH);
	return typeof trimmed.toWellFormed === 'function' ? trimmed.toWellFormed() : trimmed;
}

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
 * "mode=group&e=6,14,34&e=8,16,28&e=8,16,40". A non-empty name is appended as
 * a fourth, percent-encoded value. The meeting time and hours/day are only
 * included when they differ from the defaults, keeping URLs short.
 */
export function buildPertQueryString(
	participants: (ParticipantEstimate & { name?: string })[],
	settings: PertSettings,
): string {
	// Built manually (not via URLSearchParams.toString()) so commas stay
	// literal in the query string, matching the required "?e=6,14,34&..."
	// shape instead of being percent-encoded as "%2C".
	const segments: string[] = [`${MODE_PARAM}=${GROUP_MODE_TOKEN}`];

	for (const participant of participants) {
		const values = [participant.o, participant.m, participant.p].map(numberToUrlToken);
		const name = normalizeName(participant.name);
		if (name) values.push(encodeURIComponent(name));
		segments.push(`${ESTIMATE_PARAM}=${values.join(',')}`);
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
	participants: (ParticipantEstimate & { name?: string })[],
	settings: PertSettings,
): string {
	const query = buildPertQueryString(participants, settings);
	const base = baseUrl.split('?')[0];
	return query ? `${base}?${query}` : base;
}

/** Optional estimation meeting added on top of an Enterprise estimate. */
export interface MeetingLink {
	hoursPerPerson: number;
}

/**
 * Builds a query string for task mode without changing the legacy participant format.
 * The meeting is only written when one has been added; `m` is then always
 * present, since its absence means "no meeting" in this mode.
 */
export function buildTaskPertQueryString(
	tasks: TaskEstimate[],
	hoursPerDay: number,
	meeting?: MeetingLink,
): string {
	const params = new URLSearchParams();
	params.set(MODE_PARAM, 'tasks');
	for (const task of tasks) {
		params.append(TASK_PARAM, JSON.stringify([task.title, task.o, task.m, task.p]));
	}
	if (hoursPerDay !== DEFAULT_HOURS_PER_DAY) {
		params.set(HOURS_PER_DAY_PARAM, numberToUrlToken(hoursPerDay));
	}
	appendMeeting(params, meeting);
	return params.toString();
}

function appendMeeting(params: URLSearchParams, meeting: MeetingLink | undefined): void {
	if (!meeting) return;
	params.set(MEETING_PARAM, numberToUrlToken(meeting.hoursPerPerson));
}

export function buildTaskPertShareUrl(
	baseUrl: string,
	tasks: TaskEstimate[],
	hoursPerDay: number,
): string {
	const base = baseUrl.split('?')[0];
	return `${base}?${buildTaskPertQueryString(tasks, hoursPerDay)}`;
}

export function buildGroupTaskPertQueryString(
	groups: TaskGroupEstimate[],
	hoursPerDay: number,
	meeting?: MeetingLink,
): string {
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
	appendMeeting(params, meeting);
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
	rows: (ParticipantRowInput & { name: string })[];
	tasks: { title: string; o: string; m: string; p: string }[];
	groups: TaskGroupInput[];
	errors: string[];
	meetingHoursPerPerson: string;
	/** True when the link has an explicit `m`. In Enterprise (and old PERT Pro links) that means a meeting was added. */
	meetingPresent: boolean;
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
	if (value[1].length > MAX_TASKS_PER_GROUP) return null;
	const tasks = value[1].map(parseTaskValue);
	if (tasks.some((task) => task === null)) return null;
	return { name: value[0], tasks: tasks.filter((task): task is TaskRowInput => task !== null) };
}

/** Returns the first limit violation as a Swedish message, or null when the query is within limits. */
function findLimitViolation(params: URLSearchParams, queryLength: number): string | null {
	if (queryLength > MAX_QUERY_LENGTH) return 'Länken är för lång för att öppnas.';
	if (params.getAll(ESTIMATE_PARAM).length > MAX_PARTICIPANTS) {
		return `Länken innehåller fler än ${MAX_PARTICIPANTS} deltagare.`;
	}
	if (params.getAll(TASK_PARAM).length > MAX_TASKS_PER_GROUP) {
		return `Länken innehåller fler än ${MAX_TASKS_PER_GROUP} deluppgifter.`;
	}
	if (params.getAll(GROUP_PARAM).length > MAX_GROUPS) {
		return `Länken innehåller fler än ${MAX_GROUPS} personer.`;
	}
	return null;
}

/**
 * Parses PERT parameters out of a URLSearchParams (or query string). Values
 * are returned as raw strings — validation/parsing of Swedish decimals is
 * intentionally left to validatePertForm so URL input goes through the same
 * rules as manual input. A link that exceeds the size limits yields an error
 * and no rows, never a partial parse.
 */
export function parsePertSearchParams(
	search: string | URLSearchParams,
): ParsedPertUrl {
	const queryText = typeof search === 'string' ? search : search.toString();
	const params = typeof search === 'string' ? new URLSearchParams(search) : search;

	const modeParam = params.get(MODE_PARAM);
	const mode: PertMode = (modeParam !== null && URL_TOKEN_TO_MODE.get(modeParam)) || 'participants';
	const meetingHoursPerPerson =
		params.get(MEETING_PARAM) ?? String(DEFAULT_MEETING_HOURS_PER_PERSON);
	const shared = {
		meetingHoursPerPerson,
		meetingPresent: params.has(MEETING_PARAM),
		hoursPerDay: params.get(HOURS_PER_DAY_PARAM) ?? String(DEFAULT_HOURS_PER_DAY),
	};

	const violation = findLimitViolation(params, queryText.length);
	if (violation) {
		return { mode, rows: [], tasks: [], groups: [], errors: [violation], ...shared };
	}

	const errors: string[] = [];
	const empty = (message: string): ParsedPertUrl => (
		{ mode, rows: [], tasks: [], groups: [], errors: [message], ...shared }
	);
	const tooLongMessage = `Ett namn eller en titel i länken är längre än ${MAX_TEXT_LENGTH} tecken.`;

	const rows: ParsedPertUrl['rows'] = [];
	for (const token of params.getAll(ESTIMATE_PARAM)) {
		const parts = token.split(',');
		if (parts.length < 3) continue;
		const [o, m, p] = parts;
		const name = parts.slice(3).join(',').trim();
		if (name.length > MAX_TEXT_LENGTH) return empty(tooLongMessage);
		rows.push({ o: o.trim(), m: m.trim(), p: p.trim(), name });
	}

	const tasks = params.getAll(TASK_PARAM).map((token) => parseTaskValue(decodeJson(token)));
	const groups = params.getAll(GROUP_PARAM).map((token) => parseGroupValue(decodeJson(token)));
	if (tasks.some((task) => task === null)) errors.push('Länken innehåller en ogiltig deluppgift.');
	if (groups.some((group) => group === null)) errors.push('Länken innehåller en ogiltig användare eller deluppgiftslista.');

	const validTasks = tasks.filter((task): task is TaskRowInput => task !== null);
	const validGroups = groups.filter((group): group is TaskGroupInput => group !== null);
	const tooLong = (text: string) => text.length > MAX_TEXT_LENGTH;
	if (
		validTasks.some((task) => tooLong(task.title)) ||
		validGroups.some((group) => tooLong(group.name) || group.tasks.some((task) => tooLong(task.title)))
	) {
		return empty(tooLongMessage);
	}

	return { mode, rows, tasks: validTasks, groups: validGroups, errors, ...shared };
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
	if (mode === GROUP_MODE_TOKEN || (mode === null && url.searchParams.has(ESTIMATE_PARAM))) {
		return { valid: false, message: 'Gruppestimat-länkar kan inte importeras som användare.' };
	}
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
