import { parseSwedishNumber } from '../../../lib/pert/format';

/**
 * Wires a small inline number field. The field is flagged as invalid when its
 * text is not a usable number; callers fall back to a default for calculations.
 */
export function bindInlineNumber(
	input: HTMLInputElement,
	options: { allowZero: boolean; onInput: (value: string) => void },
): { setValue: (value: string) => void } {
	const validate = (): void => {
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
