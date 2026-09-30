import { MAX_TEXT_LENGTH } from '../../../lib/pert/types';
import type { RowEvaluation } from '../../../lib/pert/types';
import { formatSwedishNumber } from '../../../lib/pert/format';
import { CLOSE_ICON_PATH, el, icon, query } from './dom';

export interface EstimateRow {
	name: string;
	o: string;
	m: string;
	p: string;
}

export interface TableConfig {
	root: HTMLElement;
	/** Fallback label for a row without a name, e.g. "deluppgift 3". */
	rowLabel: (index: number) => string;
	namePlaceholder: (index: number) => string;
	nameLabel: (index: number) => string;
	onChange: () => void;
	minRows?: number;
	maxRows?: number;
}

export interface TableFooter {
	label?: string;
	o: string;
	m: string;
	p: string;
	e: string;
}

export interface EstimateTable {
	getRows: () => EstimateRow[];
	setRows: (rows: EstimateRow[]) => void;
	addRow: (row?: Partial<EstimateRow>, focus?: boolean) => void;
	paint: (evaluations: RowEvaluation[], options?: { outlierRows?: Set<number> }) => void;
	setFooter: (footer: TableFooter) => void;
	setAddDisabled: (disabled: boolean) => void;
}

interface RowRefs {
	element: HTMLElement;
	name: HTMLInputElement;
	o: HTMLInputElement;
	m: HTMLInputElement;
	p: HTMLInputElement;
	expected: HTMLElement;
	message: HTMLElement;
	remove: HTMLButtonElement;
}

let nextRowId = 0;

const NUMBER_FIELDS = [
	{ key: 'o', label: 'Optimistisk' },
	{ key: 'm', label: 'Mest trolig' },
	{ key: 'p', label: 'Pessimistisk' },
] as const;

export function createEstimateTable(config: TableConfig): EstimateTable {
	const rowsElement = query<HTMLElement>(config.root, '[data-rows]');
	const addButton = query<HTMLButtonElement>(config.root, '[data-add]');
	const minRows = config.minRows ?? 1;
	const rows: RowRefs[] = [];

	function rowName(index: number): string {
		return rows[index].name.value.trim() || config.rowLabel(index + 1);
	}

	function refreshLabels(): void {
		rows.forEach((row, index) => {
			row.name.placeholder = config.namePlaceholder(index + 1);
			row.name.setAttribute('aria-label', config.nameLabel(index + 1));
			for (const field of NUMBER_FIELDS) {
				row[field.key].setAttribute('aria-label', `${field.label}, ${rowName(index)}`);
			}
			row.remove.setAttribute('aria-label', `Ta bort ${rowName(index)}`);
			row.remove.hidden = rows.length <= minRows;
		});
	}

	function removeRow(row: RowRefs): void {
		const index = rows.indexOf(row);
		if (index < 0 || rows.length <= minRows) return;
		rows.splice(index, 1);
		row.element.remove();
		refreshLabels();
		const next = rows[Math.min(index, rows.length - 1)];
		(next ? next.name : addButton).focus();
		config.onChange();
	}

	function createRow(values: Partial<EstimateRow>): RowRefs {
		const id = `pert-row-${(nextRowId += 1)}`;
		const name = el('input', {
			class: 'pert-cell pert-cell--name',
			attrs: { type: 'text', maxlength: String(MAX_TEXT_LENGTH), autocomplete: 'off' },
		});
		name.value = values.name ?? '';

		const numberInputs = NUMBER_FIELDS.map((field) => {
			const input = el('input', {
				class: 'pert-cell',
				attrs: { type: 'text', inputmode: 'decimal', autocomplete: 'off', maxlength: '20', placeholder: '0' },
			});
			input.value = values[field.key] ?? '';
			return input;
		});
		const [o, m, p] = numberInputs;

		const expected = el('span', { class: 'pert-row__e pert-num', text: '–', attrs: { 'data-state': 'empty' } });
		const message = el('span', { class: 'pert-visually-hidden', attrs: { id: `${id}-message` } });
		const remove = el('button', { class: 'pert-row__remove', attrs: { type: 'button' } }, [icon(CLOSE_ICON_PATH)]);
		const element = el('div', { class: 'pert-row', attrs: { role: 'listitem' } }, [
			name, o, m, p, expected, remove, message,
		]);

		const row: RowRefs = { element, name, o, m, p, expected, message, remove };
		for (const input of [name, o, m, p]) input.addEventListener('input', config.onChange);
		name.addEventListener('input', refreshLabels);
		remove.addEventListener('click', () => removeRow(row));
		return row;
	}

	function addRow(values: Partial<EstimateRow> = {}, focus = false): void {
		if (config.maxRows !== undefined && rows.length >= config.maxRows) return;
		const row = createRow(values);
		rows.push(row);
		rowsElement.append(row.element);
		refreshLabels();
		if (focus) row.name.focus();
	}

	addButton.addEventListener('click', () => {
		addRow({}, true);
		config.onChange();
	});

	return {
		getRows: () => rows.map((row) => ({
			name: row.name.value,
			o: row.o.value,
			m: row.m.value,
			p: row.p.value,
		})),

		setRows(values: EstimateRow[]): void {
			for (const row of rows) row.element.remove();
			rows.length = 0;
			for (const value of values) addRow(value);
			refreshLabels();
		},

		addRow,

		paint(evaluations: RowEvaluation[], options = {}): void {
			rows.forEach((row, index) => {
				const evaluation = evaluations[index];
				if (!evaluation) return;
				row.expected.dataset.state = evaluation.state;
				const problem = evaluation.state === 'invalid' || evaluation.state === 'order';
				row.expected.textContent = evaluation.state === 'ok' && evaluation.expectedHours !== null
					? formatSwedishNumber(evaluation.expectedHours, 1)
					: problem ? 'Kolla' : '–';

				const invalidFields = new Set(evaluation.errors.map((error) => error.field));
				if (evaluation.state === 'order') invalidFields.add('m');
				for (const field of NUMBER_FIELDS) {
					const input = row[field.key];
					const flagged = invalidFields.has(field.key);
					if (flagged) input.setAttribute('aria-invalid', 'true');
					else input.removeAttribute('aria-invalid');
					if (problem && flagged) input.setAttribute('aria-describedby', row.message.id);
					else input.removeAttribute('aria-describedby');
					input.classList.toggle('pert-cell--outlier', field.key === 'm' && !problem && !!options.outlierRows?.has(index));
				}

				const text = evaluation.errors[0]?.message ?? '';
				row.message.textContent = problem ? text : '';
				if (problem) row.expected.setAttribute('title', text);
				else row.expected.removeAttribute('title');
			});
		},

		setFooter(footer: TableFooter): void {
			const set = (selector: string, text: string): void => {
				query<HTMLElement>(config.root, selector).textContent = text;
			};
			if (footer.label !== undefined) set('[data-foot-label]', footer.label);
			set('[data-foot-o]', footer.o);
			set('[data-foot-m]', footer.m);
			set('[data-foot-p]', footer.p);
			set('[data-foot-e]', footer.e);
		},

		setAddDisabled(disabled: boolean): void {
			addButton.disabled = disabled;
		},
	};
}
