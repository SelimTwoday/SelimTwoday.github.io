import { formatSwedishNumber } from '../../../lib/pert/format';
import { varianceShares, withMeeting } from '../../../lib/pert/calculate';
import { buildTaskPertQueryString } from '../../../lib/pert/url';
import { evaluateRow, previewTaskPert, validateTaskPertForm } from '../../../lib/pert/validate';
import { MAX_TASKS_PER_GROUP } from '../../../lib/pert/types';
import type { TaskRowInput } from '../../../lib/pert/types';
import { pluralize, query, setText } from '../ui/dom';
import { createEstimateTable } from '../ui/estimate-table';
import { createMeetingControl, type MeetingState } from '../ui/meeting';
import { showRowProblems } from '../ui/messages';
import { createResultBand } from '../ui/result-band';
import { paintHead } from '../ui/result-head';
import { bindShare } from '../ui/share';
import { renderVarianceShares } from '../ui/variance-list';
import type { ModeController, PertContext } from './context';

const EMPTY_ROWS = 3;

export interface TasksInitial {
	tasks: TaskRowInput[];
	meeting: MeetingState;
}

export function createTasksMode(root: HTMLElement, ctx: PertContext, initial: TasksInitial): ModeController {
	const panel = query<HTMLElement>(root, '[data-panel]');
	const shares = query<HTMLElement>(root, '[data-shares]');
	const count = query<HTMLElement>(root, '[data-count]');
	const rowError = query<HTMLElement>(root, '[data-row-error]');
	const band = createResultBand(query<HTMLElement>(root, '[data-band]'));
	const meeting = createMeetingControl(root, () => ctx.changed());
	meeting.set(initial.meeting);
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
		initial.tasks.length > 0
			? initial.tasks.map((task) => ({ name: task.title, o: task.o, m: task.m, p: task.p }))
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
		const rawPreview = previewTaskPert(inputs, hoursPerDay);
		const complete = rawPreview.complete && meeting.isValid();
		const preview = { ...rawPreview, complete };
		const validation = validateTaskPertForm(inputs, hoursPerDay);
		const meetingInput = meeting.parsed();
		lastQuery = validation.valid && meeting.isValid()
			? buildTaskPertQueryString(
				validation.tasks,
				validation.result.hoursPerDay,
				meetingInput ? { hoursPerPerson: meetingInput.hoursPerPerson, people: meetingInput.people ?? undefined } : undefined,
			)
			: null;
		share.setEnabled(complete);
		share.clearStatus();

		const result = preview.result;
		const meetingTotal = meetingInput ? meetingInput.hoursPerPerson * (meetingInput.people ?? 0) : 0;
		const adjusted = result
			? withMeeting(result.expectedHours, result.standardDeviation, meetingTotal, result.hoursPerDay)
			: null;
		const shown = paintHead(
			root,
			preview,
			result && adjusted && {
				headline: adjusted.finalHours,
				days: adjusted.workdays,
				standardDeviation: result.standardDeviation,
			},
		);
		if (!result || !adjusted || !shown) {
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

		meeting.paint({ work: result.expectedHours, meeting: meetingTotal, people: meetingInput?.people ?? 0 });
		band.update({
			mean: adjusted.finalHours,
			standardDeviation: result.standardDeviation,
			intervals: adjusted.confidenceIntervals,
		});
		setText(root, 'avgO', format(result.totalO));
		setText(root, 'avgM', format(result.totalM));
		setText(root, 'avgP', format(result.totalP));
		renderVarianceShares(shares, varianceShares(result));
		setText(
			root,
			'formula',
			`σ = √Σ((P − O) / 6)² = ${formatSwedishNumber(result.standardDeviation, 2)} h`,
		);
		ctx.setSummary(`${format(adjusted.finalHours)} h ± ${formatSwedishNumber(result.standardDeviation, 1)}`);
	}

	return {
		token: 'tasks',
		activate: render,
		render,
		queryString: () => lastQuery,
	};
}
