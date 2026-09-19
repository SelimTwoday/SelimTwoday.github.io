import { buildDiff, getTextStats, type DiffRow, type TextStats } from '../lib/diffchecker';

const leftInput = document.getElementById('diff-left-input') as HTMLTextAreaElement;
const rightInput = document.getElementById('diff-right-input') as HTMLTextAreaElement;
const diffRowsEl = document.getElementById('diff-rows') as HTMLDivElement;
const diffEmptyEl = document.getElementById('diff-empty') as HTMLParagraphElement;
const diffSummaryEl = document.getElementById('diff-summary') as HTMLParagraphElement;

const statsMap = {
	left: {
		words: document.getElementById('left-words') as HTMLElement,
		characters: document.getElementById('left-characters') as HTMLElement,
		charactersNoSpaces: document.getElementById('left-characters-no-spaces') as HTMLElement,
		sentences: document.getElementById('left-sentences') as HTMLElement,
		paragraphs: document.getElementById('left-paragraphs') as HTMLElement,
	},
	right: {
		words: document.getElementById('right-words') as HTMLElement,
		characters: document.getElementById('right-characters') as HTMLElement,
		charactersNoSpaces: document.getElementById('right-characters-no-spaces') as HTMLElement,
		sentences: document.getElementById('right-sentences') as HTMLElement,
		paragraphs: document.getElementById('right-paragraphs') as HTMLElement,
	},
};

function updateStats(side: keyof typeof statsMap, stats: TextStats): void {
	statsMap[side].words.textContent = String(stats.words);
	statsMap[side].characters.textContent = String(stats.characters);
	statsMap[side].charactersNoSpaces.textContent = String(stats.charactersNoSpaces);
	statsMap[side].sentences.textContent = String(stats.sentences);
	statsMap[side].paragraphs.textContent = String(stats.paragraphs);
}

function renderSegments(container: HTMLElement, segments: DiffRow['leftSegments']): void {
	container.replaceChildren();

	if (segments.length === 0) {
		container.textContent = '—';
		container.classList.add('diff-row__text--empty');
		return;
	}

	container.classList.remove('diff-row__text--empty');

	for (const segment of segments) {
		const span = document.createElement('span');
		span.textContent = segment.text;
		span.className = `diff-segment diff-segment--${segment.type}`;
		container.append(span);
	}
}

function createDiffColumn(
	lineNumber: number | null,
	segments: DiffRow['leftSegments'],
	marker: '' | '-' | '+',
	side: 'left' | 'right',
): HTMLDivElement {
	const column = document.createElement('div');
	column.className = `diff-row__column diff-row__column--${side}`;

	const line = document.createElement('div');
	line.className = 'diff-row__line';
	line.textContent = lineNumber == null ? '·' : String(lineNumber);
	line.setAttribute('aria-hidden', 'true');

	const status = document.createElement('div');
	status.className = 'diff-row__marker';
	status.textContent = marker;
	status.setAttribute('aria-hidden', 'true');

	const text = document.createElement('pre');
	text.className = 'diff-row__text';
	renderSegments(text, segments);

	column.append(line, status, text);
	return column;
}

function getRowLabel(row: DiffRow): string {
	if (row.status === 'add') return `Tillagd rad ${row.rightLineNumber}`;
	if (row.status === 'remove') return `Borttagen rad ${row.leftLineNumber}`;
	if (row.status === 'change') {
		return `Ändrad rad ${row.leftLineNumber} till rad ${row.rightLineNumber}`;
	}

	return `Oförändrad rad ${row.leftLineNumber}`;
}

function renderDiff(): void {
	const leftText = leftInput.value;
	const rightText = rightInput.value;

	updateStats('left', getTextStats(leftText));
	updateStats('right', getTextStats(rightText));

	if (!leftText && !rightText) {
		diffRowsEl.replaceChildren();
		diffEmptyEl.hidden = false;
		diffSummaryEl.textContent = 'Klistra in två texter för att jämföra dem rad för rad.';
		return;
	}

	const diff = buildDiff(leftText, rightText);
	diffRowsEl.replaceChildren();
	diffEmptyEl.hidden = diff.rows.length > 0;

	const fragment = document.createDocumentFragment();

	for (const row of diff.rows) {
		const article = document.createElement('article');
		article.className = `diff-row diff-row--${row.status}`;
		article.setAttribute('aria-label', getRowLabel(row));
		article.append(
			createDiffColumn(
				row.leftLineNumber,
				row.leftSegments,
				row.status === 'remove' || row.status === 'change' ? '-' : '',
				'left',
			),
			createDiffColumn(
				row.rightLineNumber,
				row.rightSegments,
				row.status === 'add' || row.status === 'change' ? '+' : '',
				'right',
			),
		);
		fragment.append(article);
	}

	diffRowsEl.append(fragment);

	if (diff.summary.added === 0 && diff.summary.removed === 0 && diff.summary.changed === 0) {
		diffSummaryEl.textContent = 'Texterna är identiska.';
		return;
	}

	diffSummaryEl.textContent =
		`${diff.summary.changed} ändrade rader, ` +
		`${diff.summary.added} tillagda rader, ` +
		`${diff.summary.removed} borttagna rader.`;
}

leftInput.addEventListener('input', renderDiff);
rightInput.addEventListener('input', renderDiff);

renderDiff();
