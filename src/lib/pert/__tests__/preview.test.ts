import { describe, expect, it } from 'vitest';
import { calculateTaskPert } from '../calculate';
import { previewGroupPert, previewParticipantPert, previewTaskPert } from '../validate';

const task = (title: string, o: string, m: string, p: string) => ({ title, o, m, p });

describe('previewTaskPert', () => {
	it('is complete and equals the full result for a valid form', () => {
		const preview = previewTaskPert([task('A', '4', '6', '10'), task('B', '8', '10', '16')], '8');
		expect(preview.complete).toBe(true);
		expect(preview.excludedRows).toBe(0);
		expect(preview.hasErrors).toBe(false);
		expect(preview.result).toEqual(calculateTaskPert([
			{ title: 'A', o: 4, m: 6, p: 10 },
			{ title: 'B', o: 8, m: 10, p: 16 },
		], 8));
	});

	it('counts only usable rows and reports the rest', () => {
		const preview = previewTaskPert([task('A', '4', '6', '10'), task('B', '', '', ''), task('C', '9', '5', '1')], '8');
		expect(preview.complete).toBe(false);
		expect(preview.excludedRows).toBe(2);
		expect(preview.hasErrors).toBe(true);
		expect(preview.result?.tasks).toHaveLength(1);
	});

	it('has no result when no row is usable', () => {
		const preview = previewTaskPert([task('A', '', '', '')], '8');
		expect(preview.result).toBeNull();
		expect(preview.excludedRows).toBe(1);
		expect(preview.hasErrors).toBe(false);
	});

	it('is incomplete when only the workday setting is invalid', () => {
		const preview = previewTaskPert([task('A', '4', '6', '10')], '0');
		expect(preview.complete).toBe(false);
		expect(preview.result?.hoursPerDay).toBe(8);
	});
});

describe('previewGroupPert', () => {
	const complete = [
		{ name: 'Simon', tasks: [task('A', '4', '6', '10')] },
		{ name: 'Anna', tasks: [task('A', '5', '7', '12')] },
	];

	it('is complete for a valid form', () => {
		const preview = previewGroupPert(complete, '8');
		expect(preview.complete).toBe(true);
		expect(preview.result?.groups).toHaveLength(2);
	});

	it('does not count a person without a name, but reports their rows', () => {
		const preview = previewGroupPert([...complete, { name: ' ', tasks: [task('A', '1', '2', '3')] }], '8');
		expect(preview.complete).toBe(false);
		expect(preview.result?.groups).toHaveLength(2);
		expect(preview.excludedRows).toBe(1);
	});

	it('does not count a person without a usable row', () => {
		const preview = previewGroupPert([...complete, { name: 'Bo', tasks: [task('A', '', '', '')] }], '8');
		expect(preview.result?.groups.map((group) => group.name)).toEqual(['Simon', 'Anna']);
		expect(preview.complete).toBe(false);
	});

	it('has no result when nobody counts', () => {
		expect(previewGroupPert([{ name: '', tasks: [task('A', '1', '2', '3')] }], '8').result).toBeNull();
	});
});

describe('previewParticipantPert', () => {
	const settings = { meetingHoursPerPerson: '1', hoursPerDay: '8' };

	it('is complete for valid rows and previews partial ones', () => {
		expect(previewParticipantPert([{ o: '4', m: '5', p: '6' }], settings).complete).toBe(true);
		const partial = previewParticipantPert([{ o: '4', m: '5', p: '6' }, { o: '1', m: '', p: '' }], settings);
		expect(partial.complete).toBe(false);
		expect(partial.excludedRows).toBe(1);
		expect(partial.result?.peopleCount).toBe(1);
	});
});
