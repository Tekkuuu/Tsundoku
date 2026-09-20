export function tokenizeSearchQuery(query: string): string[] {
	const terms: string[] = [];
	let current = '';
	let quote: string | null = null;

	for (const character of query) {
		if (quote) {
			current += character;
			if (character === quote) quote = null;
		} else if (character === '"') {
			quote = character;
			current += character;
		} else if (/\s/.test(character)) {
			if (current) terms.push(current);
			current = '';
		} else {
			current += character;
		}
	}

	if (current) terms.push(current);
	return terms;
}

export function getSearchTermValue(term: string): { value: string; negated: boolean } {
	const negated = term.startsWith('-');
	const value = (negated ? term.slice(1) : term).replace(/^"(.*)"$/, '$1');
	return { value, negated };
}

export type SearchFieldType = 'text' | 'number' | 'date';

export type SearchField<T> = {
	type: SearchFieldType;
	get: (item: T) => unknown | unknown[];
	match?: (item: T, value: string) => boolean;
};

type ParsedSearchTerm = {
	field: string;
	value: string;
	operator: string;
	negated: boolean;
};

function parseSearchTerm(term: string): ParsedSearchTerm {
	const { value: positiveTerm, negated } = getSearchTermValue(term);
	const colon = positiveTerm.indexOf(':');
	const field = colon === -1 ? '' : positiveTerm.slice(0, colon).toLowerCase();
	const rawValue = colon === -1 ? positiveTerm : positiveTerm.slice(colon + 1);
	const match = rawValue.match(/^(<=|>=|<|>)?\s*(.*)$/);

	return {
		field,
		operator: match?.[1] ?? '',
		value: getSearchTermValue((match?.[2] ?? rawValue).trim()).value,
		negated
	};
}

function valuesOf(value: unknown | unknown[]): unknown[] {
	return Array.isArray(value) ? value : [value];
}

function matchesField<T>(item: T, field: SearchField<T>, term: ParsedSearchTerm): boolean {
	const values = valuesOf(field.get(item)).filter(
		(value) => value !== null && value !== undefined && value !== ''
	);
	if (term.value === '' || values.length === 0) return false;
	if (field.match) return field.match(item, term.value);

	if (field.type === 'text') {
		return values.some((value) => String(value).toLowerCase().includes(term.value.toLowerCase()));
	}

	if (field.type === 'number') {
		const numbers = values.map(Number).filter((value) => !Number.isNaN(value));
		const target = Number(term.value);
		if (Number.isNaN(target)) {
			return numbers.some((value) =>
				String(value).toLowerCase().includes(term.value.toLowerCase())
			);
		}
		return numbers.some((value) => {
			if (term.operator === '>') return value > target;
			if (term.operator === '<') return value < target;
			if (term.operator === '>=') return value >= target;
			if (term.operator === '<=') return value <= target;
			return value === target;
		});
	}

	return values.some((value) => {
		const date = new Date(String(value));
		const target = Date.parse(term.value);
		if (Number.isNaN(date.getTime())) return false;
		if (Number.isNaN(target)) return false;
		if (term.operator === '>') return date.getTime() > target;
		if (term.operator === '<') return date.getTime() < target;
		if (term.operator === '>=') return date.getTime() >= target;
		if (term.operator === '<=') return date.getTime() <= target;
		return date.toDateString() === new Date(target).toDateString();
	});
}

export function filterSearch<T>(
	items: T[],
	query: string,
	fields: Record<string, SearchField<T>>,
	fuzzyMatch: (item: T, value: string) => boolean
): T[] {
	const terms = tokenizeSearchQuery(query.trim());
	if (terms.length === 0) return items;

	return items.filter((item) =>
		terms.every((rawTerm) => {
			const term = parseSearchTerm(rawTerm);
			if (!term.value) return true;

			const matched = term.field
				? fields[term.field]
					? matchesField(item, fields[term.field], term)
					: false
				: fuzzyMatch(item, term.value);
			return term.negated ? !matched : matched;
		})
	);
}
