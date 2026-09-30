/** Shared page state and callbacks that every mode uses. */
export interface PertContext {
	/** Current hours per workday as typed. Shared between all modes (`h=`). */
	getHoursPerDay: () => string;
	setHoursPerDay: (value: string) => void;
	/** Call after any edit: re-renders the active mode and syncs the address bar. */
	changed: () => void;
	/** Updates the compact summary bar on narrow screens. */
	setSummary: (text: string | null) => void;
	/** Sets the sentence under the page title. */
	setLead: (text: string) => void;
	/** The absolute origin + pathname used for share links. */
	baseUrl: () => string;
}

export interface ModeController {
	/** Value of the `mode` URL parameter. */
	readonly token: string;
	/** Called each time the mode becomes visible. */
	activate: () => void;
	/** Recomputes and repaints everything from the current form state. */
	render: () => void;
	/** Query string for the current state, or null when the form is incomplete. */
	queryString: () => string | null;
}
