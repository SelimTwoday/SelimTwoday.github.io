import { calculateGroupTaskPert, calculatePert, calculateTaskPert } from './calculate';
import { parseSwedishNumber } from './format';
import { DEFAULT_HOURS_PER_DAY } from './types';
import type {
	FieldError,
	GroupTaskPertValidationResult,
	ParticipantEstimate,
	ParticipantRowInput,
	PertSettings,
	PertSettingsInput,
	PertValidationResult,
	TaskEstimate,
	TaskPertValidationResult,
	TaskRowInput,
	TaskGroupInput,
	TaskGroupEstimate,
} from './types';

function parseField(
	field: string,
	raw: string,
	errors: FieldError[],
	options: { allowZero: boolean } = { allowZero: true },
): number | null {
	if (raw.trim() === '') {
		errors.push({ field, code: 'required', message: 'Fältet får inte vara tomt.' });
		return null;
	}
	const value = parseSwedishNumber(raw);
	if (value === null) {
		errors.push({ field, code: 'not-a-number', message: 'Ange ett giltigt tal, t.ex. 8,5.' });
		return null;
	}
	if (value < 0) {
		errors.push({ field, code: 'negative', message: 'Talet får inte vara negativt.' });
		return null;
	}
	if (!options.allowZero && value <= 0) {
		errors.push({ field, code: 'must-be-positive', message: 'Talet måste vara större än 0.' });
		return null;
	}
	return value;
}

/** Validates and parses a single participant row. Pushes errors as found. */
export function validateParticipantRow(
	row: ParticipantRowInput,
	index: number,
	errors: FieldError[],
): ParticipantEstimate | null {
	const o = parseField(`row-${index}-o`, row.o, errors);
	const m = parseField(`row-${index}-m`, row.m, errors);
	const p = parseField(`row-${index}-p`, row.p, errors);

	if (o === null || m === null || p === null) return null;

	if (!(o <= m && m <= p)) {
		errors.push({
			field: `row-${index}-order`,
			code: 'order',
			message: 'Ordningen måste vara Optimistisk ≤ Mest sannolik ≤ Pessimistisk.',
		});
		return null;
	}

	return { o, m, p };
}

/** Validates the global meeting/workday settings. */
export function validatePertSettings(
	input: PertSettingsInput,
	errors: FieldError[],
): PertSettings | null {
	const meetingHoursPerPerson = parseField(
		'settings-meetingHoursPerPerson',
		input.meetingHoursPerPerson,
		errors,
	);
	const hoursPerDay = parseField('settings-hoursPerDay', input.hoursPerDay, errors, {
		allowZero: false,
	});

	if (meetingHoursPerPerson === null || hoursPerDay === null) return null;

	return { meetingHoursPerPerson, hoursPerDay };
}

/**
 * Validates a full PERT form (participant rows + settings) and, when valid,
 * computes the result. This is the single entry point the UI layer should
 * call — it never touches the DOM.
 */
export function validatePertForm(
	rows: ParticipantRowInput[],
	settingsInput: PertSettingsInput,
): PertValidationResult {
	const errors: FieldError[] = [];

	if (rows.length === 0) {
		errors.push({
			field: 'participants',
			code: 'no-participants',
			message: 'Minst en deltagare krävs.',
		});
		return { valid: false, errors, participants: null, settings: null, result: null };
	}

	const participants: ParticipantEstimate[] = [];
	for (let index = 0; index < rows.length; index += 1) {
		const parsed = validateParticipantRow(rows[index], index, errors);
		if (parsed) participants.push(parsed);
	}

	const settings = validatePertSettings(settingsInput, errors);

	if (errors.length > 0 || !settings || participants.length !== rows.length) {
		return { valid: false, errors, participants: null, settings: null, result: null };
	}

	const result = calculatePert(participants, settings);

	return { valid: true, errors: [], participants, settings, result };
}

/** Validates named subtask rows and computes their combined uncertainty. */
export function validateTaskPertForm(
	rows: TaskRowInput[],
	hoursPerDayInput: string,
): TaskPertValidationResult {
	const errors: FieldError[] = [];

	if (rows.length === 0) {
		errors.push({
			field: 'tasks',
			code: 'no-participants',
			message: 'Minst en deluppgift krävs.',
		});
		return { valid: false, errors, tasks: null, result: null };
	}

	const tasks: TaskEstimate[] = [];
	for (let index = 0; index < rows.length; index += 1) {
		const title = rows[index].title.trim();
		if (!title) {
			errors.push({
				field: `task-${index}-title`,
				code: 'required',
				message: 'Ange en titel för deluppgiften.',
			});
		}

		const parsed = validateParticipantRow(rows[index], index, errors);
		if (title && parsed) tasks.push({ title, ...parsed });
	}

	const hoursPerDay = parseField('settings-hoursPerDay', hoursPerDayInput, errors, {
		allowZero: false,
	});

	if (errors.length > 0 || hoursPerDay === null || tasks.length !== rows.length) {
		return { valid: false, errors, tasks: null, result: null };
	}

	const result = calculateTaskPert(tasks, hoursPerDay);
	if (![result.expectedHours, result.variance, result.workdays].every(Number.isFinite)) {
		return {
			valid: false,
			errors: [{ field: 'tasks', code: 'not-a-number', message: 'Värdena är för stora för att beräkna ett giltigt estimat.' }],
			tasks: null,
			result: null,
		};
	}
	return {
		valid: true,
		errors: [],
		tasks,
		result,
	};
}

export function validateGroupTaskPertForm(
	inputs: TaskGroupInput[],
	hoursPerDayInput: string,
): GroupTaskPertValidationResult {
	const errors: FieldError[] = [];
	const groups: TaskGroupEstimate[] = [];
	if (inputs.length === 0) {
		errors.push({ field: 'groups', code: 'no-participants', message: 'Minst en användare krävs.' });
	}

	inputs.forEach((input, index) => {
		const name = input.name.trim();
		if (!name) {
			errors.push({
				field: `group-${index}-name`,
				code: 'required',
				message: 'Ange ett namn för användaren.',
			});
		}
		const validation = validateTaskPertForm(input.tasks, String(DEFAULT_HOURS_PER_DAY));
		if (!validation.valid) {
			errors.push(...validation.errors.map((error) => ({
				...error,
				field: `group-${index}-${error.field}`,
			})));
		} else if (name) {
			groups.push({ name, tasks: validation.tasks });
		}
	});
	const hoursPerDay = parseField('settings-hoursPerDay', hoursPerDayInput, errors, { allowZero: false });
	if (errors.length > 0 || hoursPerDay === null) {
		return { valid: false, errors, groups: null, result: null };
	}
	const result = calculateGroupTaskPert(groups, hoursPerDay);
	if (![result.expectedHours, result.variance, result.workdays].every(Number.isFinite)) {
		return {
			valid: false,
			errors: [{ field: 'groups', code: 'not-a-number', message: 'Värdena är för stora för att beräkna ett giltigt gruppestimat.' }],
			groups: null,
			result: null,
		};
	}
	return { valid: true, errors: [], groups, result };
}
