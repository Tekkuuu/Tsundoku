import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	MAX_USERS: { schema: (input) => input ?? '' },
	ORIGIN: { schema: (input) => input ?? '' },
	BETTER_AUTH_SECRET: { schema: (input) => input ?? '' },
	DATABASE_URL: { schema: (input) => input ?? '' }
});
