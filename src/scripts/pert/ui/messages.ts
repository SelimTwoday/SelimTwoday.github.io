import type { RowEvaluation } from '../../../lib/pert/types';

/** One sentence describing what is wrong in the rows, or null when nothing is. */
export function rowProblemMessage(evaluations: RowEvaluation[]): string | null {
	const order = evaluations.some((evaluation) => evaluation.state === 'order');
	const invalid = evaluations.some((evaluation) => evaluation.state === 'invalid');
	const parts: string[] = [];
	if (invalid) parts.push('Någon rad innehåller ett ogiltigt tal. Ange t.ex. 8,5.');
	if (order) parts.push('Någon rad har värden i fel ordning. Optimistisk ≤ mest trolig ≤ pessimistisk.');
	return parts.length > 0 ? parts.join(' ') : null;
}

export function showRowProblems(element: HTMLElement, evaluations: RowEvaluation[]): void {
	const message = rowProblemMessage(evaluations);
	element.hidden = message === null;
	element.textContent = message ?? '';
}
