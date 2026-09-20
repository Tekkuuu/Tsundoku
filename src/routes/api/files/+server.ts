import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { FileError, FILE_KINDS, MAX_BYTES, storeBytes, type FileKind } from '$lib/server/files';
import { logger } from '$lib/server/logger';

function parseKind(value: unknown): FileKind | null {
	return typeof value === 'string' && (FILE_KINDS as readonly string[]).includes(value)
		? (value as FileKind)
		: null;
}

/** Stage a direct upload. Returns the file id; the book/order form links it on submit. */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const form = await request.formData().catch(() => null);
	const kind = parseKind(form?.get('kind'));
	if (!kind) return json({ message: 'Invalid file kind' }, { status: 400 });

	const upload = form?.get('file');
	if (!(upload instanceof File) || upload.size === 0) {
		return json({ message: 'Choose a file to upload' }, { status: 400 });
	}
	if (upload.size > MAX_BYTES[kind]) {
		return json({ message: 'File exceeds the size limit' }, { status: 413 });
	}

	try {
		const row = await storeBytes(db, {
			userId: locals.user.id,
			kind,
			bytes: new Uint8Array(await upload.arrayBuffer())
		});
		return json({ id: row.id });
	} catch (err) {
		if (err instanceof FileError) {
			logger.warn({ userId: locals.user.id, code: err.code }, 'File upload rejected');
			return json({ message: err.message }, { status: err.code === 'too-large' ? 413 : 400 });
		}
		throw err;
	}
};
