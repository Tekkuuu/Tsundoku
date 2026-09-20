import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { Actions } from './$types';
import type { PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { getUserCount, isCapReached, parseMaxUsers } from '$lib/server/registration';
import { APIError } from 'better-auth/api';

function getMaxUsers(): number | null {
	return parseMaxUsers(env.MAX_USERS);
}

export const load: PageServerLoad = async (event) => {
	if (event.locals.user) {
		return redirect(302, '/');
	}
	if (isCapReached(await getUserCount(), getMaxUsers())) {
		return { registrationClosed: true };
	}
	return { registrationClosed: false };
};

export const actions: Actions = {
	signUpEmail: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString().trim() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		const confirmPassword = formData.get('password_confirm')?.toString() ?? '';
		const name = formData.get('name')?.toString().trim() ?? '';

		if (!email || !password || !name) {
			return fail(400, { message: 'Username, email and password are required', email, name });
		}

		if (password != confirmPassword) {
			return fail(400, { message: 'Passwords do not match', email, name });
		}

		// env MAX_USERS => 0 = disabled registration. Also enforced in auth.ts databaseHooks
		if (isCapReached(await getUserCount(), getMaxUsers())) {
			return fail(403, { message: 'Registration is closed', email, name });
		}

		try {
			await auth.api.signUpEmail({
				body: {
					email,
					password,
					name
				}
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: error.message || 'Registration failed', email, name });
			}
			return fail(500, { message: 'Unexpected error, please try again', email, name });
		}

		return redirect(302, '/');
	}
};
