import { toBlob } from 'html-to-image';
import {
	buildPertShareUrl,
	DEFAULT_HOURS_PER_DAY,
	formatSwedishNumber,
	parsePertSearchParams,
	validatePertForm,
	type FieldError,
	type ParticipantRowInput,
	type PertResult,
	type PertSettingsInput,
} from '../lib/pert';

interface RowRefs {
	li: HTMLLIElement;
	oInput: HTMLInputElement;
	mInput: HTMLInputElement;
	pInput: HTMLInputElement;
	errorEl: HTMLParagraphElement;
	removeButton: HTMLButtonElement;
}

const rowsList = document.getElementById('participant-rows') as HTMLUListElement;
const rowTemplate = document.getElementById('row-template') as HTMLTemplateElement;
const addRowButton = document.getElementById('add-row-button') as HTMLButtonElement;
const participantCountEl = document.getElementById('participant-count') as HTMLElement;
const meetingInput = document.getElementById('meeting-hours-input') as HTMLInputElement;
const meetingErrorEl = document.getElementById('meeting-hours-error') as HTMLParagraphElement;
const globalErrorsEl = document.getElementById('pert-errors') as HTMLDivElement;

const resultPanel = document.getElementById('pert-result-panel') as HTMLElement;
const resultEmptyEl = document.getElementById('pert-result-empty') as HTMLElement;
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

const shareButton = document.getElementById('share-button') as HTMLButtonElement;
const pngButton = document.getElementById('png-button') as HTMLButtonElement;
const shareStatus = document.getElementById('share-status') as HTMLParagraphElement;
const pngStatus = document.getElementById('png-status') as HTMLParagraphElement;

