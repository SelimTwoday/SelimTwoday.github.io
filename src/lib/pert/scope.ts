import type { ScopeGap, TaskGroupInput } from './types';

export function normalizeTitle(title: string): string {
	return title
		.normalize('NFC')
		.trim()
		.replace(/\s+/g, ' ')
		.toLocaleLowerCase('sv-SE');
}

/**
 * For each person, finds the task titles that at least one other person has
 * but this person lacks. Only people with gaps are returned. Titles are
 * compared normalized; the display title comes from its first occurrence.
 */
export function findScopeGaps(groups: TaskGroupInput[]): ScopeGap[] {
	const titleSets = groups.map((group) => {
		const titles = new Map<string, string>();
		for (const task of group.tasks) {
			const key = normalizeTitle(task.title);
			if (key && !titles.has(key)) titles.set(key, task.title.trim().replace(/\s+/g, ' '));
		}
		return titles;
	});

	const displayTitles = new Map<string, string>();
	for (const titles of titleSets) {
		for (const [key, title] of titles) {
			if (!displayTitles.has(key)) displayTitles.set(key, title);
		}
	}

	const gaps: ScopeGap[] = [];
	titleSets.forEach((titles, groupIndex) => {
		const missingTitles: string[] = [];
		for (const [key, title] of displayTitles) {
			if (!titles.has(key)) missingTitles.push(title);
		}
		if (missingTitles.length > 0) gaps.push({ groupIndex, missingTitles });
	});
	return gaps;
}
