import { formatSwedishNumber } from '../../../lib/pert/format';
import type { Preview } from '../../../lib/pert/types';
import { query, setText } from './dom';

export interface HeadValues {
	headline: number;
	days: number;
	standardDeviation: number;
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
		setText(root, 'sd', '–');
		body.hidden = true;
		empty.hidden = false;
		prelim.hidden = true;
		return false;
	}

	setText(root, 'headline', formatSwedishNumber(values.headline, 1));
	setText(root, 'days', formatSwedishNumber(values.days, 1));
	setText(root, 'sd', formatSwedishNumber(values.standardDeviation, 2));
	body.hidden = false;
	empty.hidden = true;
	const label = preliminaryLabel(preview);
	prelim.hidden = label === null;
	prelim.textContent = label ?? '';
	return true;
}
