import { toBlob } from 'html-to-image';
import { initEnterpriseGag } from './enterprise-gag';
import {
	buildGroupTaskPertShareUrl,
	buildPertShareUrl,
	buildTaskPertShareUrl,
	DEFAULT_HOURS_PER_DAY,
	formatSwedishNumber,
	parsePertSearchParams,
	parseTaskLinkImport,
	validateGroupTaskPertForm,
	validatePertForm,
	validateTaskPertForm,
	type FieldError,
	type GroupTaskPertResult,
	type ConfidenceInterval,
	type ParticipantRowInput,
	type PertResult,
	type PertSettingsInput,
	type PertMode,
	type TaskGroupInput,
	type TaskPertResult,
	type TaskRowInput,
} from '../lib/pert';

interface RowRefs {
	li: HTMLLIElement;
	titleInput?: HTMLInputElement;
	oInput: HTMLInputElement;
	mInput: HTMLInputElement;
	pInput: HTMLInputElement;
	errorEl: HTMLParagraphElement;
	removeButton: HTMLButtonElement;
}

interface TaskGroupRefs {
	element: HTMLElement;
	nameInput: HTMLInputElement;
	list: HTMLUListElement;
	addButton: HTMLButtonElement;
	removeButton: HTMLButtonElement;
	errorEl: HTMLParagraphElement;
	totalEl: HTMLParagraphElement;
}

const modeInputs = Array.from(
	document.querySelectorAll<HTMLInputElement>('input[name="pert-mode"]'),
);
const participantForm = document.getElementById('participant-form') as HTMLFormElement;
const taskForm = document.getElementById('task-form') as HTMLFormElement;
const groupTaskForm = document.getElementById('group-task-form') as HTMLFormElement;
const taskGroupsEl = document.getElementById('task-groups') as HTMLDivElement;
const taskGroupTemplate = document.getElementById('task-group-template') as HTMLTemplateElement;
const addTaskGroupButton = document.getElementById('add-task-group-button') as HTMLButtonElement;
const groupUserCount = document.getElementById('group-user-count') as HTMLElement;
const groupHoursInput = document.getElementById('group-hours-per-day') as HTMLInputElement;
const groupHoursError = document.getElementById('group-hours-error') as HTMLParagraphElement;
const groupImportUrl = document.getElementById('group-import-url') as HTMLInputElement;
const groupImportName = document.getElementById('group-import-name') as HTMLInputElement;
const groupImportButton = document.getElementById('group-import-button') as HTMLButtonElement;
const groupImportStatus = document.getElementById('group-import-status') as HTMLParagraphElement;
const urlStatus = document.getElementById('pert-url-status') as HTMLParagraphElement;
const participantRowsList = document.getElementById('participant-rows') as HTMLUListElement;
const taskRowsList = document.getElementById('task-rows') as HTMLUListElement;
const participantRowTemplate = document.getElementById('row-template') as HTMLTemplateElement;
const taskRowTemplate = document.getElementById('task-row-template') as HTMLTemplateElement;
const addParticipantButton = document.getElementById('add-row-button') as HTMLButtonElement;
const addTaskButton = document.getElementById('add-task-button') as HTMLButtonElement;
const participantCountEl = document.getElementById('participant-count') as HTMLElement;
const meetingInput = document.getElementById('meeting-hours-input') as HTMLInputElement;
const meetingErrorEl = document.getElementById('meeting-hours-error') as HTMLParagraphElement;
const globalErrorsEl = document.getElementById('pert-errors') as HTMLDivElement;
const removeTaskDialog = document.getElementById('remove-task-dialog') as HTMLDialogElement;
const removeTaskCopy = document.getElementById('remove-task-copy') as HTMLParagraphElement;
const removeTaskTitle = document.getElementById('remove-task-title') as HTMLHeadingElement;
const cancelRemoveTaskButton = document.getElementById('cancel-remove-task') as HTMLButtonElement;
const confirmRemoveTaskButton = document.getElementById('confirm-remove-task') as HTMLButtonElement;

const resultPanel = document.getElementById('pert-result-panel') as HTMLElement;
const resultEmptyEl = document.getElementById('pert-result-empty') as HTMLElement;
const resultEmptyCopy = document.getElementById('result-empty-copy') as HTMLParagraphElement;
const participantResultEl = document.getElementById('participant-result') as HTMLElement;
const taskResultEl = document.getElementById('task-result') as HTMLElement;
const groupTaskResultEl = document.getElementById('group-task-result') as HTMLElement;
const avgOEl = document.getElementById('avg-o') as HTMLElement;
const avgMEl = document.getElementById('avg-m') as HTMLElement;
const avgPEl = document.getElementById('avg-p') as HTMLElement;
const formulaEl = document.getElementById('pert-formula') as HTMLElement;
const pertHoursEl = document.getElementById('pert-hours') as HTMLElement;
const pertDaysEl = document.getElementById('pert-days') as HTMLElement;
const pertConfidenceEl = document.getElementById('pert-confidence') as HTMLElement;
const meetingHoursEl = document.getElementById('meeting-hours') as HTMLElement;
const meetingNoteEl = document.getElementById('meeting-note') as HTMLElement;
const finalHoursEl = document.getElementById('final-hours') as HTMLElement;
const finalDaysEl = document.getElementById('final-days') as HTMLElement;
const peopleNoteEl = document.getElementById('people-note') as HTMLElement;
const uncertaintyWarningEl = document.getElementById('uncertainty-warning') as HTMLParagraphElement;
const disagreementWarningEl = document.getElementById('disagreement-warning') as HTMLParagraphElement;

const taskTotalOEl = document.getElementById('task-total-o') as HTMLElement;
const taskTotalMEl = document.getElementById('task-total-m') as HTMLElement;
const taskTotalPEl = document.getElementById('task-total-p') as HTMLElement;
const taskExpectedHoursEl = document.getElementById('task-expected-hours') as HTMLElement;
const taskExpectedDaysEl = document.getElementById('task-expected-days') as HTMLElement;
const taskStandardDeviationEl = document.getElementById(
	'task-standard-deviation',
) as HTMLElement;
const confidenceListEl = document.getElementById('confidence-list') as HTMLElement;
const taskBreakdownEl = document.getElementById('task-breakdown') as HTMLElement;
const taskNoteEl = document.getElementById('task-note') as HTMLElement;

