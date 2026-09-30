import { parseSwedishNumber } from '../../../lib/pert/format';

/**
 * Wires a small inline number field. The field is flagged as invalid when its
 * text is not a usable number; callers fall back to a default for calculations.
 */
export function bindInlineNumber(
	input: HTMLInputElement,
	options: { allowZero: boolean; onInput: (value: string) => void },
): { setValue: (value: string) => void } {
	// Fields marked data-autosize grow with their text so decimals always fit.
	const resize = (): void => {
		if (input.hasAttribute('data-autosize')) input.style.width = `${Math.max(input.value.length, 1) + 0.5}ch`;
	};
	const validate = (): void => {
		resize();
		const parsed = parseSwedishNumber(input.value);
		const valid = parsed !== null && parsed >= 0 && (options.allowZero || parsed > 0);
		if (valid) input.removeAttribute('aria-invalid');
		else input.setAttribute('aria-invalid', 'true');
	};

	input.addEventListener('input', () => {
		validate();
		options.onInput(input.value);
	});

	return {
		setValue(value: string): void {
			if (input.value !== value) input.value = value;
			validate();
		},
	};
}