function getRows(): RowRefs[] {
	return Array.from(rowsList.querySelectorAll<HTMLLIElement>('li.participant-row')).map((li) => ({
		li,
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
	const rows = getRows();
	participantCountEl.textContent = formatParticipantCount(rows.length);
	rows.forEach((row, index) => {
		row.removeButton.setAttribute('aria-label', `Ta bort deltagare ${index + 1}`);
	});
}

function updateRemoveButtons(): void {
	const rows = getRows();
	const disable = rows.length <= 1;
	rows.forEach((row) => {
		row.removeButton.disabled = disable;
	});
}

function clearActionStatus(): void {
	shareStatus.textContent = '';
	pngStatus.textContent = '';
}

function createRow(values?: ParticipantRowInput): HTMLLIElement {
	const fragment = rowTemplate.content.cloneNode(true) as DocumentFragment;
	const li = fragment.querySelector('li.participant-row') as HTMLLIElement;

	const oInput = li.querySelector('.field-o') as HTMLInputElement;
	const mInput = li.querySelector('.field-m') as HTMLInputElement;
	const pInput = li.querySelector('.field-p') as HTMLInputElement;

	if (values) {
		oInput.value = values.o;
		mInput.value = values.m;
		pInput.value = values.p;
	}

	for (const input of [oInput, mInput, pInput]) {
		input.addEventListener('input', () => {
			clearActionStatus();
			render();
		});
	}

	const removeButton = li.querySelector('.participant-row__remove') as HTMLButtonElement;
	removeButton.addEventListener('click', () => {
		const rows = getRows();
		const removedIndex = rows.findIndex((row) => row.li === li);
		li.remove();
		syncParticipantMeta();
		updateRemoveButtons();
		clearActionStatus();
		render();

		const remainingRows = getRows();
		const focusRow = remainingRows[removedIndex] ?? remainingRows[removedIndex - 1];
		(focusRow ? focusRow.oInput : addRowButton).focus();
	});

	return li;
}

function addRow(values?: ParticipantRowInput, options?: { focus?: boolean }): void {
	const li = createRow(values);
	rowsList.appendChild(li);
	syncParticipantMeta();
	updateRemoveButtons();

	if (options?.focus) {
		(li.querySelector('.field-o') as HTMLInputElement).focus();
	}
}

function collectRowInputs(rows: RowRefs[]): ParticipantRowInput[] {
	return rows.map((row) => ({
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
		const rowFieldMatch = /^row-(\d+)-(o|m|p)$/.exec(error.field);
		const rowOrderMatch = /^row-(\d+)-order$/.exec(error.field);

		if (rowFieldMatch) {
			const row = rows[Number(rowFieldMatch[1])];
			if (!row) continue;
			const key = rowFieldMatch[2];
			const input = key === 'o' ? row.oInput : key === 'm' ? row.mInput : row.pInput;
			input.setAttribute('aria-invalid', 'true');
			if (!row.errorEl.textContent) row.errorEl.textContent = error.message;
		} else if (rowOrderMatch) {
			const row = rows[Number(rowOrderMatch[1])];
			if (!row) continue;
			row.oInput.setAttribute('aria-invalid', 'true');
			row.mInput.setAttribute('aria-invalid', 'true');
			row.pInput.setAttribute('aria-invalid', 'true');
			row.errorEl.textContent = error.message;
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

function renderResult(result: PertResult): void {
	const pertDays = result.pertHours / result.hoursPerDay;
	const meetingDays = result.meetingTotalHours / result.hoursPerDay;

	avgOEl.textContent = `${formatSwedishNumber(result.averageO)} h`;
	avgMEl.textContent = `${formatSwedishNumber(result.averageM)} h`;
	avgPEl.textContent = `${formatSwedishNumber(result.averageP)} h`;

	formulaEl.textContent = `PERT = (${formatSwedishNumber(result.averageO)} + 4 × ${formatSwedishNumber(result.averageM)} + ${formatSwedishNumber(result.averageP)}) / 6`;

	pertHoursEl.textContent = `${formatSwedishNumber(result.pertHours)} timmar`;
	pertDaysEl.textContent = `≈ ${formatSwedishNumber(pertDays)} arbetsdagar`;
	pertConfidenceEl.textContent = `68% sannolikt ${formatSwedishNumber(result.pertLowHours)}–${formatSwedishNumber(result.pertHighHours)} timmar`;

	meetingHoursEl.textContent = `${formatSwedishNumber(result.meetingTotalHours)} timmar`;
	meetingNoteEl.textContent = `${result.peopleCount} personer × ${formatSwedishNumber(result.meetingHoursPerPerson)} h ≈ ${formatSwedishNumber(meetingDays)} arbetsdagar`;

	finalHoursEl.textContent = `${formatSwedishNumber(result.finalHours)} timmar`;
	finalDaysEl.textContent = `≈ ${formatSwedishNumber(result.workdays)} arbetsdagar`;

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

function render(): void {
	const rows = getRows();
	clearFieldStates(rows);

	const validation = validatePertForm(collectRowInputs(rows), collectSettingsInput());

	if (!validation.valid) {
		applyErrors(validation.errors, rows);
		uncertaintyWarningEl.hidden = true;
		disagreementWarningEl.hidden = true;
		resultPanel.hidden = true;
		resultEmptyEl.hidden = false;
		shareButton.disabled = true;
		pngButton.disabled = true;
		return;
	}

	renderResult(validation.result);
	resultPanel.hidden = false;
	resultEmptyEl.hidden = true;
	shareButton.disabled = false;
	pngButton.disabled = false;

	// Keep the address bar in sync so refreshing or bookmarking reproduces
	// the exact same result without requiring an explicit share action.
	const url = buildPertShareUrl(
		window.location.origin + window.location.pathname,
		validation.participants,
		validation.settings,
	);
	window.history.replaceState(null, '', url);
}

function initFromUrl(): void {
	const parsed = parsePertSearchParams(window.location.search);
	meetingInput.value = parsed.meetingHoursPerPerson;

	if (parsed.rows.length > 0) {
		for (const row of parsed.rows) addRow(row);
	} else {
		addRow();
	}
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

addRowButton.addEventListener('click', () => {
	addRow(undefined, { focus: true });
	clearActionStatus();
	render();
});

meetingInput.addEventListener('input', () => {
	clearActionStatus();
	render();
});

shareButton.addEventListener('click', async () => {
	const rows = getRows();
	const validation = validatePertForm(collectRowInputs(rows), collectSettingsInput());
	if (!validation.valid) return;

	const url = buildPertShareUrl(
		window.location.origin + window.location.pathname,
		validation.participants,
		validation.settings,
	);

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

	// The result panel's box-shadow can bleed into the capture at the
	// rounded corners, so it's temporarily removed while the image is
	// generated and restored afterwards either way. 
	const previousBoxShadow = resultPanel.style.boxShadow;
	resultPanel.style.boxShadow = 'none';
	await new Promise((resolve) => requestAnimationFrame(resolve));

	try {
		const blob = await toBlob(resultPanel, { pixelRatio: 2 });
		if (!blob) throw new Error('Kunde inte generera bilden.');

		if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
			try {
				await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
				pngStatus.textContent = 'Bilden har kopierats till urklipp.';
				return;
			} catch {
				// Clipboard image writes can be blocked by permissions/browser
				// support — fall back to a direct download of the same PNG.
			}
		}

		downloadBlob(blob);
		pngStatus.textContent =
			'Din webbläsare stödjer inte att kopiera bilder till urklipp — filen laddades ner istället.';
	} catch {
		pngStatus.textContent = 'Något gick fel när bilden skulle skapas. Försök igen.';
	} finally {
		resultPanel.style.boxShadow = previousBoxShadow;
	}
});

initFromUrl();
render();
