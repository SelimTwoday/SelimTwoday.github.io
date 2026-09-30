import { calculateGroupTaskPert, calculatePert, calculateTaskPert, pertFormula, pertVariance } from './calculate';
import { parseSwedishNumber } from './format';
import { DEFAULT_HOURS_PER_DAY, DEFAULT_MEETING_HOURS_PER_PERSON } from './types';
import type {
	PertResult,
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
	GroupTaskPertResult,
	Preview,
	RowEvaluation,
	TaskPertResult,
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

/**
 * Evaluates one estimate row on its own, so the UI can show the expected
 * time while the user types even if other rows are unfinished.
 */
export function evaluateRow(row: ParticipantRowInput): RowEvaluation {
	const fields = ['o', 'm', 'p'] as const;
	const blank = (state: RowEvaluation['state'], errors: FieldError[] = []): RowEvaluation => ({
		state,
		expectedHours: null,
		standardDeviation: null,
		errors,
	});

	const filled = fields.filter((key) => row[key].trim() !== '');
	if (filled.length === 0) return blank('empty');

	const errors: FieldError[] = [];
	const values: Record<(typeof fields)[number], number | null> = { o: null, m: null, p: null };
	for (const key of filled) values[key] = parseField(key, row[key], errors);
	if (errors.length > 0) return blank('invalid', errors);
	if (filled.length < fields.length) return blank('incomplete');

	const { o, m, p } = values as Record<(typeof fields)[number], number>;
	if (!(o <= m && m <= p)) {
		return blank('order', [{
			field: 'order',
			code: 'order',
			message: 'Ordningen måste vara Optimistisk ≤ Mest sannolik ≤ Pessimistisk.',
		}]);
	}
	return {
		state: 'ok',
		expectedHours: pertFormula(o, m, p),
		standardDeviation: Math.sqrt(pertVariance(o, p)),
		errors: [],
	};
}

function previewHoursPerDay(input: string): number {
	const parsed = parseSwedishNumber(input);
	return parsed !== null && parsed > 0 ? parsed : DEFAULT_HOURS_PER_DAY;
}

function isFiniteTaskResult(result: TaskPertResult | GroupTaskPertResult): boolean {
	return [result.expectedHours, result.variance, result.workdays].every(Number.isFinite);
}

/** PERT Pro preview: computes over the rows that are usable right now. */
export function previewTaskPert(
	rows: TaskRowInput[],
	hoursPerDayInput: string,
): Preview<TaskPertResult> {
	const evaluations = rows.map(evaluateRow);
	const usable: TaskEstimate[] = [];
	rows.forEach((row, index) => {
		if (evaluations[index].state !== 'ok') return;
		usable.push({
			title: row.title.trim(),
			o: parseSwedishNumber(row.o) as number,
			m: parseSwedishNumber(row.m) as number,
			p: parseSwedishNumber(row.p) as number,
		});
	});

	const calculated = usable.length > 0
		? calculateTaskPert(usable, previewHoursPerDay(hoursPerDayInput))
		: null;
	const result = calculated && isFiniteTaskResult(calculated) ? calculated : null;
	return {
		result,
		complete: validateTaskPertForm(rows, hoursPerDayInput).valid,
		excludedRows: rows.length - usable.length,
		hasErrors: evaluations.some((evaluation) => evaluation.state === 'invalid' || evaluation.state === 'order'),
	};
}

/**
 * Enterprise preview: a person counts when they have a name and at least one
 * usable row. Rows that are not usable are left out of that person's total.
 */
export function previewGroupPert(
	inputs: TaskGroupInput[],
	hoursPerDayInput: string,
): Preview<GroupTaskPertResult> {
	let excludedRows = 0;
	let hasErrors = false;
	const groups: TaskGroupEstimate[] = [];

	for (const input of inputs) {
		const evaluations = input.tasks.map(evaluateRow);
		if (evaluations.some((evaluation) => evaluation.state === 'invalid' || evaluation.state === 'order')) {
			hasErrors = true;
		}
		const tasks: TaskEstimate[] = [];
		input.tasks.forEach((task, index) => {
			if (evaluations[index].state !== 'ok') return;
			tasks.push({
				title: task.title.trim(),
				o: parseSwedishNumber(task.o) as number,
				m: parseSwedishNumber(task.m) as number,
				p: parseSwedishNumber(task.p) as number,
			});
		});

		const name = input.name.trim();
		if (name && tasks.length > 0) {
			groups.push({ name, tasks });
			excludedRows += input.tasks.length - tasks.length;
		} else {
			excludedRows += input.tasks.length;
		}
	}

	const calculated = groups.length > 0
		? calculateGroupTaskPert(groups, previewHoursPerDay(hoursPerDayInput))
		: null;
	const result = calculated && isFiniteTaskResult(calculated) ? calculated : null;
	return {
		result,
		complete: validateGroupTaskPertForm(inputs, hoursPerDayInput).valid,
		excludedRows,
		hasErrors,
	};
}

/** Group estimate preview over the participant rows that are usable right now. */
export function previewParticipantPert(
	rows: ParticipantRowInput[],
	settingsInput: PertSettingsInput,
): Preview<PertResult> {
	const evaluations = rows.map(evaluateRow);
	const usable: ParticipantEstimate[] = [];
	rows.forEach((row, index) => {
		if (evaluations[index].state !== 'ok') return;
		usable.push({
			o: parseSwedishNumber(row.o) as number,
			m: parseSwedishNumber(row.m) as number,
			p: parseSwedishNumber(row.p) as number,
		});
	});

	const meeting = parseSwedishNumber(settingsInput.meetingHoursPerPerson);
	const settings: PertSettings = {
		meetingHoursPerPerson: meeting !== null && meeting >= 0 ? meeting : DEFAULT_MEETING_HOURS_PER_PERSON,
		hoursPerDay: previewHoursPerDay(settingsInput.hoursPerDay),
	};
	const calculated = usable.length > 0 ? calculatePert(usable, settings) : null;
	const result = calculated && Number.isFinite(calculated.finalHours) ? calculated : null;
	return {
		result,
		complete: validatePertForm(rows, settingsInput).valid,
		excludedRows: rows.length - usable.length,
		hasErrors: evaluations.some((evaluation) => evaluation.state === 'invalid' || evaluation.state === 'order'),
	};
}
