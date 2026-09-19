import type { ParticipantEstimate, PertResult, PertSettings } from './types';

/** Arithmetic mean of a list of numbers. Assumes a non-empty array. */
export function average(values: number[]): number {
	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Classic three-point PERT expected duration:
 * (optimistic + 4 * mostLikely + pessimistic) / 6
 */
export function pertFormula(optimistic: number, mostLikely: number, pessimistic: number): number {
	return (optimistic + 4 * mostLikely + pessimistic) / 6;
}

/**
 * Computes the full PERT result for a group of participants.
 * Pure function: no parsing, no DOM, no formatting — just numbers in, numbers out.
 */
export function calculatePert(
	participants: ParticipantEstimate[],
	settings: PertSettings,
): PertResult {
	const averageO = average(participants.map((p) => p.o));
	const averageM = average(participants.map((p) => p.m));
	const averageP = average(participants.map((p) => p.p));

	const pertHours = pertFormula(averageO, averageM, averageP);
	const peopleCount = participants.length;
	const meetingTotalHours = settings.meetingHoursPerPerson * peopleCount;
	const finalHours = pertHours + meetingTotalHours;
	const workdays = finalHours / settings.hoursPerDay;

	return {
		averageO,
		averageM,
		averageP,
		pertHours,
		peopleCount,
		meetingHoursPerPerson: settings.meetingHoursPerPerson,
		meetingTotalHours,
		finalHours,
		hoursPerDay: settings.hoursPerDay,
		workdays,
	};
}
