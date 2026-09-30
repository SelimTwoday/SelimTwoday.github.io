import { initEnterpriseGag } from '../enterprise-gag';
import { GROUP_MODE_TOKEN, parsePertSearchParams } from '../../lib/pert/url';
import type { TaskGroupInput } from '../../lib/pert/types';
import { query, queryAll } from './ui/dom';
import { bindInlineNumber } from './ui/inline-number';
import type { ModeController, PertContext } from './modes/context';
import { createGroupMode } from './modes/group';
import { createGroupTasksMode } from './modes/grouptasks';

type Screen = 'participants' | 'grouptasks';

const PARTICIPANTS_LEAD = 'Varje deltagare uppskattar hela uppgiften. Värdena vägs ihop till ett gemensamt estimat.';

const URL_TOKENS: Record<Screen, string> = {
	participants: GROUP_MODE_TOKEN,
	grouptasks: 'grouptasks',
};

const page = query<HTMLElement>(document, '.pert-page');
const lead = query<HTMLElement>(page, '[data-lead]');
const urlError = query<HTMLElement>(page, '[data-url-error]');
const summaryBar = query<HTMLButtonElement>(page, '[data-summary]');
const summaryText = query<HTMLElement>(page, '[data-summary-text]');
const modeLinks = queryAll<HTMLAnchorElement>(page, '[data-mode-link]');

const parsed = parsePertSearchParams(window.location.search);
if (parsed.errors.length > 0) {
	urlError.hidden = false;
	urlError.textContent = `${parsed.errors.join(' ')} Kontrollera den ursprungliga länken.`;
}
// A link with problems is never partly loaded.
const usable = parsed.errors.length === 0;

let hoursPerDay = parsed.hoursPerDay;
// Old PERT Pro links (mode=tasks) open as a single person in Enterprise.
let activeMode: Screen = parsed.mode === 'participants' ? 'participants' : 'grouptasks';
const controllers = new Map<Screen, ModeController>();
const workspaces = new Map<Screen, HTMLElement>();
for (const mode of Object.keys(URL_TOKENS) as Screen[]) {
	workspaces.set(mode, query<HTMLElement>(page, `[data-workspace="${mode}"]`));
}

const hoursFields = queryAll<HTMLInputElement>(page, '[data-hpd]').map((input) => ({
	input,
	binding: bindInlineNumber(input, {
		allowZero: false,
		onInput: (value) => {
			hoursPerDay = value;
			syncHoursFields(input);
			context.changed();
		},
	}),
}));

function syncHoursFields(source?: HTMLInputElement): void {
	for (const field of hoursFields) {
		if (field.input !== source) field.binding.setValue(hoursPerDay);
	}
}

function active(): ModeController {
	return controllers.get(activeMode) as ModeController;
}

function syncUrl(): void {
	const search = active().queryString();
	if (search === null) return;
	window.history.replaceState(null, '', `${window.location.pathname}?${search}`);
}

const context: PertContext = {
	getHoursPerDay: () => hoursPerDay,
	setHoursPerDay: (value) => {
		hoursPerDay = value;
		syncHoursFields();
	},
	changed: () => {
		active().render();
		syncUrl();
	},
	setSummary: (text) => {
		summaryBar.hidden = text === null;
		summaryText.textContent = text ?? '';
	},
	setLead: (text) => {
		lead.textContent = text;
	},
	baseUrl: () => window.location.origin + window.location.pathname,
};

controllers.set(
	'participants',
	createGroupMode(workspaces.get('participants') as HTMLElement, context, {
		rows: usable ? parsed.rows : [],
		meeting: parsed.meetingHoursPerPerson,
	}),
);
const initialGroups: TaskGroupInput[] = !usable
	? []
	: parsed.mode === 'tasks'
		? (parsed.tasks.length > 0 ? [{ name: 'Person 1', tasks: parsed.tasks }] : [])
		: parsed.groups;
controllers.set(
	'grouptasks',
	createGroupTasksMode(
		workspaces.get('grouptasks') as HTMLElement,
		context,
		{
			groups: initialGroups,
			meeting: {
				enabled: usable && parsed.mode !== 'participants' && parsed.meetingPresent,
				hours: parsed.meetingHoursPerPerson,
			},
		},
		initEnterpriseGag(),
	),
);

syncHoursFields();

function showMode(mode: Screen): void {
	activeMode = mode;
	for (const [name, element] of workspaces) element.hidden = name !== mode;
	for (const link of modeLinks) {
		if (link.dataset.modeLink === mode) link.setAttribute('aria-current', 'page');
		else link.removeAttribute('aria-current');
	}
	if (mode === 'participants') lead.textContent = PARTICIPANTS_LEAD;
	active().activate();
}

for (const link of modeLinks) {
	link.addEventListener('click', (event) => {
		event.preventDefault();
		const mode = link.dataset.modeLink as Screen;
		if (mode === activeMode) return;
		showMode(mode);
		const search = active().queryString();
		window.history.replaceState(null, '', `${window.location.pathname}?${search ?? `mode=${URL_TOKENS[mode]}`}`);
	});
}

summaryBar.addEventListener('click', () => {
	const panel = query<HTMLElement>(workspaces.get(activeMode) as HTMLElement, '[data-panel]');
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	panel.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
});

showMode(activeMode);
syncUrl();
