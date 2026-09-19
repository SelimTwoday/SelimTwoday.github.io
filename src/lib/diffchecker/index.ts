import { diffChars } from 'diff';

export interface TextStats {
	words: number;
	characters: number;
	charactersNoSpaces: number;
	sentences: number;
	paragraphs: number;
	lines: number;
}

export interface DiffSegment {
	text: string;
	type: 'equal' | 'remove' | 'add';
}

export interface DiffRow {
	status: 'equal' | 'remove' | 'add' | 'change';
	leftLineNumber: number | null;
	rightLineNumber: number | null;
	leftText: string;
	rightText: string;
	leftSegments: DiffSegment[];
	rightSegments: DiffSegment[];
}

export interface DiffResult {
	rows: DiffRow[];
	summary: {
		equal: number;
		added: number;
		removed: number;
		changed: number;
	};
}

const MAX_SEQUENCE_CELLS = 250_000;
const MAX_INLINE_EDIT_LENGTH = 5_000;
const FALLBACK_LOOKAHEAD = 64;

export function getTextStats(text: string): TextStats {
	const normalized = text.replace(/\r\n/g, '\n');
	const trimmed = normalized.trim();
	const words = trimmed ? trimmed.split(/\s+/).length : 0;
	const paragraphs = trimmed ? trimmed.split(/\n\s*\n/).length : 0;
	const sentences = (trimmed.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? []).length;
	const lines = normalized === '' ? 0 : normalized.split('\n').length;

	return {
		words,
		characters: text.length,
		charactersNoSpaces: text.replace(/\s/g, '').length,
		sentences,
		paragraphs,
		lines,
	};
}

export function buildDiff(leftText: string, rightText: string): DiffResult {
	const leftLines = splitLines(leftText);
	const rightLines = splitLines(rightText);
	const operations = diffSequence(leftLines, rightLines);
	const rows: DiffRow[] = [];
	const summary = { equal: 0, added: 0, removed: 0, changed: 0 };

	let leftLineNumber = 1;
	let rightLineNumber = 1;

	for (let index = 0; index < operations.length; index += 1) {
		const operation = operations[index];

		if (operation.type === 'equal') {
			rows.push({
				status: 'equal',
				leftLineNumber,
				rightLineNumber,
				leftText: operation.value,
				rightText: operation.value,
				leftSegments: [{ text: operation.value, type: 'equal' }],
				rightSegments: [{ text: operation.value, type: 'equal' }],
			});
			summary.equal += 1;
			leftLineNumber += 1;
			rightLineNumber += 1;
			continue;
		}

		const removedBlock: string[] = [];
		const addedBlock: string[] = [];

		while (operations[index] && operations[index].type !== 'equal') {
			if (operations[index].type === 'remove') {
				removedBlock.push(operations[index].value);
			} else {
				addedBlock.push(operations[index].value);
			}
			index += 1;
		}
		index -= 1;

		const pairedLength = Math.max(removedBlock.length, addedBlock.length);

		for (let blockIndex = 0; blockIndex < pairedLength; blockIndex += 1) {
			const leftLine = removedBlock[blockIndex];
			const rightLine = addedBlock[blockIndex];

			if (leftLine != null && rightLine != null) {
				const highlighted = highlightDiff(leftLine, rightLine);
				rows.push({
					status: 'change',
					leftLineNumber,
					rightLineNumber,
					leftText: leftLine,
					rightText: rightLine,
					leftSegments: highlighted.left,
					rightSegments: highlighted.right,
				});
				summary.changed += 1;
				leftLineNumber += 1;
				rightLineNumber += 1;
				continue;
			}

			if (leftLine != null) {
				rows.push({
					status: 'remove',
					leftLineNumber,
					rightLineNumber: null,
					leftText: leftLine,
					rightText: '',
					leftSegments: [{ text: leftLine, type: 'remove' }],
					rightSegments: [],
				});
				summary.removed += 1;
				leftLineNumber += 1;
				continue;
			}

			if (rightLine != null) {
				rows.push({
					status: 'add',
					leftLineNumber: null,
					rightLineNumber,
					leftText: '',
					rightText: rightLine,
					leftSegments: [],
					rightSegments: [{ text: rightLine, type: 'add' }],
				});
				summary.added += 1;
				rightLineNumber += 1;
			}
		}
	}

	return { rows, summary };
}

function splitLines(text: string): string[] {
	if (text === '') return [];
	return text.replace(/\r\n/g, '\n').split('\n');
}