const shareButton = document.getElementById('share-button') as HTMLButtonElement;
const pngButton = document.getElementById('png-button') as HTMLButtonElement;
const combinedButton = document.getElementById('combined-button') as HTMLButtonElement;
const shareStatus = document.getElementById('share-status') as HTMLParagraphElement;
const pngStatus = document.getElementById('png-status') as HTMLParagraphElement;
const combinedStatus = document.getElementById('combined-status') as HTMLParagraphElement;
const enterpriseGag = initEnterpriseGag();

let mode: PertMode = 'participants';
let pendingRemoval: { trigger: HTMLButtonElement; confirm: () => void } | null = null;
let draggedTaskRow: HTMLLIElement | null = null;
let draggedTaskStartIndex = -1;
let nextFieldId = 0;

function getRows(list: HTMLUListElement, includeTitle = false): RowRefs[] {
	return Array.from(list.querySelectorAll<HTMLLIElement>('li.participant-row')).map((li) => ({
		li,
		titleInput: includeTitle
			? (li.querySelector('.field-title') as HTMLInputElement)
			: undefined,
		oInput: li.querySelector('.field-o') as HTMLInputElement,
		mInput: li.querySelector('.field-m') as HTMLInputElement,
		pInput: li.querySelector('.field-p') as HTMLInputElement,
		errorEl: li.querySelector('.participant-row__error') as HTMLParagraphElement,
		removeButton: li.querySelector('.participant-row__remove') as HTMLButtonElement,
	}));
}

function formatParticipantCount(count: number): string {
	return count === 1 ? '1 person' : `${count} personer`;
}

function syncParticipantMeta(): void {
	const rows = getRows(participantRowsList);
	participantCountEl.textContent = formatParticipantCount(rows.length);
	rows.forEach((row, index) => {
		row.removeButton.setAttribute('aria-label', `Ta bort deltagare ${index + 1}`);
	});
}

function getActiveRows(): RowRefs[] {
	if (mode === 'participants') return getRows(participantRowsList);
	if (mode === 'grouptasks') return getTaskGroups().flatMap((group) => getRows(group.list, true));
	return getRows(taskRowsList, true);
}

function renumberRows(list: HTMLUListElement, label: string): void {
	getRows(list, list !== participantRowsList).forEach((row, index) => {
		const title = row.li.querySelector('.participant-row__title');
		if (title) title.textContent = `${label} ${index + 1}`;
		if (row.titleInput?.dataset.generatedTitle === 'true') {
			row.titleInput.value = `${label} ${index + 1}`;
		}
		if (row.titleInput) row.titleInput.setAttribute('aria-label', `Titel för deluppgift ${index + 1}`);
		row.removeButton.setAttribute('aria-label', `Ta bort ${label.toLowerCase()} ${index + 1}`);
	});
}

function updateRemoveButtons(list: HTMLUListElement): void {
	const rows = getRows(list, list !== participantRowsList);
	for (const row of rows) row.removeButton.disabled = rows.length <= 1;
}

function clearActionStatus(): void {
	shareStatus.textContent = '';
	pngStatus.textContent = '';
	combinedStatus.textContent = '';
}

function removeRow(row: RowRefs, list: HTMLUListElement, label: string): void {
	const rows = getRows(list, list !== participantRowsList);
	const removedIndex = rows.findIndex((candidate) => candidate.li === row.li);
	row.li.remove();
	if (list === participantRowsList) syncParticipantMeta();
	renumberRows(list, label);
	updateRemoveButtons(list);
	clearActionStatus();
	render();

	const remainingRows = getRows(list, list !== participantRowsList);
	const focusRow = remainingRows[removedIndex] ?? remainingRows[removedIndex - 1];
	(focusRow
		? (focusRow.titleInput ?? focusRow.oInput)
		: list === participantRowsList
			? addParticipantButton
			: addTaskButton
	).focus();
}

function hasEstimateData(row: RowRefs): boolean {
	return [row.oInput, row.mInput, row.pInput].some((input) => input.value.trim() !== '');
}

function requestTaskRemoval(row: RowRefs, list: HTMLUListElement): void {
	if (!hasEstimateData(row)) {
		removeRow(row, list, 'Deluppgift');
		return;
	}

	pendingRemoval = {
		trigger: row.removeButton,
		confirm: () => removeRow(row, list, 'Deluppgift'),
	};
	const taskTitle = row.titleInput?.value.trim() || 'deluppgiften';
	removeTaskTitle.textContent = 'Ta bort deluppgift?';
	removeTaskCopy.textContent = `Är du säker på att du vill ta bort ”${taskTitle}”? Inmatade O-, M- och P-värden försvinner.`;
	removeTaskDialog.showModal();
	cancelRemoveTaskButton.focus();
}

function finishTaskReorder(): void {
	if (!draggedTaskRow) return;
	const list = draggedTaskRow.parentElement;
	if (!(list instanceof HTMLUListElement)) return;
	const nextIndex = Array.from(list.children).indexOf(draggedTaskRow);
	draggedTaskRow.classList.remove('task-row--dragging');
	draggedTaskRow = null;

	if (nextIndex !== draggedTaskStartIndex) {
		renumberRows(list, 'Deluppgift');
		clearActionStatus();
		render();
		setResultText('task-reorder-status', `Deluppgiften flyttades till plats ${nextIndex + 1}.`);
	}
	draggedTaskStartIndex = -1;
}

