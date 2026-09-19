/** A single participant's PERT estimate, already parsed as numbers (hours). */
export interface ParticipantEstimate {
	o: number;
	m: number;
	p: number;
}

/** Raw, unvalidated string input for a participant row, as typed in the UI. */
export interface ParticipantRowInput {
	o: string;
	m: string;
	p: string;
}

/** Global settings that apply to the whole estimation. */
export interface PertSettings {
	/** Meeting/estimation hours spent per person. */
	meetingHoursPerPerson: number;
	/** Working hours in a single workday. */
	hoursPerDay: number;
}

/** Raw, unvalidated string input for the global settings. */
export interface PertSettingsInput {
	meetingHoursPerPerson: string;
	hoursPerDay: string;
}

/** Fully computed PERT result, ready to render. */
export interface PertResult {
	averageO: number;
	averageM: number;
	averageP: number;
	/** (avgO + 4 * avgM + avgP) / 6, excluding meeting time. */
	pertHours: number;
	peopleCount: number;
	meetingHoursPerPerson: number;
	meetingTotalHours: number;
	/** pertHours + meetingTotalHours */
	finalHours: number;
	hoursPerDay: number;
	workdays: number;
}

export type FieldErrorCode =
	| 'required'
	| 'not-a-number'
	| 'negative'
	| 'order'
	| 'must-be-positive'
	| 'no-participants';

export interface FieldError {
	/** Machine-readable location, e.g. "row-0-o" or "settings-hoursPerDay". */
	field: string;
	code: FieldErrorCode;
	/** Human readable, Swedish error message. */
	message: string;
}

export interface PertValidationSuccess {
	valid: true;
	errors: [];
	participants: ParticipantEstimate[];
	settings: PertSettings;
	result: PertResult;
}

export interface PertValidationFailure {
	valid: false;
	errors: FieldError[];
	participants: null;
	settings: null;
	result: null;
}

export type PertValidationResult = PertValidationSuccess | PertValidationFailure;

export const DEFAULT_MEETING_HOURS_PER_PERSON = 1;
export const DEFAULT_HOURS_PER_DAY = 8;
