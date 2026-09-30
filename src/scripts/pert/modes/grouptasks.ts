import { formatSwedishNumber } from '../../../lib/pert/format';
import { findScopeGaps } from '../../../lib/pert/scope';
import { MAX_GROUPS, MAX_TASKS_PER_GROUP, MAX_TEXT_LENGTH } from '../../../lib/pert/types';
import type { TaskGroupInput, TaskRowInput } from '../../../lib/pert/types';
import { buildGroupTaskPertQueryString, parseTaskLinkImport } from '../../../lib/pert/url';
import {
	evaluateRow,
	previewGroupPert,
	previewTaskPert,
	validateGroupTaskPertForm,
} from '../../../lib/pert/validate';
import { alertIcon, el, pluralize, query, setText } from '../ui/dom';
import { createEstimateTable, type EstimateRow } from '../ui/estimate-table';
import { showRowProblems } from '../ui/messages';
import { createResultBand } from '../ui/result-band';
import { paintHead } from '../ui/result-head';
import { bindShare } from '../ui/share';
import type { ModeController, PertContext } from './context';

const EMPTY_ROWS = 3;
const MAX_LISTED_TITLES = 3;

interface Person {
	id: number;
	name: string;
	/** True while the name is the automatic "Person N" and untouched. */
	generatedName: boolean;
	tasks: EstimateRow[];
}

interface ImportSnapshot {
	importedIds: number[];
	/** The untouched starter card that the import replaced, if any. */
	replaced: Person | null;
	previousHoursPerDay: string;
	previousActiveId: number;
}

interface PersonChip {
	button: HTMLButtonElement;
	name: HTMLElement;
	total: HTMLElement;
}