function bindTaskReordering(row: RowRefs, list: HTMLUListElement): void {
	row.li.tabIndex = 0;
	row.li.setAttribute('aria-describedby', 'task-reorder-hint');
	row.li.setAttribute('aria-keyshortcuts', 'Alt+ArrowUp Alt+ArrowDown');
	row.li.addEventListener('keydown', (event) => {
		if (event.target !== row.li || !event.altKey ||
			(event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
		event.preventDefault();
		const sibling = event.key === 'ArrowUp' ? row.li.previousElementSibling : row.li.nextElementSibling;
		if (!(sibling instanceof HTMLLIElement)) return;
		if (event.key === 'ArrowUp') list.insertBefore(row.li, sibling);
		else list.insertBefore(sibling, row.li);
		renumberRows(list, 'Deluppgift');
		clearActionStatus();
		render();
		row.li.focus();
		setResultText('task-reorder-status', `Deluppgiften flyttades till plats ${Array.from(list.children).indexOf(row.li) + 1}.`);
	});

	row.li.addEventListener('touchstart', (event) => {
		if (draggedTaskRow === row.li) event.preventDefault();
	}, { passive: false });

	row.li.addEventListener('pointerdown', (event) => {
		if (event.button !== 0 || !event.isPrimary || draggedTaskRow) return;
		if (event.target instanceof Element && event.target.closest('input, textarea, button')) {
			return;
		}
		event.preventDefault();
		draggedTaskRow = row.li;
		draggedTaskStartIndex = Array.from(list.children).indexOf(row.li);
		row.li.classList.add('task-row--dragging');

		const pointerId = event.pointerId;
		const controller = new AbortController();
		list.setPointerCapture(pointerId);
		list.addEventListener('pointermove', (move) => {
			if (move.pointerId !== pointerId || draggedTaskRow !== row.li) return;
			move.preventDefault();
			const target = getRows(list, true).find((candidate) => {
				if (candidate.li === row.li) return false;
				const rect = candidate.li.getBoundingClientRect();
				return move.clientY < rect.top + rect.height / 2;
			});
			list.insertBefore(row.li, target?.li ?? null);
			if (move.clientY < 60) window.scrollBy(0, -16);
			else if (move.clientY > window.innerHeight - 60) window.scrollBy(0, 16);
		}, { signal: controller.signal, passive: false });
		const end = (up: PointerEvent): void => {
			if (up.pointerId !== pointerId) return;
			controller.abort();
			if (list.hasPointerCapture(pointerId)) list.releasePointerCapture(pointerId);
			finishTaskReorder();
		};
		list.addEventListener('pointerup', end, { signal: controller.signal });
		list.addEventListener('pointercancel', end, { signal: controller.signal });
		list.addEventListener('lostpointercapture', end, { signal: controller.signal });
	});
}

function bindRow(li: HTMLLIElement, list: HTMLUListElement, label: string): HTMLLIElement {
	const inputs = Array.from(li.querySelectorAll<HTMLInputElement>('input'));
	for (const input of inputs) {
		input.addEventListener('input', () => {
			if (input.classList.contains('field-title')) {
				delete input.dataset.generatedTitle;
			}
			clearActionStatus();
			render();
		});
	}

	const removeButton = li.querySelector('.participant-row__remove') as HTMLButtonElement;
	removeButton.addEventListener('click', () => {
		const row = getRowsFromElement(li, list !== participantRowsList);
		if (list !== participantRowsList) requestTaskRemoval(row, list);
		else removeRow(row, list, label);
	});

	if (list !== participantRowsList) bindTaskReordering(getRowsFromElement(li, true), list);
	return li;
}

function addParticipantRow(
	values?: ParticipantRowInput,
	options?: { focus?: boolean },
): void {
	const fragment = participantRowTemplate.content.cloneNode(true) as DocumentFragment;
	const li = fragment.querySelector('li.participant-row') as HTMLLIElement;
	const row = getRowsFromElement(li);
	if (values) {
		row.oInput.value = values.o;
		row.mInput.value = values.m;
		row.pInput.value = values.p;
	}
	participantRowsList.appendChild(bindRow(li, participantRowsList, 'Person'));
	syncParticipantMeta();
	updateRemoveButtons(participantRowsList);
	if (options?.focus) row.oInput.focus();
}

function addTaskRow(
	values?: TaskRowInput,
	options?: { focus?: boolean },
	list = taskRowsList,
): void {
	const fragment = taskRowTemplate.content.cloneNode(true) as DocumentFragment;
	const li = fragment.querySelector('li.participant-row') as HTMLLIElement;
	const row = getRowsFromElement(li, true);
	if (values && row.titleInput) {
		row.titleInput.value = values.title;
		row.oInput.value = values.o;
		row.mInput.value = values.m;
		row.pInput.value = values.p;
	} else if (row.titleInput) {
		row.titleInput.value = `Deluppgift ${getRows(list, true).length + 1}`;
		row.titleInput.dataset.generatedTitle = 'true';
	}
	row.errorEl.id = `task-field-error-${nextFieldId++}`;
	for (const input of [row.titleInput, row.oInput, row.mInput, row.pInput]) {
		input?.setAttribute('aria-describedby', row.errorEl.id);
	}
	list.appendChild(bindRow(li, list, 'Deluppgift'));
	renumberRows(list, 'Deluppgift');
	updateRemoveButtons(list);
	if (options?.focus && row.titleInput) {
		row.titleInput.focus();
		row.titleInput.select();
	}
}

function getRowsFromElement(li: HTMLLIElement, includeTitle = false): RowRefs {
	return {
		li,
		titleInput: includeTitle
			? (li.querySelector('.field-title') as HTMLInputElement)
			: undefined,
		oInput: li.querySelector('.field-o') as HTMLInputElement,
		mInput: li.querySelector('.field-m') as HTMLInputElement,
		pInput: li.querySelector('.field-p') as HTMLInputElement,
		errorEl: li.querySelector('.participant-row__error') as HTMLParagraphElement,
		removeButton: li.querySelector('.participant-row__remove') as HTMLButtonElement,
	};
}

function collectParticipantInputs(rows: RowRefs[]): ParticipantRowInput[] {
	return rows.map((row) => ({
		o: row.oInput.value,
		m: row.mInput.value,
		p: row.pInput.value,
	}));
}

function collectTaskInputs(rows: RowRefs[]): TaskRowInput[] {
	return rows.map((row) => ({
		title: row.titleInput?.value ?? '',
		o: row.oInput.value,
		m: row.mInput.value,
		p: row.pInput.value,
	}));
}

function getTaskGroups(): TaskGroupRefs[] {
	return Array.from(taskGroupsEl.querySelectorAll<HTMLElement>('.task-group')).map((element) => ({
		element,
		nameInput: element.querySelector('.task-group__name') as HTMLInputElement,
		list: element.querySelector('.task-group__rows') as HTMLUListElement,
		addButton: element.querySelector('.task-group__add-task') as HTMLButtonElement,
		removeButton: element.querySelector('.task-group__remove') as HTMLButtonElement,
		errorEl: element.querySelector('.task-group__error') as HTMLParagraphElement,
		totalEl: element.querySelector('.task-group__total') as HTMLParagraphElement,
	}));
}

function collectGroupInputs(): TaskGroupInput[] {
	return getTaskGroups().map((group) => ({
		name: group.nameInput.value,
		tasks: collectTaskInputs(getRows(group.list, true)),
	}));
}

function syncTaskGroups(): void {
	const groups = getTaskGroups();
	groupUserCount.textContent = `(${groups.length})`;
	groups.forEach((group, index) => {
		if (group.nameInput.dataset.generatedName === 'true') {
			group.nameInput.value = `Användare ${index + 1}`;
		}
		group.removeButton.disabled = groups.length <= 1;
		group.removeButton.setAttribute('aria-label', `Ta bort ${group.nameInput.value || `användare ${index + 1}`}`);
		group.nameInput.setAttribute('aria-label', `Namn för användare ${index + 1}`);
		const count = group.element.querySelector('.task-group__count');
		if (count) count.textContent = `(${getRows(group.list, true).length})`;
	});
}

function removeTaskGroup(group: TaskGroupRefs): void {
	const groups = getTaskGroups();
	const index = groups.findIndex((candidate) => candidate.element === group.element);
	group.element.remove();
	syncTaskGroups();
	clearActionStatus();
	render();
	const remaining = getTaskGroups();
	(remaining[index]?.nameInput ?? remaining[index - 1]?.nameInput ?? addTaskGroupButton).focus();
}

function addTaskGroup(values?: TaskGroupInput, focus = false): void {
	const fragment = taskGroupTemplate.content.cloneNode(true) as DocumentFragment;
	const element = fragment.querySelector('.task-group') as HTMLElement;
	taskGroupsEl.appendChild(element);
	const group = getTaskGroups().find((candidate) => candidate.element === element);
	if (!group) throw new Error('Kunde inte skapa användarens formulär.');

	group.errorEl.id = `group-field-error-${nextFieldId++}`;
	group.nameInput.setAttribute('aria-describedby', group.errorEl.id);
	group.nameInput.value = values?.name ?? `Användare ${getTaskGroups().length}`;
	if (!values) group.nameInput.dataset.generatedName = 'true';
	if (values?.tasks.length) {
		for (const task of values.tasks) addTaskRow(task, undefined, group.list);
	} else {
		addTaskRow(undefined, undefined, group.list);
	}
	group.nameInput.addEventListener('input', () => {
		delete group.nameInput.dataset.generatedName;
		clearActionStatus();
		render();
	});
	group.addButton.addEventListener('click', () => {
		addTaskRow(undefined, { focus: true }, group.list);
		clearActionStatus();
		render();
	});
	group.removeButton.addEventListener('click', () => {
		if (!getRows(group.list, true).some(hasEstimateData)) {
			removeTaskGroup(group);
			return;
		}
		pendingRemoval = { trigger: group.removeButton, confirm: () => removeTaskGroup(group) };
		removeTaskTitle.textContent = 'Ta bort användare?';
		removeTaskCopy.textContent = `Är du säker på att du vill ta bort ”${group.nameInput.value}”? Alla användarens deluppgifter och O-, M- och P-värden försvinner.`;
		removeTaskDialog.showModal();
		cancelRemoveTaskButton.focus();
	});
	element.querySelector('.task-group__reuse')?.addEventListener('click', () => {
		addTaskGroup({
			name: `Användare ${getTaskGroups().length + 1}`,
			tasks: collectTaskInputs(getRows(group.list, true)).map((task) => ({
				title: task.title, o: '', m: '', p: '',
			})),
		}, true);
		clearActionStatus();
		render();
	});
	syncTaskGroups();
	if (focus) {
		group.nameInput.focus();
		group.nameInput.select();
	}
}

function importTaskGroups(): void {
	const existing = getTaskGroups();
	const placeholder = existing.length === 1 &&
		existing[0].nameInput.dataset.generatedName === 'true' &&
		getRows(existing[0].list, true).every((row) =>
			row.titleInput?.dataset.generatedTitle === 'true' && !hasEstimateData(row));
	const name = groupImportName.value.trim() || `Användare ${placeholder ? 1 : existing.length + 1}`;
	const imported = parseTaskLinkImport(groupImportUrl.value, name);
	if (!imported.valid) {
		groupImportUrl.setAttribute('aria-invalid', 'true');
		groupImportStatus.dataset.tone = 'error';
		groupImportStatus.textContent = imported.message;
		return;
	}

	// Replace only the untouched initial placeholder; all entered data is kept.
	if (placeholder) {
		existing[0].element.remove();
		groupHoursInput.value = imported.hoursPerDay;
	}
	for (const group of imported.groups) addTaskGroup(group);
	clearActionStatus();
	render();
	groupImportUrl.removeAttribute('aria-invalid');
	groupImportUrl.value = '';
	groupImportName.value = '';
	groupImportStatus.dataset.tone = 'success';
	groupImportStatus.textContent = `${imported.groups.length} ${imported.groups.length === 1 ? 'användare importerad' : 'användare importerade'}. Befintliga estimat behålls.`;
	if (imported.hoursPerDay !== groupHoursInput.value) {
		groupImportStatus.textContent += ` Tiderna importeras i timmar; gruppens arbetsdag (${groupHoursInput.value} h) används i stället för länkens (${imported.hoursPerDay} h).`;
	}
}

function collectSettingsInput(): PertSettingsInput {
	return {
		meetingHoursPerPerson: meetingInput.value,
		hoursPerDay: String(DEFAULT_HOURS_PER_DAY),
	};
}

function clearFieldStates(rows: RowRefs[]): void {
	for (const row of rows) {
		row.titleInput?.removeAttribute('aria-invalid');
		row.oInput.removeAttribute('aria-invalid');
		row.mInput.removeAttribute('aria-invalid');
		row.pInput.removeAttribute('aria-invalid');
		row.errorEl.textContent = '';
	}
	meetingInput.removeAttribute('aria-invalid');
	meetingErrorEl.textContent = '';
	globalErrorsEl.hidden = true;
	globalErrorsEl.textContent = '';
	groupHoursInput.removeAttribute('aria-invalid');
	groupHoursError.textContent = '';
	for (const group of getTaskGroups()) {
		group.nameInput.removeAttribute('aria-invalid');
		group.errorEl.textContent = '';
	}
}

function applyErrors(errors: FieldError[], rows: RowRefs[]): void {
	const globalMessages: string[] = [];

	for (const error of errors) {
		const numberFieldMatch = /^row-(\d+)-(o|m|p)$/.exec(error.field);
		const orderMatch = /^row-(\d+)-order$/.exec(error.field);
		const titleMatch = /^task-(\d+)-title$/.exec(error.field);

		if (numberFieldMatch) {
			const row = rows[Number(numberFieldMatch[1])];
			if (!row) continue;
			const key = numberFieldMatch[2];
			const input = key === 'o' ? row.oInput : key === 'm' ? row.mInput : row.pInput;
			input.setAttribute('aria-invalid', 'true');
			if (!row.errorEl.textContent) row.errorEl.textContent = error.message;
		} else if (orderMatch) {
			const row = rows[Number(orderMatch[1])];
			if (!row) continue;
			row.oInput.setAttribute('aria-invalid', 'true');
			row.mInput.setAttribute('aria-invalid', 'true');
			row.pInput.setAttribute('aria-invalid', 'true');
			row.errorEl.textContent = error.message;
		} else if (titleMatch) {
			const row = rows[Number(titleMatch[1])];
			if (!row?.titleInput) continue;
			row.titleInput.setAttribute('aria-invalid', 'true');
			if (!row.errorEl.textContent) row.errorEl.textContent = error.message;
		} else if (error.field === 'settings-meetingHoursPerPerson') {
			meetingInput.setAttribute('aria-invalid', 'true');
			meetingErrorEl.textContent = error.message;
		} else {
			globalMessages.push(error.message);
		}
	}

	if (globalMessages.length > 0) {
		globalErrorsEl.hidden = false;
		globalErrorsEl.textContent = globalMessages.join(' ');
	}
}

function applyGroupErrors(errors: FieldError[]): void {
	const groups = getTaskGroups();
	const global: FieldError[] = [];
	for (const error of errors) {
		const match = /^group-(\d+)-(.+)$/.exec(error.field);
		if (match) {
			const group = groups[Number(match[1])];
			if (!group) continue;
			const field = match[2];
			if (field === 'name') {
				group.nameInput.setAttribute('aria-invalid', 'true');
				group.errorEl.textContent = error.message;
			} else if (field === 'tasks') {
				group.errorEl.textContent = error.message;
			} else {
				applyErrors([{ ...error, field }], getRows(group.list, true));
				(group.element.querySelector('.task-group__details') as HTMLDetailsElement).open = true;
			}
		} else if (error.field === 'settings-hoursPerDay') {
			groupHoursInput.setAttribute('aria-invalid', 'true');
			groupHoursError.textContent = error.message;
		} else {
			global.push(error);
		}
	}
	applyErrors(global, []);
}

function renderParticipantResult(result: PertResult): void {
	const pertDays = result.pertHours / result.hoursPerDay;
	const meetingDays = result.meetingTotalHours / result.hoursPerDay;

	avgOEl.textContent = `${formatSwedishNumber(result.averageO)} h`;
	avgMEl.textContent = `${formatSwedishNumber(result.averageM)} h`;
	avgPEl.textContent = `${formatSwedishNumber(result.averageP)} h`;
	formulaEl.textContent = `PERT = (${formatSwedishNumber(result.averageO)} + 4 × ${formatSwedishNumber(result.averageM)} + ${formatSwedishNumber(result.averageP)}) / 6`;
	pertHoursEl.textContent = `${formatSwedishNumber(result.pertHours)} timmar`;
	pertDaysEl.textContent = `≈ ${formatSwedishNumber(pertDays)} arbetsdagar`;
	meetingHoursEl.textContent = `${formatSwedishNumber(result.meetingTotalHours)} timmar`;
	meetingNoteEl.textContent = `${result.peopleCount} personer × ${formatSwedishNumber(result.meetingHoursPerPerson)} h ≈ ${formatSwedishNumber(meetingDays)} arbetsdagar`;
	finalHoursEl.textContent = `${formatSwedishNumber(result.finalHours)} timmar`;
	finalDaysEl.textContent = `≈ ${formatSwedishNumber(result.workdays)} arbetsdagar`;
	pertConfidenceEl.textContent = `Sannolikt ${formatSwedishNumber(result.finalLowHours)}–${formatSwedishNumber(result.finalHighHours)} timmar`;
	peopleNoteEl.textContent = `${result.peopleCount} personer inmatade. Arbetsdag = ${formatSwedishNumber(result.hoursPerDay, 0)} timmar.`;

	uncertaintyWarningEl.hidden = !result.highUncertainty;
	uncertaintyWarningEl.textContent = result.highUncertainty
		? 'Stor spridning mellan optimistisk och pessimistisk uppskattning — resultatet är osäkert. Överväg att dela upp uppgiften.'
		: '';

	disagreementWarningEl.hidden = !result.teamDisagreement;
	disagreementWarningEl.textContent = result.teamDisagreement
		? 'Deltagarna är inte överens om hur lång tid uppgiften tar — se över era "mest sannolik"-uppskattningar tillsammans.'
		: '';
}

function renderConfidenceIntervals(
	element: HTMLElement,
	result: { expectedHours: number; standardDeviation: number; confidenceIntervals: ConfidenceInterval[] },
	approximate = false,
): void {
	element.replaceChildren(
		...result.confidenceIntervals.map((interval) => {
			const row = document.createElement('div');
			row.className = 'confidence-row';

			const level = document.createElement('span');
			level.className = 'confidence-row__level';
			level.textContent = `±${interval.standardDeviations} SD (${approximate ? '≈ ' : ''}${interval.confidence})`;

			const calculation = document.createElement('span');
			calculation.className = 'confidence-row__calculation';
			calculation.textContent = `${formatSwedishNumber(result.expectedHours)} ± ${formatSwedishNumber(interval.standardDeviations * result.standardDeviation, 2)}`;

			const range = document.createElement('span');
			range.className = 'confidence-row__interval';
			range.textContent = `${formatSwedishNumber(interval.lowerHours)}–${formatSwedishNumber(interval.upperHours)} h`;

			row.append(level, calculation, range);
			return row;
		}),
	);
}

function renderTaskBreakdown(element: HTMLElement, tasks: TaskPertResult['tasks']): void {
	element.replaceChildren(
		...tasks.map((task) => {
			const row = document.createElement('div');
			row.className = 'task-breakdown__row';

			const title = document.createElement('span');
			title.className = 'task-breakdown__title';
			title.textContent = task.title;

			const value = document.createElement('span');
			value.className = 'task-breakdown__value';
			value.textContent = `${formatSwedishNumber(task.expectedHours)} h`;

			row.append(title, value);
			return row;
		}),
	);
}

function renderTaskResult(result: TaskPertResult): void {
	taskTotalOEl.textContent = `${formatSwedishNumber(result.totalO)} h`;
	taskTotalMEl.textContent = `${formatSwedishNumber(result.totalM)} h`;
	taskTotalPEl.textContent = `${formatSwedishNumber(result.totalP)} h`;
	taskExpectedHoursEl.textContent = `${formatSwedishNumber(result.expectedHours)} timmar`;
	taskExpectedDaysEl.textContent = `≈ ${formatSwedishNumber(result.workdays)} arbetsdagar`;
	taskStandardDeviationEl.textContent = `${formatSwedishNumber(result.standardDeviation, 2)} timmar`;
	renderConfidenceIntervals(confidenceListEl, result);
	renderTaskBreakdown(taskBreakdownEl, result.tasks);
	taskNoteEl.textContent = `${result.tasks.length} deluppgifter. Arbetsdag = ${formatSwedishNumber(result.hoursPerDay, 0)} timmar.`;
}

function setResultText(id: string, text: string): void {
	const element = document.getElementById(id);
	if (!element) throw new Error(`Resultatfält saknas: ${id}`);
	element.textContent = text;
}

function renderGroupTaskResult(result: GroupTaskPertResult): void {
	setResultText('group-average-o', `${formatSwedishNumber(result.averageO)} h`);
	setResultText('group-average-m', `${formatSwedishNumber(result.averageM)} h`);
	setResultText('group-average-p', `${formatSwedishNumber(result.averageP)} h`);
	setResultText('group-expected-hours', `${formatSwedishNumber(result.expectedHours)} timmar`);
	setResultText('group-expected-days', `≈ ${formatSwedishNumber(result.workdays)} arbetsdagar`);
	setResultText('group-standard-deviation', `${formatSwedishNumber(result.standardDeviation, 2)} timmar`);
	setResultText('group-within-deviation', `${formatSwedishNumber(Math.sqrt(result.withinVariance), 2)} h`);
	setResultText('group-between-deviation', `${formatSwedishNumber(Math.sqrt(result.betweenVariance), 2)} h`);
	setResultText('group-disagreement', `${formatSwedishNumber(result.relativeDisagreement * 100)} % relativ spridning mellan totalerna`);
	setResultText('group-result-note', `${result.groups.length} användare, lika vikt per användare. Arbetsdag = ${formatSwedishNumber(result.hoursPerDay)} timmar. Alla uppskattar samma projektomfattning.`);
	(document.getElementById('group-disagreement-warning') as HTMLElement).hidden = !result.teamDisagreement;
	(document.getElementById('group-uncertainty-warning') as HTMLElement).hidden = !result.highUncertainty;
	renderConfidenceIntervals(document.getElementById('group-confidence-list') as HTMLElement, result, true);

	const comparison = document.getElementById('group-comparison') as HTMLElement;
	comparison.replaceChildren(...result.groups.map((group) => {
		const section = document.createElement('details');
		section.className = 'group-comparison__person';
		const summary = document.createElement('summary');
		summary.title = 'Visa användarens deluppgifter';
		const name = document.createElement('strong');
		name.textContent = group.name;
		const total = document.createElement('span');
		total.className = 'group-comparison__total';
		total.textContent = `${formatSwedishNumber(group.expectedHours)} h`;
		summary.append(name, total);
		const meta = document.createElement('span');
		meta.className = 'group-comparison__meta';
		const signedDeviation = `${group.deviationHours > 0 ? '+' : ''}${formatSwedishNumber(group.deviationHours)} h`;
		meta.textContent = `${group.tasks.length} deluppgifter · SD ${formatSwedishNumber(group.standardDeviation, 2)} h · Avvikelse från gruppen ${signedDeviation}`;
		const breakdown = document.createElement('div');
		breakdown.className = 'task-breakdown';
		renderTaskBreakdown(breakdown, group.tasks);
		summary.append(meta);
		section.append(summary, breakdown);
		return section;
	}));
}

function setResultVisibility(valid: boolean): void {
	resultPanel.hidden = !valid;
	resultEmptyEl.hidden = valid;
	shareButton.disabled = !valid;
	pngButton.disabled = !valid;
	combinedButton.disabled = !valid;
}

function render(): void {
	const rows = getActiveRows();
	clearFieldStates(rows);
	participantResultEl.hidden = mode !== 'participants';
	taskResultEl.hidden = mode !== 'tasks';
	groupTaskResultEl.hidden = mode !== 'grouptasks';

	if (mode === 'grouptasks') {
		syncTaskGroups();
		for (const group of getTaskGroups()) {
			const individual = validateTaskPertForm(
				collectTaskInputs(getRows(group.list, true)),
				String(DEFAULT_HOURS_PER_DAY),
			);
			group.totalEl.textContent = individual.valid
				? `${individual.result.tasks.length} deluppgifter · ${formatSwedishNumber(individual.result.expectedHours)} h · SD ${formatSwedishNumber(individual.result.standardDeviation, 2)} h`
				: 'Fyll i giltiga O-, M- och P-värden för alla deluppgifter.';
		}
		const validation = validateGroupTaskPertForm(collectGroupInputs(), groupHoursInput.value);
		if (!validation.valid) {
			applyGroupErrors(validation.errors);
			setResultVisibility(false);
			window.history.replaceState(null, '', `${window.location.pathname}?mode=grouptasks`);
			return;
		}
		renderGroupTaskResult(validation.result);
		setResultVisibility(true);
		window.history.replaceState(null, '', buildGroupTaskPertShareUrl(
			window.location.origin + window.location.pathname,
			validation.groups, validation.result.hoursPerDay,
		));
		return;
	}

	if (mode === 'participants') {
		const validation = validatePertForm(collectParticipantInputs(rows), collectSettingsInput());
		if (!validation.valid) {
			applyErrors(validation.errors, rows);
			uncertaintyWarningEl.hidden = true;
			disagreementWarningEl.hidden = true;
			setResultVisibility(false);
			return;
		}
		renderParticipantResult(validation.result);
		setResultVisibility(true);
		window.history.replaceState(
			null,
			'',
			buildPertShareUrl(
				window.location.origin + window.location.pathname,
				validation.participants,
				validation.settings,
			),
		);
		return;
	}

	const validation = validateTaskPertForm(
		collectTaskInputs(rows),
		String(DEFAULT_HOURS_PER_DAY),
	);
	if (!validation.valid) {
		applyErrors(validation.errors, rows);
		setResultVisibility(false);
		window.history.replaceState(null, '', `${window.location.pathname}?mode=tasks`);
		return;
	}
	renderTaskResult(validation.result);
	setResultVisibility(true);
	window.history.replaceState(
		null,
		'',
		buildTaskPertShareUrl(
			window.location.origin + window.location.pathname,
			validation.tasks,
			validation.result.hoursPerDay,
		),
	);
}

function setMode(nextMode: PertMode): void {
	mode = nextMode;
	participantForm.hidden = mode !== 'participants';
	taskForm.hidden = mode !== 'tasks';
	groupTaskForm.hidden = mode !== 'grouptasks';
	const workspace = groupTaskForm.closest<HTMLElement>('.pert-workspace');
	if (workspace) workspace.dataset.mode = mode;
	resultEmptyCopy.textContent =
		mode === 'participants'
			? 'Fyll i minst en deltagare med giltiga O-, M- och P-värden så visas resultatet här.'
			: mode === 'tasks'
				? 'Fyll i minst en namngiven deluppgift med giltiga O-, M- och P-värden så visas resultatet här.'
				: 'Lägg till användare eller importera en länk. Fyll i giltiga estimat för alla användare så visas gruppens resultat här.';
	clearActionStatus();
	render();
	if (mode === 'grouptasks') enterpriseGag.show();
}

function currentShareUrl(): string | null {
	if (mode === 'grouptasks') {
		const validation = validateGroupTaskPertForm(collectGroupInputs(), groupHoursInput.value);
		return validation.valid
			? buildGroupTaskPertShareUrl(
				window.location.origin + window.location.pathname,
				validation.groups, validation.result.hoursPerDay,
			)
			: null;
	}
	if (mode === 'participants') {
		const validation = validatePertForm(
			collectParticipantInputs(getRows(participantRowsList)),
			collectSettingsInput(),
		);
		return validation.valid
			? buildPertShareUrl(
					window.location.origin + window.location.pathname,
					validation.participants,
					validation.settings,
				)
			: null;
	}

	const validation = validateTaskPertForm(
		collectTaskInputs(getRows(taskRowsList, true)),
		String(DEFAULT_HOURS_PER_DAY),
	);
	return validation.valid
		? buildTaskPertShareUrl(
				window.location.origin + window.location.pathname,
				validation.tasks,
				validation.result.hoursPerDay,
			)
		: null;
}

function initFromUrl(): void {
	const parsed = parsePertSearchParams(window.location.search);
	meetingInput.value = parsed.meetingHoursPerPerson;
	groupHoursInput.value = parsed.mode === 'grouptasks' ? parsed.hoursPerDay : String(DEFAULT_HOURS_PER_DAY);
	if (parsed.errors.length) {
		urlStatus.hidden = false;
		urlStatus.textContent = `${parsed.errors.join(' ')} Kontrollera den ursprungliga länken.`;
	}

	if (parsed.rows.length > 0) {
		for (const row of parsed.rows) addParticipantRow(row);
	} else {
		addParticipantRow();
	}

	if (parsed.tasks.length > 0) {
		for (const task of parsed.tasks) addTaskRow(task);
	} else {
		addTaskRow();
	}

	if (parsed.groups.length && parsed.errors.length === 0) {
		for (const group of parsed.groups) addTaskGroup(group);
	} else {
		addTaskGroup();
	}

	const selectedMode = modeInputs.find((input) => input.value === parsed.mode);
	if (selectedMode) selectedMode.checked = true;
	mode = parsed.mode;
	participantForm.hidden = mode !== 'participants';
	taskForm.hidden = mode !== 'tasks';
	groupTaskForm.hidden = mode !== 'grouptasks';
}

function downloadBlob(blob: Blob): void {
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = 'pert-resultat.png';
	document.body.appendChild(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
}

// The result panel's box-shadow can bleed into the capture at the rounded
// corners, so it's temporarily removed while the image is generated.
async function capturePngBlob(): Promise<Blob> {
	const previousBoxShadow = resultPanel.style.boxShadow;
	resultPanel.style.boxShadow = 'none';
	await new Promise((resolve) => requestAnimationFrame(resolve));

	try {
		const blob = await toBlob(resultPanel, { pixelRatio: 2 });
		if (!blob) throw new Error('Kunde inte generera bilden.');
		return blob;
	} finally {
		resultPanel.style.boxShadow = previousBoxShadow;
	}
}

function blobToDataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(blob);
	});
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

for (const modeInput of modeInputs) {
	modeInput.addEventListener('change', () => {
		if (modeInput.checked) setMode(modeInput.value as PertMode);
	});
}

addParticipantButton.addEventListener('click', () => {
	addParticipantRow(undefined, { focus: true });
	clearActionStatus();
	render();
});

addTaskButton.addEventListener('click', () => {
	addTaskRow(undefined, { focus: true });
	clearActionStatus();
	render();
});

cancelRemoveTaskButton.addEventListener('click', () => {
	const removeButton = pendingRemoval?.trigger;
	pendingRemoval = null;
	removeTaskDialog.close();
	removeButton?.focus();
});

confirmRemoveTaskButton.addEventListener('click', () => {
	const removal = pendingRemoval;
	pendingRemoval = null;
	removeTaskDialog.close();
	removal?.confirm();
});

removeTaskDialog.addEventListener('cancel', (event) => {
	event.preventDefault();
	cancelRemoveTaskButton.click();
});

meetingInput.addEventListener('input', () => {
	clearActionStatus();
	render();
});

addTaskGroupButton.addEventListener('click', () => {
	addTaskGroup(undefined, true);
	clearActionStatus();
	render();
});

groupHoursInput.addEventListener('input', () => {
	clearActionStatus();
	render();
});

groupImportButton.addEventListener('click', importTaskGroups);
groupTaskForm.addEventListener('submit', (event) => event.preventDefault());
for (const input of [groupImportUrl, groupImportName]) {
	input.addEventListener('keydown', (event) => {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		importTaskGroups();
	});
}
groupImportUrl.addEventListener('input', () => {
	groupImportUrl.removeAttribute('aria-invalid');
	groupImportStatus.textContent = '';
});

shareButton.addEventListener('click', async () => {
	const url = currentShareUrl();
	if (!url) return;

	try {
		if (!navigator.clipboard || !window.isSecureContext) {
			throw new Error('Clipboard API är inte tillgängligt i den här miljön.');
		}
		await navigator.clipboard.writeText(url);
		shareStatus.textContent = 'Länken har kopierats till urklipp.';
	} catch {
		shareStatus.textContent = `Kunde inte kopiera automatiskt. Här är länken: ${url}`;
	}
});

pngButton.addEventListener('click', async () => {
	pngStatus.textContent = 'Skapar bild …';

	try {
		const blob = await capturePngBlob();

		if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
			try {
				await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
				pngStatus.textContent = 'Bilden har kopierats till urklipp.';
				return;
			} catch {
				// Clipboard image writes can be blocked; download the same PNG instead.
			}
		}

		downloadBlob(blob);
		pngStatus.textContent =
			'Din webbläsare stödjer inte att kopiera bilder till urklipp — filen laddades ner istället.';
	} catch {
		pngStatus.textContent = 'Något gick fel när bilden skulle skapas. Försök igen.';
	}
});