function highlightDiff(leftText: string, rightText: string): { left: DiffSegment[]; right: DiffSegment[] } {
	const left: DiffSegment[] = [];
	const right: DiffSegment[] = [];
	const changes = diffChars(leftText, rightText, { maxEditLength: MAX_INLINE_EDIT_LENGTH });

	if (!changes) {
		return {
			left: [{ text: leftText, type: 'remove' }],
			right: [{ text: rightText, type: 'add' }],
		};
	}

	for (const change of changes) {
		if (change.removed) {
			left.push({ text: change.value, type: 'remove' });
			continue;
		}

		if (change.added) {
			right.push({ text: change.value, type: 'add' });
			continue;
		}

		left.push({ text: change.value, type: 'equal' });
		right.push({ text: change.value, type: 'equal' });
	}

	return { left: mergeAdjacentSegments(left), right: mergeAdjacentSegments(right) };
}

function mergeAdjacentSegments(segments: DiffSegment[]): DiffSegment[] {
	return segments.reduce<DiffSegment[]>((result, segment) => {
		const previous = result.at(-1);
		if (previous && previous.type === segment.type) {
			previous.text += segment.text;
			return result;
		}

		result.push({ ...segment });
		return result;
	}, []);
}

function diffSequence(left: string[], right: string[], maxCells = MAX_SEQUENCE_CELLS) {
	if ((left.length + 1) * (right.length + 1) > maxCells) {
		return buildLinearFallbackDiff(left, right);
	}

	const table = Array.from({ length: left.length + 1 }, () => Array<number>(right.length + 1).fill(0));

	for (let leftIndex = left.length - 1; leftIndex >= 0; leftIndex -= 1) {
		for (let rightIndex = right.length - 1; rightIndex >= 0; rightIndex -= 1) {
			if (left[leftIndex] === right[rightIndex]) {
				table[leftIndex][rightIndex] = table[leftIndex + 1][rightIndex + 1] + 1;
			} else {
				table[leftIndex][rightIndex] = Math.max(
					table[leftIndex + 1][rightIndex],
					table[leftIndex][rightIndex + 1],
				);
			}
		}
	}

	const result: Array<{ type: 'equal' | 'remove' | 'add'; value: string }> = [];
	let leftIndex = 0;
	let rightIndex = 0;

	while (leftIndex < left.length && rightIndex < right.length) {
		if (left[leftIndex] === right[rightIndex]) {
			result.push({ type: 'equal', value: left[leftIndex] });
			leftIndex += 1;
			rightIndex += 1;
		} else if (table[leftIndex + 1][rightIndex] >= table[leftIndex][rightIndex + 1]) {
			result.push({ type: 'remove', value: left[leftIndex] });
			leftIndex += 1;
		} else {
			result.push({ type: 'add', value: right[rightIndex] });
			rightIndex += 1;
		}
	}

	while (leftIndex < left.length) {
		result.push({ type: 'remove', value: left[leftIndex] });
		leftIndex += 1;
	}

	while (rightIndex < right.length) {
		result.push({ type: 'add', value: right[rightIndex] });
		rightIndex += 1;
	}

	return result;
}

function buildLinearFallbackDiff(left: string[], right: string[]) {
	const result: Array<{ type: 'equal' | 'remove' | 'add'; value: string }> = [];
	let leftIndex = 0;
	let rightIndex = 0;

	while (leftIndex < left.length && rightIndex < right.length) {
		if (left[leftIndex] === right[rightIndex]) {
			result.push({ type: 'equal', value: left[leftIndex] });
			leftIndex += 1;
			rightIndex += 1;
			continue;
		}

		const leftMatchOffset = findLookaheadOffset(left, leftIndex, right[rightIndex]);
		const rightMatchOffset = findLookaheadOffset(right, rightIndex, left[leftIndex]);

		if (
			rightMatchOffset !== -1 &&
			(leftMatchOffset === -1 || rightMatchOffset <= leftMatchOffset)
		) {
			for (let offset = 0; offset < rightMatchOffset; offset += 1) {
				result.push({ type: 'add', value: right[rightIndex] });
				rightIndex += 1;
			}
			continue;
		}

		if (leftMatchOffset !== -1) {
			for (let offset = 0; offset < leftMatchOffset; offset += 1) {
				result.push({ type: 'remove', value: left[leftIndex] });
				leftIndex += 1;
			}
			continue;
		}

		result.push({ type: 'remove', value: left[leftIndex] });
		result.push({ type: 'add', value: right[rightIndex] });
		leftIndex += 1;
		rightIndex += 1;
	}

	while (leftIndex < left.length) {
		result.push({ type: 'remove', value: left[leftIndex] });
		leftIndex += 1;
	}

	while (rightIndex < right.length) {
		result.push({ type: 'add', value: right[rightIndex] });
		rightIndex += 1;
	}

	return result;
}

function findLookaheadOffset(values: string[], startIndex: number, target: string): number {
	const maxIndex = Math.min(values.length, startIndex + FALLBACK_LOOKAHEAD + 1);

	for (let index = startIndex + 1; index < maxIndex; index += 1) {
		if (values[index] === target) {
			return index - startIndex;
		}
	}

	return -1;
}