export function createGroupTasksMode(
	root: HTMLElement,
	ctx: PertContext,
	initial: TaskGroupInput[],
	gag: { show: () => void },
): ModeController {
	const panel = query<HTMLElement>(root, '[data-panel]');
	const chipsElement = query<HTMLElement>(root, '[data-chips]');
	const addPersonButton = query<HTMLButtonElement>(root, '[data-add-person]');
	const removePersonButton = query<HTMLButtonElement>(root, '[data-remove-person]');
	const personName = query<HTMLInputElement>(root, '[data-person-name]');
	const rowError = query<HTMLElement>(root, '[data-row-error]');
	const gapsElement = query<HTMLElement>(root, '[data-gaps]');
	const importToggle = query<HTMLButtonElement>(root, '[data-import-toggle]');
	const importPanel = query<HTMLElement>(root, '[data-import-panel]');
	const importUrl = query<HTMLInputElement>(root, '[data-import-url]');
	const importError = query<HTMLElement>(root, '[data-import-error]');
	const importStatus = query<HTMLElement>(root, '[data-import-status]');
	const importText = query<HTMLElement>(root, '[data-import-text]');
	const dots = query<HTMLElement>(root, '[data-dots]');
	const dotsMean = query<HTMLElement>(root, '[data-dots-mean]');
	const personList = query<HTMLElement>(root, '[data-person-list]');
	const disagreementFlag = query<HTMLElement>(root, '[data-out="disagreement"]');
	const uncertaintyFlag = query<HTMLElement>(root, '[data-out="uncertainty"]');
	const band = createResultBand(query<HTMLElement>(root, '[data-band]'));

	const chips = new Map<number, PersonChip>();
	let nextId = 1;
	let lastQuery: string | null = null;
	let lastImport: ImportSnapshot | null = null;

	const blankRow = (): EstimateRow => ({ name: '', o: '', m: '', p: '' });
	const newPerson = (name: string, tasks: EstimateRow[], generatedName: boolean): Person => ({
		id: nextId++,
		name,
		generatedName,
		tasks,
	});
	const defaultPerson = (): Person => newPerson('Person 1', Array.from({ length: EMPTY_ROWS }, blankRow), true);

	let people: Person[] = initial.length > 0
		? initial.map((group) => newPerson(
			group.name,
			group.tasks.length > 0
				? group.tasks.map((task) => ({ name: task.title, o: task.o, m: task.m, p: task.p }))
				: [blankRow()],
			false,
		))
		: [defaultPerson()];
	let activeId = people[0].id;

	const table = createEstimateTable({
		root: query<HTMLElement>(root, '[data-table]'),
		rowLabel: (index) => `deluppgift ${index}`,
		namePlaceholder: () => 'Namnge deluppgift',
		nameLabel: (index) => `Deluppgift ${index}`,
		onChange: () => ctx.changed(),
		maxRows: MAX_TASKS_PER_GROUP,
	});

	const share = bindShare(
		query<HTMLElement>(root, '[data-share]'),
		panel,
		() => (lastQuery ? `${ctx.baseUrl()}?${lastQuery}` : null),
	);

	const activePerson = (): Person => people.find((person) => person.id === activeId) ?? people[0];
	const displayName = (person: Person): string => person.name.trim() || 'Namnlös';
	const toRows = (tasks: EstimateRow[]): TaskRowInput[] => tasks.map((task) => ({ title: task.name, o: task.o, m: task.m, p: task.p }));
	const toGroup = (person: Person): TaskGroupInput => ({ name: person.name, tasks: toRows(person.tasks) });

	function isPristine(person: Person): boolean {
		return person.generatedName && person.tasks.every((task) => !task.name.trim() && !task.o.trim() && !task.m.trim() && !task.p.trim());
	}

	/** Copies what is typed in the table back into the active person. */
	function saveActive(): void {
		activePerson().tasks = table.getRows();
	}

	function showPerson(): void {
		const person = activePerson();
		table.setRows(person.tasks);
		personName.value = person.name;
	}

	function select(id: number): void {
		saveActive();
		activeId = id;
		showPerson();
		ctx.changed();
	}

	function nextGeneratedName(): string {
		return `Person ${people.length + 1}`;
	}

	function addPerson(): void {
		if (people.length >= MAX_GROUPS) return;
		saveActive();
		const titles = activePerson().tasks.map((task) => ({ ...blankRow(), name: task.name }));
		const person = newPerson(nextGeneratedName(), titles.length > 0 ? titles : [blankRow()], true);
		people.push(person);
		select(person.id);
	}

	function removeActivePerson(): void {
		if (people.length <= 1) return;
		const index = people.findIndex((person) => person.id === activeId);
		people.splice(index, 1);
		activeId = people[Math.min(index, people.length - 1)].id;
		showPerson();
		ctx.changed();
		chips.get(activeId)?.button.focus();
	}

	function reconcileChips(totals: Map<number, string>): void {
		const ids = new Set(people.map((person) => person.id));
		for (const [id, chip] of chips) {
			if (ids.has(id)) continue;
			chip.button.remove();
			chips.delete(id);
		}
		people.forEach((person, index) => {
			let chip = chips.get(person.id);
			if (!chip) {
				const name = el('span', { class: 'pert-person-chip__name' });
				const total = el('span', { class: 'pert-person-chip__total' });
				const button = el('button', { class: 'pert-person-chip', attrs: { type: 'button', 'aria-pressed': 'false' } }, [name, total]);
				button.addEventListener('click', () => select(person.id));
				chip = { button, name, total };
				chips.set(person.id, chip);
			}
			chip.name.textContent = displayName(person);
			chip.total.textContent = totals.get(person.id) ?? '–';
			chip.button.setAttribute('aria-pressed', String(person.id === activeId));
			// Only move a chip when its position changed, so a focused chip keeps focus.
			const current = chipsElement.children[index];
			if (current !== chip.button) chipsElement.insertBefore(chip.button, current ?? null);
		});
	}

	function renderGaps(): void {
		const gaps = findScopeGaps(people.map(toGroup));
		gapsElement.replaceChildren(...gaps.map((gap) => {
			const person = people[gap.groupIndex];
			const shown = gap.missingTitles.slice(0, MAX_LISTED_TITLES).join(', ');
			const more = gap.missingTitles.length - MAX_LISTED_TITLES;
			const text = `${displayName(person)} saknar ${pluralize(gap.missingTitles.length, 'uppgift', 'uppgifter')} som andra har med: ${shown}${more > 0 ? ` och ${more} till` : ''}.`;
			const add = el('button', { class: 'pert-ghost', text: `Lägg till hos ${displayName(person)}`, attrs: { type: 'button' } });
			add.addEventListener('click', () => {
				saveActive();
				const room = Math.max(0, MAX_TASKS_PER_GROUP - person.tasks.length);
				person.tasks.push(...gap.missingTitles.slice(0, room).map((title) => ({ ...blankRow(), name: title })));
				activeId = person.id;
				showPerson();
				ctx.changed();
			});
			return el('div', { class: 'pert-gap', attrs: { role: 'status' } }, [
				alertIcon(),
				el('div', { class: 'pert-gap__body' }, [
					el('p', { text }),
					el('p', { class: 'pert-gap__hint', text: 'Olika omfattning ser ut som oenighet om tid i totalerna.' }),
					add,
				]),
			]);
		}));
	}

	function setImportOpen(open: boolean): void {
		importPanel.hidden = !open;
		importToggle.setAttribute('aria-expanded', String(open));
		importError.textContent = '';
		importUrl.removeAttribute('aria-invalid');
		if (open) importUrl.focus();
		else importToggle.focus();
	}

	function clearImportStatus(): void {
		lastImport = null;
		importStatus.hidden = true;
		importText.textContent = '';
	}

	function runImport(): void {
		const raw = importUrl.value.trim();
		if (!raw) {
			setImportOpen(false);
			return;
		}
		saveActive();

		const placeholder = people.length === 1 && isPristine(people[0]);
		const fallbackName = `Person ${placeholder ? 1 : people.length + 1}`;
		const imported = parseTaskLinkImport(raw, fallbackName);
		const fail = (message: string): void => {
			importUrl.setAttribute('aria-invalid', 'true');
			importError.textContent = message;
		};
		if (!imported.valid) {
			fail(imported.message);
			return;
		}
		const kept = placeholder ? 0 : people.length;
		if (kept + imported.groups.length > MAX_GROUPS) {
			fail(`Det får högst finnas ${MAX_GROUPS} personer. Ta bort några först.`);
			return;
		}

		const snapshot: ImportSnapshot = {
			importedIds: [],
			replaced: placeholder ? people[0] : null,
			previousHoursPerDay: ctx.getHoursPerDay(),
			previousActiveId: activeId,
		};
		if (placeholder) {
			people = [];
			ctx.setHoursPerDay(imported.hoursPerDay);
		}
		const added = imported.groups.map((group) => newPerson(
			group.name,
			group.tasks.map((task) => ({ name: task.title, o: task.o, m: task.m, p: task.p })),
			false,
		));
		snapshot.importedIds = added.map((person) => person.id);
		people.push(...added);

		activeId = added[0].id;
		showPerson();
		importUrl.value = '';
		setImportOpen(false);

		let message = `${pluralize(added.length, 'person importerad', 'personer importerade')}. Befintliga estimat behålls.`;
		if (!placeholder && imported.hoursPerDay !== ctx.getHoursPerDay()) {
			message += ` Tiderna importeras i timmar; din arbetsdag (${ctx.getHoursPerDay()} h) används i stället för länkens (${imported.hoursPerDay} h).`;
		}
		lastImport = snapshot;
		importText.textContent = message;
		importStatus.hidden = false;
		ctx.changed();
	}

	function undoImport(): void {
		const snapshot = lastImport;
		if (!snapshot) return;
		saveActive();
		people = people.filter((person) => !snapshot.importedIds.includes(person.id));
		if (snapshot.replaced) {
			people.unshift(snapshot.replaced);
			ctx.setHoursPerDay(snapshot.previousHoursPerDay);
		}
		if (people.length === 0) people.push(defaultPerson());
		activeId = people.some((person) => person.id === snapshot.previousActiveId)
			? snapshot.previousActiveId
			: people[0].id;
		clearImportStatus();
		showPerson();
		ctx.changed();
	}

	function paintDots(result: NonNullable<ReturnType<typeof previewGroupPert>['result']>): void {
		const mean = result.expectedHours;
		const totals = result.groups.map((group) => group.expectedHours);
		const low = Math.min(mean, ...totals);
		const high = Math.max(mean, ...totals);
		const pad = Math.max((high - low) * 0.15, mean * 0.05, 1);
		const percent = (value: number): number => ((value - (low - pad)) / (high + pad - (low - pad))) * 100;

		for (const dot of dots.querySelectorAll('.pert-dot')) dot.remove();
		for (const group of result.groups) {
			const dot = el('div', { class: 'pert-dot', attrs: { title: `${group.name}: ${formatSwedishNumber(group.expectedHours, 1)} h` } });
			dot.style.left = `${percent(group.expectedHours).toFixed(2)}%`;
			dots.append(dot);
		}
		dotsMean.style.left = `${percent(mean).toFixed(2)}%`;

		personList.replaceChildren(...result.groups.map((group) => {
			const sign = group.deviationHours >= 0 ? '+' : '−';
			return el('li', {}, [
				el('span', { class: 'pert-people-totals__name', text: group.name }),
				el('span', { class: 'pert-num pert-people-totals__total', text: `${formatSwedishNumber(group.expectedHours, 1)} h` }),
				el('span', { class: 'pert-num pert-people-totals__diff', text: `${sign}${formatSwedishNumber(Math.abs(group.deviationHours), 1)}` }),
			]);
		}));
	}

	function render(): void {
		saveActive();
		const active = activePerson();
		const hoursPerDay = ctx.getHoursPerDay();
		const groups = people.map(toGroup);

		const evaluations = active.tasks.map(evaluateRow);
		table.paint(evaluations);
		showRowProblems(rowError, evaluations);

		const totals = new Map<number, string>();
		for (const person of people) {
			const personPreview = previewTaskPert(toRows(person.tasks), hoursPerDay);
			totals.set(person.id, personPreview.result ? `${formatSwedishNumber(personPreview.result.expectedHours, 1)} h` : '–');
		}
		reconcileChips(totals);
		removePersonButton.hidden = people.length <= 1;
		addPersonButton.disabled = people.length >= MAX_GROUPS;
		renderGaps();

		const own = previewTaskPert(toRows(active.tasks), hoursPerDay).result;
		if (own) {
			table.setFooter({
				label: `Summa · ${pluralize(own.tasks.length, 'deluppgift', 'deluppgifter')} · σ ${formatSwedishNumber(own.standardDeviation, 1)} h`,
				o: formatSwedishNumber(own.totalO, 1),
				m: formatSwedishNumber(own.totalM, 1),
				p: formatSwedishNumber(own.totalP, 1),
				e: formatSwedishNumber(own.expectedHours, 1),
			});
		} else {
			table.setFooter({ label: 'Summa', o: '–', m: '–', p: '–', e: '–' });
		}

		const preview = previewGroupPert(groups, hoursPerDay);
		const validation = validateGroupTaskPertForm(groups, hoursPerDay);
		lastQuery = validation.valid
			? buildGroupTaskPertQueryString(validation.groups, validation.result.hoursPerDay)
			: null;
		share.setEnabled(preview.complete);
		share.setNoticeVisible(true);
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
			ctx.setSummary(null);
			return;
		}

		const format = (value: number): string => formatSwedishNumber(value, 1);
		band.update({
			mean: result.expectedHours,
			standardDeviation: result.standardDeviation,
			intervals: result.confidenceIntervals,
		});
		setText(root, 'avgO', format(result.averageO));
		setText(root, 'avgM', format(result.averageM));
		setText(root, 'avgP', format(result.averageP));
		const spread = formatSwedishNumber(result.relativeDisagreement * 100, 1);
		setText(root, 'spread', `spridning ${spread} %`);
		setText(root, 'within', formatSwedishNumber(Math.sqrt(result.withinVariance), 2));
		setText(root, 'between', formatSwedishNumber(Math.sqrt(result.betweenVariance), 2));
		paintDots(result);

		disagreementFlag.hidden = !result.teamDisagreement;
		disagreementFlag.replaceChildren(
			...(result.teamDisagreement
				? [alertIcon(), `Ni är oense om projektets totala tid (spridning ${spread} %). Prata igenom antagandena innan ni låser estimatet.`]
				: []),
		);
		uncertaintyFlag.hidden = !result.highUncertainty;

		ctx.setSummary(`${format(result.expectedHours)} h ± ${formatSwedishNumber(result.standardDeviation, 1)}`);
	}

	personName.maxLength = MAX_TEXT_LENGTH;
	personName.addEventListener('input', () => {
		const person = activePerson();
		person.name = personName.value;
		person.generatedName = false;
		ctx.changed();
	});
	addPersonButton.addEventListener('click', addPerson);
	removePersonButton.addEventListener('click', removeActivePerson);
	importToggle.addEventListener('click', () => {
		if (importPanel.hidden) setImportOpen(true);
		else setImportOpen(false);
	});
	query<HTMLButtonElement>(root, '[data-import-run]').addEventListener('click', runImport);
	query<HTMLButtonElement>(root, '[data-import-cancel]').addEventListener('click', () => setImportOpen(false));
	importUrl.addEventListener('keydown', (event) => {
		if (event.key === 'Enter') {
			event.preventDefault();
			runImport();
		} else if (event.key === 'Escape') {
			setImportOpen(false);
		}
	});
	importUrl.addEventListener('input', () => {
		importUrl.removeAttribute('aria-invalid');
		importError.textContent = '';
	});
	query<HTMLButtonElement>(root, '[data-import-undo]').addEventListener('click', undoImport);
	query<HTMLButtonElement>(root, '[data-import-dismiss]').addEventListener('click', clearImportStatus);

	showPerson();

	return {
		token: 'grouptasks',
		activate: () => {
			render();
			gag.show();
		},
		render,
		queryString: () => lastQuery,
	};
}