combinedButton.addEventListener('click', async () => {
	const url = currentShareUrl();
	if (!url) return;

	combinedStatus.textContent = 'Skapar bild …';

	let blob: Blob;
	try {
		blob = await capturePngBlob();
	} catch {
		combinedStatus.textContent = 'Något gick fel när bilden skulle skapas. Försök igen.';
		return;
	}

	try {
		if (!navigator.clipboard || typeof ClipboardItem === 'undefined' || !window.isSecureContext) {
			throw new Error('Clipboard API är inte tillgängligt i den här miljön.');
		}

		// A single text/html representation with an inline image plus a link lets
		// rich-text targets (Jira, Confluence, Docs, …) paste both in one go.
		const dataUrl = await blobToDataUrl(blob);
		const escapedUrl = escapeHtml(url);
		const html = `<img src="${dataUrl}" alt="PERT-resultat" /><p><a href="${escapedUrl}">${escapedUrl}</a></p>`;

		await navigator.clipboard.write([
			new ClipboardItem({
				'text/html': new Blob([html], { type: 'text/html' }),
				'text/plain': new Blob([url], { type: 'text/plain' }),
				'image/png': blob,
			}),
		]);
		combinedStatus.textContent = 'Bild och länk har kopierats. Klistra in i t.ex. Jira.';
	} catch {
		// Rich clipboard writes aren't supported everywhere — fall back to
		// downloading the image and copying just the link as plain text.
		downloadBlob(blob);
		try {
			if (!navigator.clipboard || !window.isSecureContext) throw new Error('no clipboard');
			await navigator.clipboard.writeText(url);
			combinedStatus.textContent =
				'Kunde inte kopiera bild och länk tillsammans. Länken kopierades till urklipp och bilden laddades ner separat.';
		} catch {
			combinedStatus.textContent = `Kunde inte kopiera automatiskt. Bilden laddades ner. Här är länken: ${url}`;
		}
	}
});

initFromUrl();
setMode(mode);
