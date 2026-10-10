type PgError = { code?: unknown; constraint_name?: unknown; constraint?: unknown };

/**
 * @returns The Postgres unique-violation (`23505`) error, or `null`.
 */
export function findPgError(err: unknown): PgError | null {
	let cur: unknown = err;
	for (let i = 0; i < 4 && typeof cur === 'object' && cur !== null; i++) {
		const e = cur as Record<string, unknown>;
		if (e['code'] === '23505') {
			return e as PgError;
		}
		cur = e['cause'];
	}
	return null;
}

/**
 * @param err - Error to inspect.
 * @param constraint - Unique constraint/index name to match. Omit to accept any.
 * @returns `true` when `err` is a unique violation.
 */
export function isUniqueViolation(err: unknown, constraint?: string): boolean {
	const pg = findPgError(err);
	if (!pg) return false;
	if (!constraint) return true;
	const name = String(pg.constraint_name ?? pg.constraint ?? '');
	return !name || name.includes(constraint);
}
