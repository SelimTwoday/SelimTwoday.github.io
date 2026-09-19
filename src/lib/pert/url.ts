import {
	DEFAULT_HOURS_PER_DAY,
	DEFAULT_MEETING_HOURS_PER_PERSON,
	type ParticipantEstimate,
	type PertSettings,
} from './types';

const ESTIMATE_PARAM = 'e';
const MEETING_PARAM = 'm';
const HOURS_PER_DAY_PARAM = 'h';

/** Formats a number for URL usage: plain dot-decimal, no trailing zeros. */
function numberToUrlToken(value: number): string {
	return String(value);
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

export interface ParsedPertUrl {
	/** Raw string rows suitable for prefilling the form, "" when absent. */
	rows: { o: string; m: string; p: string }[];
	meetingHoursPerPerson: string;
	hoursPerDay: string;
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

	const meetingHoursPerPerson =
		params.get(MEETING_PARAM) ?? String(DEFAULT_MEETING_HOURS_PER_PERSON);
	const hoursPerDay = params.get(HOURS_PER_DAY_PARAM) ?? String(DEFAULT_HOURS_PER_DAY);

	return { rows, meetingHoursPerPerson, hoursPerDay };
}
