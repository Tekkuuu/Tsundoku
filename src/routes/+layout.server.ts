import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

const PUBLIC_PREFIXES = ['/login'];

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const isPublic = PUBLIC_PREFIXES.some(
		(prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)
	);

	if (!locals.user && !isPublic) {
		throw redirect(302, '/login');
	}

	if (locals.user && url.pathname.startsWith('/login')) {
		throw redirect(302, '/');
	}

	return { user: locals.user ?? null };
};
