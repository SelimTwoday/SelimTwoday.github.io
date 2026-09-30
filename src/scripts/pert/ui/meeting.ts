import { formatSwedishNumber, parseSwedishNumber } from '../../../lib/pert/format';
import { DEFAULT_MEETING_HOURS_PER_PERSON, DEFAULT_MEETING_PEOPLE } from '../../../lib/pert/types';
import { query, setText } from './dom';
import { bindInlineNumber } from './inline-number';

export interface MeetingState {
	enabled: boolean;
	hours: string;
	/** Attendees typed by the user. Only used where the count is editable. */
	people: string;
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
	peopleText: () => string;
	/** True when the meeting is off or its fields hold usable numbers. */
	isValid: () => boolean;
	/** Numbers for the calculation, or null when the meeting is off or invalid. */
	parsed: () => { hoursPerPerson: number; people: number | null } | null;
	set: (state: Partial<MeetingState>) => void;
	paint: (values: MeetingValues) => void;
}

/**
 * The "Estimeringsmöte" part of a result panel: the work/meeting split, the
 * hours-per-person field and, in PERT Pro, the number of attendees.
 * Optional meetings start hidden behind an "add" button.
 */
export function createMeetingControl(root: HTMLElement, onChange: () => void): MeetingControl {
	const meetingRoot = query<HTMLElement>(root, '[data-meeting-root]');
	const block = query<HTMLElement>(meetingRoot, '[data-meeting-block]');
	const addButton = meetingRoot.querySelector<HTMLButtonElement>('[data-meeting-add]');
	const removeButton = meetingRoot.querySelector<HTMLButtonElement>('[data-meeting-remove]');
	const hoursInput = query<HTMLInputElement>(meetingRoot, '[data-meeting]');
	const peopleInput = meetingRoot.querySelector<HTMLInputElement>('[data-meeting-people]');
	const barWork = query<HTMLElement>(meetingRoot, '[data-bar-work]');
	const barMeeting = query<HTMLElement>(meetingRoot, '[data-bar-meeting]');
	const optional = addButton !== null;
	let enabled = !optional;

	const hours = bindInlineNumber(hoursInput, { allowZero: true, onInput: onChange });
	hours.setValue(String(DEFAULT_MEETING_HOURS_PER_PERSON));

	const attendeesValid = (): boolean => {
		if (!peopleInput) return true;
		const value = parseSwedishNumber(peopleInput.value);
		return value !== null && Number.isInteger(value) && value >= 1;
	};
	const hoursValid = (): boolean => {
		const value = parseSwedishNumber(hoursInput.value);
		return value !== null && value >= 0;
	};

	if (peopleInput) {
		peopleInput.value = String(DEFAULT_MEETING_PEOPLE);
		peopleInput.addEventListener('input', () => {
			if (attendeesValid()) peopleInput.removeAttribute('aria-invalid');
			else peopleInput.setAttribute('aria-invalid', 'true');
			onChange();
		});
	}

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
		peopleText: () => peopleInput?.value ?? '',
		isValid: () => !enabled || (hoursValid() && attendeesValid()),
		parsed(): { hoursPerPerson: number; people: number | null } | null {
			if (!enabled || !hoursValid() || !attendeesValid()) return null;
			return {
				hoursPerPerson: parseSwedishNumber(hoursInput.value) as number,
				people: peopleInput ? (parseSwedishNumber(peopleInput.value) as number) : null,
			};
		},
		set(state: Partial<MeetingState>): void {
			if (state.hours !== undefined) hours.setValue(state.hours);
			if (state.people !== undefined && peopleInput) {
				peopleInput.value = state.people;
				if (attendeesValid()) peopleInput.removeAttribute('aria-invalid');
				else peopleInput.setAttribute('aria-invalid', 'true');
			}
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
