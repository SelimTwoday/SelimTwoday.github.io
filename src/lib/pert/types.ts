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
	/** Beta-distribution approximation: (averageP - averageO) / 6. */
	pertStdDev: number;
	pertVariance: number;
	/** pertHours - pertStdDev, clamped to 0 - lower bound of the ~68% interval. */
	pertLowHours: number;
	/** pertHours + pertStdDev - upper bound of the ~68% interval. */
	pertHighHours: number;
	/** pertStdDev / pertHours - how wide the O-P spread is relative to the estimate. */
	pertRelativeStdDev: number;
	/** True when pertRelativeStdDev exceeds HIGH_UNCERTAINTY_THRESHOLD. */
	highUncertainty: boolean;
	/** finalHours - pertStdDev (via pertLowHours), clamped to 0 - lower bound of the interval. */
	finalLowHours: number;
	/** finalHours + pertStdDev (via pertHighHours) - upper bound of the interval. */
	finalHighHours: number;
	/** Population standard deviation of participants' "most likely" (m) values. */
	mStdDev: number;
	/** mStdDev / averageM - how much participants disagree relative to the average. */
	mRelativeStdDev: number;
	/** True when mRelativeStdDev exceeds TEAM_DISAGREEMENT_THRESHOLD. */
	teamDisagreement: boolean;
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
