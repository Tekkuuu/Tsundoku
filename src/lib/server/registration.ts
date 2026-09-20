import { count } from 'drizzle-orm';
import { user } from '$lib/server/db/auth.schema';

/**
 * Shared registration gate: a hard cap on total accounts.
 *
 * Enforced in two places that must stay in sync:
 * - `login/register/+page.server.ts` — friendly form-level errors.
 * - `auth.ts` `databaseHooks.user.create.before` — hard enforcement for *every*
 *   user-creation path, including direct `POST /api/auth/sign-up/email` calls
 *   that bypass the form action entirely.
 *
 * Everything here is env-agnostic on purpose: callers read
 * `$env/dynamic/private` and pass raw values in, which keeps the pure helpers
 * unit-testable without a database.
 */

/** Parse `MAX_USERS`. `null` means unlimited. */
export function parseMaxUsers(raw: string | undefined): number | null {
	const trimmed = raw?.trim() ?? '';
	if (!trimmed) return null;
	const parsed = Number.parseInt(trimmed, 10);
	if (!Number.isSafeInteger(parsed) || parsed < 0) return null;
	return parsed;
}

/** `true` when no further accounts may be created. `null` cap = unlimited. */
export function isCapReached(total: number, maxUsers: number | null): boolean {
	return maxUsers !== null && total >= maxUsers;
}

export async function getUserCount(): Promise<number> {
	// Lazy import: `db` throws at module load when DATABASE_URL is unset, and
	// this module is also imported by unit tests that never touch the database.
	const { db } = await import('$lib/server/db');
	const rows = await db.select({ n: count() }).from(user);
	return rows[0]?.n ?? 0;
}
