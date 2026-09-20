/**
 * Currency formatting that never throws.
 *
 * `Intl.NumberFormat` with `style: 'currency'` throws `RangeError` for any
 * code that isn't 3 ASCII letters (`''`, `'EU'`, `'EURO'`, …). Validation only
 * guards new input, so legacy or hand-edited rows can still carry such values —
 * and constructing the formatter during render would take down the whole
 * route. These helpers fall back to a plain amount with the raw code appended
 * instead. (Well-formed but non-ISO codes like `ZZZ` format natively and pass
 * through untouched.)
 */

function decimalFormatter(): Intl.NumberFormat {
	return new Intl.NumberFormat(undefined);
}

/** Formatter for `code`, or a plain decimal formatter if the code is unknown. */
export function createCurrencyFormatter(code: string | null | undefined): Intl.NumberFormat {
	if (!code) return decimalFormatter();
	try {
		return new Intl.NumberFormat(undefined, { style: 'currency', currency: code });
	} catch {
		return decimalFormatter();
	}
}

/**
 * Format `value` in `code`. Unknown codes render as e.g. `1,234.50 ZZZ`
 * instead of throwing.
 */
export function formatMoney(value: number, code: string | null | undefined): string {
	if (!code) return decimalFormatter().format(value);
	try {
		return new Intl.NumberFormat(undefined, { style: 'currency', currency: code }).format(value);
	} catch {
		return `${decimalFormatter().format(value)} ${code}`;
	}
}
