import { formatSwedishNumber, parseSwedishNumber } from '../../../lib/pert/format';
import { confidenceIntervals } from '../../../lib/pert/calculate';
import { buildPertQueryString } from '../../../lib/pert/url';
import { evaluateRow, previewParticipantPert, validatePertForm } from '../../../lib/pert/validate';
import { MAX_PARTICIPANTS } from '../../../lib/pert/types';
import type { ParticipantRowInput } from '../../../lib/pert/types';
import { el, pluralize, query, queryAll, setText } from '../ui/dom';
import { createEstimateTable, type EstimateRow } from '../ui/estimate-table';
import { createMeetingControl } from '../ui/meeting';
import { showRowProblems } from '../ui/messages';
import { createResultBand } from '../ui/result-band';
import { paintHead } from '../ui/result-head';
import { bindShare } from '../ui/share';
import type { ModeController, PertContext } from './context';

const EMPTY_ROWS = 2;

export interface GroupInitial {
	rows: (ParticipantRowInput & { name: string })[];
	meeting: string;
}

export function createGroupMode(root: HTMLElement, ctx: PertContext, initial: GroupInitial): ModeController {
	const panel = query<HTMLElement>(root, '[data-panel]');
	const count = query<HTMLElement>(root, '[data-count]');
	const rowError = query<HTMLElement>(root, '[data-row-error]');
	const disagree = query<HTMLElement>(root, '[data-disagree]');
	const disagreeText = query<HTMLElement>(root, '[data-disagree-text]');
	const uncertainty = query<HTMLElement>(root, '[data-out="uncertainty"]');
	const exportList = query<HTMLElement>(root, '[data-export-list]');
	const checks = queryAll<HTMLButtonElement>(root, '[data-check]');
	const checklistCount = query<HTMLElement>(root, '[data-checklist-count]');
	let lastQuery: string | null = null;

	const table = createEstimateTable({
		root: query<HTMLElement>(root, '[data-table]'),
		rowLabel: (index) => `deltagare ${index}`,
		namePlaceholder: (index) => `Deltagare ${index}`,
		nameLabel: (index) => `Namn, deltagare ${index}`,
		onChange: () => ctx.changed(),
		maxRows: MAX_PARTICIPANTS,
	});
	const blankRow = (): EstimateRow => ({ name: '', o: '', m: '', p: '' });
	table.setRows(
		initial.rows.length > 0
			? initial.rows.map((row) => ({ name: row.name, o: row.o, m: row.m, p: row.p }))
			: Array.from({ length: EMPTY_ROWS }, blankRow),
	);

	const meeting = createMeetingControl(root, () => ctx.changed());
	meeting.set({ hours: initial.meeting });
	const band = createResultBand(query<HTMLElement>(root, '[data-band]'));

	const share = bindShare(
		query<HTMLElement>(root, '[data-share]'),
		panel,
		() => (lastQuery ? `${ctx.baseUrl()}?${lastQuery}` : null),
	);

	for (const check of checks) {
		check.addEventListener('click', () => {
			check.setAttribute('aria-pressed', String(check.getAttribute('aria-pressed') !== 'true'));
			const pressed = checks.filter((item) => item.getAttribute('aria-pressed') === 'true').length;
			checklistCount.textContent = `${pressed} av ${checks.length}`;
		});
	}

	function render(): void {
		const rows = table.getRows();
		const inputs = rows.map((row) => ({ o: row.o, m: row.m, p: row.p, name: row.name }));
		const evaluations = rows.map(evaluateRow);
		showRowProblems(rowError, evaluations);
		count.textContent = pluralize(rows.length, 'person', 'personer');

		const settingsInput = { meetingHoursPerPerson: meeting.hoursText(), hoursPerDay: ctx.getHoursPerDay() };
		const preview = previewParticipantPert(inputs, settingsInput);
		const validation = validatePertForm(inputs, settingsInput);
		lastQuery = validation.valid
			? buildPertQueryString(
				validation.participants.map((participant, index) => ({ ...participant, name: inputs[index].name })),
				validation.settings,
			)
			: null;
		share.setEnabled(preview.complete);
		share.setNoticeVisible(inputs.some((row) => row.name.trim() !== ''));
		share.clearStatus();

		const result = preview.result;

		// Lowest and highest "most likely" values are marked when the group disagrees.
		const usableM = evaluations
			.map((evaluation, index) => (evaluation.state === 'ok' ? { index, m: parseSwedishNumber(rows[index].m) as number } : null))
			.filter((item): item is { index: number; m: number } => item !== null);
		const mMin = usableM.length > 0 ? Math.min(...usableM.map((item) => item.m)) : 0;
		const mMax = usableM.length > 0 ? Math.max(...usableM.map((item) => item.m)) : 0;
		const outliers = new Set<number>();
		if (result?.teamDisagreement) {
			for (const item of usableM) if (item.m === mMin || item.m === mMax) outliers.add(item.index);
		}
		table.paint(evaluations, { outlierRows: outliers });

		disagree.hidden = !result?.teamDisagreement;
		disagreeText.textContent = result?.teamDisagreement
			? `Ni är oense om mest trolig tid (${formatSwedishNumber(mMin, 1)} till ${formatSwedishNumber(mMax, 1)} h). Prata igenom antagandena innan ni låser estimatet.`
			: '';

		const shown = paintHead(
			root,
			preview,
			result && {
				headline: result.finalHours,
				days: result.workdays,
				standardDeviation: result.pertStdDev,
			},
		);
		if (!result || !shown) {
			table.setFooter({ label: 'Medel', o: '–', m: '–', p: '–', e: '–' });
			exportList.replaceChildren();
			ctx.setSummary(null);
			return;
		}

		const format = (value: number): string => formatSwedishNumber(value, 1);
		table.setFooter({
			label: 'Medel',
			o: format(result.averageO),
			m: format(result.averageM),
			p: format(result.averageP),
			e: format(result.pertHours),
		});

		meeting.paint({ work: result.pertHours, meeting: result.meetingTotalHours, people: result.peopleCount });
		band.update({
			mean: result.finalHours,
			standardDeviation: result.pertStdDev,
			intervals: confidenceIntervals(result.finalHours, result.pertStdDev, true),
		});
		setText(root, 'avgO', format(result.averageO));
		setText(root, 'avgM', format(result.averageM));
		setText(root, 'avgP', format(result.averageP));
		setText(
			root,
			'formula',
			`(${format(result.averageO)} + 4 × ${format(result.averageM)} + ${format(result.averageP)}) / 6 = ${format(result.pertHours)}`,
		);
		uncertainty.hidden = !result.highUncertainty;

		const named = evaluations.flatMap((evaluation, index) => {
			if (evaluation.state !== 'ok' || evaluation.expectedHours === null) return [];
			return [el('div', { class: 'pert-export-row' }, [
				el('span', { text: rows[index].name.trim() || `Deltagare ${index + 1}` }),
				el('span', { class: 'pert-num', text: `${format(evaluation.expectedHours)} h` }),
			])];
		});
		exportList.replaceChildren(...(rows.some((row) => row.name.trim()) ? named : []));

		ctx.setSummary(`${format(result.finalHours)} h ± ${formatSwedishNumber(result.pertStdDev, 1)}`);
	}

	return {
		token: 'group',
		activate: render,
		render,
		queryString: () => lastQuery,
	};
}
