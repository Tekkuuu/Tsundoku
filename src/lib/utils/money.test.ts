import { describe, expect, it } from 'vitest';
import { createCurrencyFormatter, formatMoney } from './money';

describe('formatMoney', () => {
	it('formats a known currency without throwing', () => {
		expect(formatMoney(1234.5, 'PLN')).toBe(
			new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PLN' }).format(1234.5)
		);
	});

	it('passes well-formed but non-ISO codes through natively', () => {
		expect(() => formatMoney(1234.5, 'ZZZ')).not.toThrow();
		expect(formatMoney(1234.5, 'ZZZ')).toContain('ZZZ');
	});

	it('falls back to amount + code for malformed codes instead of throwing', () => {
		for (const code of ['', 'EU', 'EURO']) {
			expect(() => formatMoney(1234.5, code)).not.toThrow();
			const fallback = formatMoney(1234.5, code);
			expect(fallback).toContain(new Intl.NumberFormat(undefined).format(1234.5));
		}
		expect(formatMoney(1234.5, 'EURO')).toContain('EURO');
	});

	it('formats without a currency when the code is missing', () => {
		expect(formatMoney(10, null)).toBe(new Intl.NumberFormat(undefined).format(10));
		expect(formatMoney(10, undefined)).toBe(new Intl.NumberFormat(undefined).format(10));
	});
});

describe('createCurrencyFormatter', () => {
	it('returns a working currency formatter for a known code', () => {
		expect(createCurrencyFormatter('EUR').format(5)).toBe(
			new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(5)
		);
	});

	it('does not throw at creation time for a malformed code', () => {
		expect(() => createCurrencyFormatter('EURO')).not.toThrow();
		expect(createCurrencyFormatter('EURO').format(5)).toBe(
			new Intl.NumberFormat(undefined).format(5)
		);
	});
});
