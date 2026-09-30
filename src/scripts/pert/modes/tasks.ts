import { formatSwedishNumber } from '../../../lib/pert/format';
import { varianceShares } from '../../../lib/pert/calculate';
import { buildTaskPertQueryString } from '../../../lib/pert/url';
import { evaluateRow, previewTaskPert, validateTaskPertForm } from '../../../lib/pert/validate';
import { MAX_TASKS_PER_GROUP } from '../../../lib/pert/types';
import type { TaskRowInput } from '../../../lib/pert/types';
import { el, pluralize, query, setText } from '../ui/dom';
import { createEstimateTable } from '../ui/estimate-table';
import { showRowProblems } from '../ui/messages';
import { createResultBand } from '../ui/result-band';
import { paintHead } from '../ui/result-head';
import { bindShare } from '../ui/share';
import type { ModeController, PertContext } from './context';

const EMPTY_ROWS = 3;

export function createTasksMode(root: HTMLElement, ctx: PertContext, initial: TaskRowInput[]): ModeController {
	const panel = query<HTMLElement>(root, '[data-panel]');
	const shares = query<HTMLElement>(root, '[data-shares]');
	const count = query<HTMLElement>(root, '[data-count]');
	const rowError = query<HTMLElement>(root, '[data-row-error]');
	const band = createResultBand(query<HTMLElement>(root, '[data-band]'));
	let lastQuery: string | null = null;

	const table = createEstimateTable({
		root: query<HTMLElement>(root, '[data-table]'),
		rowLabel: (index) => `deluppgift ${index}`,
		namePlaceholder: () => 'Namnge deluppgift',
		nameLabel: (index) => `Deluppgift ${index}`,
		onChange: () => ctx.changed(),
		maxRows: MAX_TASKS_PER_GROUP,
	});
	table.setRows(
		initial.length > 0
			? initial.map((task) => ({ name: task.title, o: task.o, m: task.m, p: task.p }))
			: Array.from({ length: EMPTY_ROWS }, () => ({ name: '', o: '', m: '', p: '' })),
	);

	const share = bindShare(
		query<HTMLElement>(root, '[data-share]'),
		panel,
		() => (lastQuery ? `${ctx.baseUrl()}?${lastQuery}` : null),
	);

	function render(): void {
		const rows = table.getRows();
		const inputs: TaskRowInput[] = rows.map((row) => ({ title: row.name, o: row.o, m: row.m, p: row.p }));
		const evaluations = rows.map(evaluateRow);
		table.paint(evaluations);
		showRowProblems(rowError, evaluations);
		count.textContent = pluralize(rows.length, 'uppgift', 'uppgifter');

		const hoursPerDay = ctx.getHoursPerDay();
		const preview = previewTaskPert(inputs, hoursPerDay);
		const validation = validateTaskPertForm(inputs, hoursPerDay);
		lastQuery = validation.valid ? buildTaskPertQueryString(validation.tasks, validation.result.hoursPerDay) : null;
		share.setEnabled(preview.complete);
		share.clearStatus();

		const result = preview.result;
		const shown = paintHead(
			root,
			preview,
			result && {
				headline: result.expectedHours,
				days: result.workdays,
				standardDeviation: result.standardDeviation,
			},
		);
		if (!result || !shown) {
			table.setFooter({ label: 'Summa', o: '–', m: '–', p: '–', e: '–' });
			ctx.setSummary(null);
			return;
		}

		const format = (value: number): string => formatSwedishNumber(value, 1);
		table.setFooter({
			label: `Summa · ${pluralize(result.tasks.length, 'deluppgift', 'deluppgifter')} · σ ${formatSwedishNumber(result.standardDeviation, 1)} h`,
			o: format(result.totalO),
			m: format(result.totalM),
			p: format(result.totalP),
			e: format(result.expectedHours),
		});

		band.update({
			mean: result.expectedHours,
			standardDeviation: result.standardDeviation,
			intervals: result.confidenceIntervals,
		});

		const ranked = varianceShares(result);
		const largest = ranked.length > 0 ? ranked[0].share : 0;
		shares.replaceChildren(...ranked.map((item, index) => {
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

		setText(
			root,
			'formula',
			`σ = √Σ((P − O) / 6)² = ${formatSwedishNumber(result.standardDeviation, 2)} h`,
		);
		ctx.setSummary(`${format(result.expectedHours)} h ± ${formatSwedishNumber(result.standardDeviation, 1)}`);
	}

	return {
		token: 'tasks',
		activate: render,
		render,
		queryString: () => lastQuery,
	};
}
