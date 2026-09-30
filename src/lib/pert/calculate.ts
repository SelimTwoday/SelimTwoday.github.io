import type {
	ConfidenceInterval,
	GroupTaskPertResult,
	ParticipantEstimate,
	PertResult,
	PertSettings,
	TaskEstimate,
	TaskPertResult,
	TaskGroupEstimate,
} from './types';

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

/** PERT variance for one estimate, based on sigma = (P - O) / 6. */
export function pertVariance(optimistic: number, pessimistic: number): number {
	return ((pessimistic - optimistic) / 6) ** 2;
}

function confidenceIntervals(
	expectedHours: number,
	deviation: number,
	clampLower = false,
): ConfidenceInterval[] {
	return ([1, 2, 3] as const).map((level) => ({
		standardDeviations: level,
		confidence: level === 1 ? '68 %' : level === 2 ? '95 %' : '99,7 %',
		lowerHours: clampLower
			? Math.max(0, expectedHours - level * deviation)
			: expectedHours - level * deviation,
		upperHours: expectedHours + level * deviation,
	}));
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

/**
 * Computes a project estimate from independent subtasks.
 * Expected durations are summed, while variances are summed before taking
 * the square root. Adding standard deviations directly would overstate risk.
 */
export function calculateTaskPert(tasks: TaskEstimate[], hoursPerDay: number): TaskPertResult {
	const taskResults = tasks.map((task) => {
		const variance = pertVariance(task.o, task.p);
		return {
			...task,
			expectedHours: pertFormula(task.o, task.m, task.p),
			variance,
			standardDeviation: Math.sqrt(variance),
		};
	});
	const expectedHours = taskResults.reduce((sum, task) => sum + task.expectedHours, 0);
	const variance = taskResults.reduce((sum, task) => sum + task.variance, 0);
	const standardDeviation = Math.sqrt(variance);

	return {
		tasks: taskResults,
		totalO: tasks.reduce((sum, task) => sum + task.o, 0),
		totalM: tasks.reduce((sum, task) => sum + task.m, 0),
		totalP: tasks.reduce((sum, task) => sum + task.p, 0),
		expectedHours,
		variance,
		standardDeviation,
		hoursPerDay,
		workdays: expectedHours / hoursPerDay,
		confidenceIntervals: confidenceIntervals(expectedHours, standardDeviation),
	};
}

/**
 * Each user estimates the same scope with their own task breakdown.
 * Total variance = mean within-user variance + variance of user totals.
 * This models uncertainty in the project, not the standard error of a mean:
 * adding users must not make shared project uncertainty vanish.
 */
export function calculateGroupTaskPert(
	groups: TaskGroupEstimate[],
	hoursPerDay: number,
): GroupTaskPertResult {
	const totals = groups.map((group) => ({
		name: group.name,
		...calculateTaskPert(group.tasks, hoursPerDay),
	}));
	const expectedHours = average(totals.map((total) => total.expectedHours));
	const withinVariance = average(totals.map((total) => total.variance));
	const betweenVariance = average(totals.map((total) => (total.expectedHours - expectedHours) ** 2));
	const variance = withinVariance + betweenVariance;
	const deviation = Math.sqrt(variance);
	const relativeDisagreement = expectedHours > 0 ? Math.sqrt(betweenVariance) / expectedHours : 0;

	return {
		groups: totals.map((total) => ({
			...total,
			deviationHours: total.expectedHours - expectedHours,
		})),
		averageO: average(totals.map((total) => total.totalO)),
		averageM: average(totals.map((total) => total.totalM)),
		averageP: average(totals.map((total) => total.totalP)),
		expectedHours,
		withinVariance,
		betweenVariance,
		variance,
		standardDeviation: deviation,
		relativeDisagreement,
		teamDisagreement: relativeDisagreement > TEAM_DISAGREEMENT_THRESHOLD,
		highUncertainty: expectedHours > 0 && deviation / expectedHours > HIGH_UNCERTAINTY_THRESHOLD,
		hoursPerDay,
		workdays: expectedHours / hoursPerDay,
		confidenceIntervals: confidenceIntervals(expectedHours, deviation, true),
	};
}
