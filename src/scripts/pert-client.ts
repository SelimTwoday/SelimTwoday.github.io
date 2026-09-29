import { toBlob } from 'html-to-image';
import {
	buildPertShareUrl,
	buildTaskPertShareUrl,
	DEFAULT_HOURS_PER_DAY,
	formatSwedishNumber,
	parsePertSearchParams,
	validatePertForm,
	validateTaskPertForm,
	type FieldError,
	type ParticipantRowInput,
	type PertResult,
	type PertSettingsInput,
	type TaskPertResult,
	type TaskRowInput,
} from '../lib/pert';

type PertMode = 'participants' | 'tasks';

interface RowRefs {
	li: HTMLLIElement;
	titleInput?: HTMLInputElement;
	oInput: HTMLInputElement;
	mInput: HTMLInputElement;
	pInput: HTMLInputElement;
	errorEl: HTMLParagraphElement;
	removeButton: HTMLButtonElement;
}

const modeInputs = Array.from(
	document.querySelectorAll<HTMLInputElement>('input[name="pert-mode"]'),
);
const participantForm = document.getElementById('participant-form') as HTMLFormElement;
const taskForm = document.getElementById('task-form') as HTMLFormElement;
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

const resultPanel = document.getElementById('pert-result-panel') as HTMLElement;
const resultEmptyEl = document.getElementById('pert-result-empty') as HTMLElement;
const resultEmptyCopy = document.getElementById('result-empty-copy') as HTMLParagraphElement;
const participantResultEl = document.getElementById('participant-result') as HTMLElement;
const taskResultEl = document.getElementById('task-result') as HTMLElement;
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

let mode: PertMode = 'participants';

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
	return mode === 'participants'
		? getRows(participantRowsList)
		: getRows(taskRowsList, true);
}

function renumberRows(list: HTMLUListElement, label: string): void {
	getRows(list, list === taskRowsList).forEach((row, index) => {
		const title = row.li.querySelector('.participant-row__title');
		if (title) title.textContent = `${label} ${index + 1}`;
	});
}

function updateRemoveButtons(list: HTMLUListElement): void {
	const rows = getRows(list, list === taskRowsList);
	for (const row of rows) row.removeButton.disabled = rows.length <= 1;
}

function clearActionStatus(): void {
	shareStatus.textContent = '';
	pngStatus.textContent = '';
	combinedStatus.textContent = '';
}

function bindRow(li: HTMLLIElement, list: HTMLUListElement, label: string): HTMLLIElement {
	const inputs = Array.from(li.querySelectorAll<HTMLInputElement>('input'));
	for (const input of inputs) {
		input.addEventListener('input', () => {
			clearActionStatus();
			render();
		});
	}

	const removeButton = li.querySelector('.participant-row__remove') as HTMLButtonElement;
	removeButton.addEventListener('click', () => {
		const rows = getRows(list, list === taskRowsList);
		const removedIndex = rows.findIndex((row) => row.li === li);
		li.remove();
		if (list === participantRowsList) syncParticipantMeta();
		renumberRows(list, label);
		updateRemoveButtons(list);
		clearActionStatus();
		render();

		const remainingRows = getRows(list, list === taskRowsList);
		const focusRow = remainingRows[removedIndex] ?? remainingRows[removedIndex - 1];
		(focusRow ? (focusRow.titleInput ?? focusRow.oInput) : list === participantRowsList ? addParticipantButton : addTaskButton).focus();
	});

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

function addTaskRow(values?: TaskRowInput): void {
	const fragment = taskRowTemplate.content.cloneNode(true) as DocumentFragment;
	const li = fragment.querySelector('li.participant-row') as HTMLLIElement;
	const row = getRowsFromElement(li, true);
	if (values && row.titleInput) {
		row.titleInput.value = values.title;
		row.oInput.value = values.o;
		row.mInput.value = values.m;
		row.pInput.value = values.p;
	}
	taskRowsList.appendChild(bindRow(li, taskRowsList, 'Deluppgift'));
	renumberRows(taskRowsList, 'Deluppgift');
	updateRemoveButtons(taskRowsList);
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

function renderTaskResult(result: TaskPertResult): void {
	taskTotalOEl.textContent = `${formatSwedishNumber(result.totalO)} h`;
	taskTotalMEl.textContent = `${formatSwedishNumber(result.totalM)} h`;
	taskTotalPEl.textContent = `${formatSwedishNumber(result.totalP)} h`;
	taskExpectedHoursEl.textContent = `${formatSwedishNumber(result.expectedHours)} timmar`;
	taskExpectedDaysEl.textContent = `≈ ${formatSwedishNumber(result.workdays)} arbetsdagar`;
	taskStandardDeviationEl.textContent = `${formatSwedishNumber(result.standardDeviation, 2)} timmar`;

	confidenceListEl.replaceChildren(
		...result.confidenceIntervals.map((interval) => {
			const row = document.createElement('div');
			row.className = 'confidence-row';

			const level = document.createElement('span');
			level.className = 'confidence-row__level';
			level.textContent = `±${interval.standardDeviations} SD (${interval.confidence})`;

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

	taskBreakdownEl.replaceChildren(
		...result.tasks.map((task) => {
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

	taskNoteEl.textContent = `${result.tasks.length} deluppgifter. Arbetsdag = ${formatSwedishNumber(result.hoursPerDay, 0)} timmar.`;
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
	resultEmptyCopy.textContent =
		mode === 'participants'
			? 'Fyll i minst en deltagare med giltiga O-, M- och P-värden så visas resultatet här.'
			: 'Fyll i minst en namngiven deluppgift med giltiga O-, M- och P-värden så visas resultatet här.';
	clearActionStatus();
	render();
}

function currentShareUrl(): string | null {
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

	const selectedMode = modeInputs.find((input) => input.value === parsed.mode);
	if (selectedMode) selectedMode.checked = true;
	mode = parsed.mode;
	participantForm.hidden = mode !== 'participants';
	taskForm.hidden = mode !== 'tasks';
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
	addTaskRow();
	clearActionStatus();
	render();
});

meetingInput.addEventListener('input', () => {
	clearActionStatus();
	render();
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
