import { formatSwedishNumber, parseSwedishNumber } from '../../../lib/pert/format';
import { DEFAULT_MEETING_HOURS_PER_PERSON } from '../../../lib/pert/types';
import { query, setText } from './dom';
import { bindInlineNumber } from './inline-number';

export interface MeetingState {
	enabled: boolean;
	hours: string;
}

export interface MeetingValues {
	work: number;
	meeting: number;
	/** Attendees, shown when the count is derived from the form. */
	people: number;
}

export interface MeetingControl {
	isEnabled: () => boolean;
	hoursText: () => string;
	/** True when the meeting is off or its fields hold usable numbers. */
	isValid: () => boolean;
	/** Numbers for the calculation, or null when the meeting is off or invalid. */
	parsed: () => { hoursPerPerson: number } | null;
	set: (state: Partial<MeetingState>) => void;
	paint: (values: MeetingValues) => void;
}

/**
 * The "Estimeringsmöte" part of a result panel: the work/meeting split, the
 * hours-per-person field and.
 * Optional meetings start hidden behind an "add" button.
 */
export function createMeetingControl(root: HTMLElement, onChange: () => void): MeetingControl {
	const meetingRoot = query<HTMLElement>(root, '[data-meeting-root]');
	const block = query<HTMLElement>(meetingRoot, '[data-meeting-block]');
	const addButton = meetingRoot.querySelector<HTMLButtonElement>('[data-meeting-add]');
	const removeButton = meetingRoot.querySelector<HTMLButtonElement>('[data-meeting-remove]');
	const hoursInput = query<HTMLInputElement>(meetingRoot, '[data-meeting]');
	const barWork = query<HTMLElement>(meetingRoot, '[data-bar-work]');
	const barMeeting = query<HTMLElement>(meetingRoot, '[data-bar-meeting]');
	const optional = addButton !== null;
	let enabled = !optional;

	const hours = bindInlineNumber(hoursInput, { allowZero: true, onInput: onChange });
	hours.setValue(String(DEFAULT_MEETING_HOURS_PER_PERSON));

	const hoursValid = (): boolean => {
		const value = parseSwedishNumber(hoursInput.value);
		return value !== null && value >= 0;
	};

	function show(next: boolean): void {
		enabled = next;
		if (!optional) return;
		block.hidden = !next;
		if (addButton) addButton.hidden = next;
	}

	addButton?.addEventListener('click', () => {
		show(true);
		hoursInput.focus();
		onChange();
	});
	removeButton?.addEventListener('click', () => {
		show(false);
		addButton?.focus();
		onChange();
	});

	return {
		isEnabled: () => enabled,
		hoursText: () => hoursInput.value,
		isValid: () => !enabled || hoursValid(),
		parsed(): { hoursPerPerson: number } | null {
			if (!enabled || !hoursValid()) return null;
			return { hoursPerPerson: parseSwedishNumber(hoursInput.value) as number };
		},
		set(state: Partial<MeetingState>): void {
			if (state.hours !== undefined) hours.setValue(state.hours);
			if (state.enabled !== undefined) show(state.enabled);
		},
		paint({ work, meeting, people }: MeetingValues): void {
			const format = (value: number): string => formatSwedishNumber(value, 1);
			setText(meetingRoot, 'work', format(work));
			setText(meetingRoot, 'meetTotal', format(meeting));
			const derived = meetingRoot.querySelector<HTMLElement>('[data-out="people"]');
			if (derived) derived.textContent = String(people);
			const total = work + meeting;
			const workShare = total > 0 ? (work / total) * 100 : 100;
			barWork.style.width = `${workShare.toFixed(2)}%`;
			barMeeting.style.width = `${(100 - workShare).toFixed(2)}%`;
		},
	};
}
