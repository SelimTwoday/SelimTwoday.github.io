import { formatSwedishNumber } from '../../../lib/pert/format';
import type { ConfidenceInterval } from '../../../lib/pert/types';
import { el } from './dom';

export interface BandInput {
	mean: number;
	standardDeviation: number;
	intervals: ConfidenceInterval[];
}

export interface ResultBand {
	update: (input: BandInput) => void;
}

/** Visible span of the band: 3.5 standard deviations either side, at least 5 % of the mean (min 1 h) when σ is 0. */
export function bandScale(mean: number, standardDeviation: number): { lo: number; hi: number } {
	const span = standardDeviation > 0 ? standardDeviation : Math.max(mean * 0.05, 1);
	return { lo: Math.max(0, mean - 3.5 * span), hi: mean + 3.5 * span };
}

const LEVELS = [3, 2, 1] as const;

/** Builds the confidence band, its axis and the three interval rows inside root. */
export function createResultBand(root: HTMLElement): ResultBand {
	const fills = new Map<number, HTMLElement>();
	const track = el('div', { class: 'pert-band__track', attrs: { 'aria-hidden': 'true' } });
	for (const level of LEVELS) {
		const fill = el('div', { class: 'pert-band__fill', attrs: { 'data-level': String(level) } });
		fills.set(level, fill);
		track.append(fill);
	}
	const marker = el('div', { class: 'pert-band__marker' });
	track.append(marker);

	const axisLo = el('span');
	const axisHi = el('span');
	const axis = el('div', { class: 'pert-band__axis pert-num', attrs: { 'aria-hidden': 'true' } }, [axisLo, axisHi]);

	const ranges = new Map<number, HTMLElement>();
	const labels = new Map<number, HTMLElement>();
	const list = el('ul', { class: 'pert-band__list' });
	for (const level of [1, 2, 3] as const) {
		const label = el('span');
		const range = el('span', { class: 'pert-num' });
		ranges.set(level, range);
		labels.set(level, label);
		list.append(el('li', { class: 'pert-band__item' }, [
			el('span', { class: 'pert-swatch', attrs: { 'data-level': String(level) } }),
			label,
			range,
		]));
	}

	root.classList.add('pert-band');
	root.replaceChildren(track, axis, list);

	return {
		update({ mean, standardDeviation, intervals }: BandInput): void {
			const { lo, hi } = bandScale(mean, standardDeviation);
			const percent = (value: number): number => ((value - lo) / (hi - lo)) * 100;

			for (const interval of intervals) {
				const level = interval.standardDeviations;
				const left = percent(Math.max(0, interval.lowerHours));
				const width = Math.max(percent(interval.upperHours) - left, 0.4);
				const fill = fills.get(level);
				if (fill) {
					fill.style.left = `${left.toFixed(2)}%`;
					fill.style.width = `${width.toFixed(2)}%`;
				}
				labels.get(level)!.textContent = interval.confidence;
				ranges.get(level)!.textContent =
					`${formatSwedishNumber(Math.max(0, interval.lowerHours), 1)}–${formatSwedishNumber(interval.upperHours, 1)} h`;
			}

			marker.style.left = `${percent(mean).toFixed(2)}%`;
			axisLo.textContent = `${formatSwedishNumber(lo, 0)} h`;
			axisHi.textContent = `${formatSwedishNumber(hi, 0)} h`;
		},
	};
}
