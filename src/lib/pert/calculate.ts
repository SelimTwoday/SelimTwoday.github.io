import type { ParticipantEstimate, PertResult, PertSettings } from './types';

/** Arithmetic mean of a list of numbers. Assumes a non-empty array. */
export function average(values: number[]): number {
	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Population standard deviation — we have the full set of estimates, not a sample. */
export function standardDeviation(values: number[]): number {
	const mean = average(values);
	const variance = average(values.map((value) => (value - mean) ** 2));
	return Math.sqrt(variance);
}

/**
 * Classic three-point PERT expected duration:
 * (optimistic + 4 * mostLikely + pessimistic) / 6
 */
export function pertFormula(optimistic: number, mostLikely: number, pessimistic: number): number {
	return (optimistic + 4 * mostLikely + pessimistic) / 6;
}

/** Above this ratio of pertStdDev / pertHours, the O–P spread is flagged as high uncertainty. */
export const HIGH_UNCERTAINTY_THRESHOLD = 0.3;

/** Above this ratio of mStdDev / averageM, participants are flagged as not aligned on scope. */
export const TEAM_DISAGREEMENT_THRESHOLD = 0.4;

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

	// Beta-distribution approximation of the estimate's own uncertainty, derived
	// from the spread between the (averaged) optimistic and pessimistic guesses.
	const pertStdDev = (averageP - averageO) / 6;
	const pertVariance = pertStdDev ** 2;
	const pertLowHours = Math.max(0, pertHours - pertStdDev);
	const pertHighHours = pertHours + pertStdDev;
	const pertRelativeStdDev = pertHours > 0 ? pertStdDev / pertHours : 0;
	const highUncertainty = pertRelativeStdDev > HIGH_UNCERTAINTY_THRESHOLD;

	// Meeting time is a fixed cost, not a random variable, so it shifts the
	// interval without widening it.
	const finalLowHours = pertLowHours + meetingTotalHours;
	const finalHighHours = pertHighHours + meetingTotalHours;

	// Spread of participants' "most likely" guesses — flags teams that haven't
	// converged on the same understanding of scope, which averaging would hide.
	const mStdDev = standardDeviation(participants.map((p) => p.m));
	const mRelativeStdDev = averageM > 0 ? mStdDev / averageM : 0;
	const teamDisagreement = mRelativeStdDev > TEAM_DISAGREEMENT_THRESHOLD;

	return {
		averageO,
		averageM,
		averageP,
		pertHours,
		pertStdDev,
		pertVariance,
		pertLowHours,
		pertHighHours,
		pertRelativeStdDev,
		highUncertainty,
		finalLowHours,
		finalHighHours,
		mStdDev,
		mRelativeStdDev,
		teamDisagreement,
		peopleCount,
		meetingHoursPerPerson: settings.meetingHoursPerPerson,
		meetingTotalHours,
		finalHours,
		hoursPerDay: settings.hoursPerDay,
		workdays,
	};
}
