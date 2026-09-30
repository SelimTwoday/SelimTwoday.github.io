import { formatSwedishNumber } from '../../../lib/pert/format';
import type { Preview } from '../../../lib/pert/types';
import { query, setText } from './dom';

export interface HeadValues {
	headline: number;
	days: number;
	/** ± σ, shown in PERT Pro and Enterprise. */
	standardDeviation?: number;
	/** "sannolikt" range, shown in Gruppestimat. */
	likely?: { lo: number; hi: number };
}

/** Text for the preliminary label, or null when the form is complete. */
export function preliminaryLabel(preview: Preview<unknown>): string | null {
	if (preview.complete) return null;
	if (preview.excludedRows === 0) return 'Preliminärt';
	const rows = preview.excludedRows === 1 ? '1 rad räknas inte' : `${preview.excludedRows} rader räknas inte`;
	return `Preliminärt · ${rows}`;
}

/**
 * Paints the shared top of a result panel and toggles between the result body
 * and the empty state. Returns true when there is a result to show.
 */
export function paintHead(root: HTMLElement, preview: Preview<unknown>, values: HeadValues | null): boolean {
	const body = query<HTMLElement>(root, '[data-result-body]');
	const empty = query<HTMLElement>(root, '[data-empty]');
	const prelim = query<HTMLElement>(root, '[data-out="prelim"]');

	if (!values) {
		setText(root, 'headline', '–');
		setText(root, 'days', '–');
		const sd = root.querySelector<HTMLElement>('[data-out="sd"]');
		if (sd) sd.textContent = '–';
		const likely = root.querySelector<HTMLElement>('[data-out="likely"]');
		if (likely) likely.textContent = '–';
		body.hidden = true;
		empty.hidden = false;
		prelim.hidden = true;
		return false;
	}

	setText(root, 'headline', formatSwedishNumber(values.headline, 1));
	setText(root, 'days', formatSwedishNumber(values.days, 1));
	const sd = root.querySelector<HTMLElement>('[data-out="sd"]');
	if (sd && values.standardDeviation !== undefined) sd.textContent = formatSwedishNumber(values.standardDeviation, 2);
	const likely = root.querySelector<HTMLElement>('[data-out="likely"]');
	if (likely && values.likely) {
		likely.textContent = `${formatSwedishNumber(values.likely.lo, 1)}–${formatSwedishNumber(values.likely.hi, 1)}`;
	}

	body.hidden = false;
	empty.hidden = true;
	const label = preliminaryLabel(preview);
	prelim.hidden = label === null;
	prelim.textContent = label ?? '';
	return true;
}
