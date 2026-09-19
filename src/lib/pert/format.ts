/**
 * Parses a Swedish-formatted decimal number string (comma as decimal
 * separator, e.g. "8,5") into a number. Returns null when the string is not
 * a valid non-negative-or-negative decimal number.
 *
 * Accepts plain dot-decimals too ("8.5") so pasted/URL values also work.
 * Rejects empty strings, thousand separators, and any non-numeric content.
 */
export function parseSwedishNumber(raw: string): number | null {
	const trimmed = raw.trim();
	if (trimmed === '') return null;

	// Only digits, an optional leading minus, and a single comma or dot.
	if (!/^-?\d+([.,]\d+)?$/.test(trimmed)) return null;

	const normalized = trimmed.replace(',', '.');
	const value = Number(normalized);
	return Number.isFinite(value) ? value : null;
}

/**
 * Formats a number using Swedish locale conventions (comma decimal
 * separator). Defaults to one decimal place, matching the reference tool.
 */
export function formatSwedishNumber(value: number, decimals = 1): string {
	return value.toLocaleString('sv-SE', {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals,
	});
}
