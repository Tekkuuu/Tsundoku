import { ORIGIN, BETTER_AUTH_SECRET, MAX_USERS } from '$app/env/private';
import { betterAuth } from 'better-auth/minimal';
import { APIError } from 'better-auth/api';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { db } from '#lib/server/db/index.js';
import { getUserCount, isCapReached, parseMaxUsers } from './services/registration';

export const auth = betterAuth({
	baseURL: ORIGIN,
	secret: BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'pg' }),
	emailAndPassword: { enabled: true },
	databaseHooks: {
		user: {
			create: {
				before: async () => {
					const maxUsers = parseMaxUsers(MAX_USERS);
					if (isCapReached(await getUserCount(), maxUsers)) {
						throw new APIError('FORBIDDEN', { message: 'Registration is closed' });
					}
				}
			}
		}
	},
	plugins: [
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
});
