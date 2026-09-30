import type { VarianceShare } from '../../../lib/pert/types';
import { el } from './dom';

/** Fills the "Var sitter osäkerheten?" list. The largest share is highlighted. */
export function renderVarianceShares(list: HTMLElement, shares: VarianceShare[]): void {
	const largest = shares.length > 0 ? shares[0].share : 0;
	list.replaceChildren(...shares.map((item, index) => {
		const scaled = largest > 0 ? (item.share / largest) * 100 : 0;
		const fill = el('div', { class: 'pert-share-item__fill' });
		fill.style.width = `${scaled.toFixed(1)}%`;
		return el('li', { class: 'pert-share-item', attrs: { 'data-top': String(index === 0 && largest > 0) } }, [
			el('div', { class: 'pert-share-item__row' }, [
				el('span', { class: 'pert-share-item__title', text: item.title || 'Namnlös deluppgift' }),
				el('span', { class: 'pert-num', text: `${Math.round(item.share * 100)} %` }),
			]),
			el('div', { class: 'pert-share-item__bar' }, [fill]),
		]);
	}));
}
