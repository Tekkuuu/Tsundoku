import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '#lib/server/db/index.js';
import { FileError, FILE_KINDS, importFromUrl, type FileKind } from '#lib/server/services/files.js';
import { logger } from '#lib/server/logger.js';

/**
 * Import a copy of a remote file ("paste a URL, we snapshot the bytes").
 * The fetch carries no credentials and is fenced against SSRF (see files.ts).
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const body = (await request.json().catch(() => null)) as { kind?: unknown; url?: unknown } | null;
	const kind: FileKind | null =
		typeof body?.kind === 'string' && (FILE_KINDS as readonly string[]).includes(body.kind)
			? (body.kind as FileKind)
			: null;
	if (!kind || typeof body?.url !== 'string' || !body.url.trim()) {
		return Response.json({ message: 'A file kind and URL are required' }, { status: 400 });
	}

	try {
		const row = await importFromUrl(db, { userId: locals.user.id, kind, url: body.url });
		return Response.json({ id: row.id, contentType: row.contentType, size: row.size });
	} catch (err) {
		if (err instanceof FileError) {
			logger.warn({ userId: locals.user.id, code: err.code }, 'File import rejected');
			const status = err.code === 'too-large' ? 413 : err.code === 'fetch-failed' ? 502 : 400;
			return Response.json({ message: err.message }, { status });
		}
		throw err;
	}
};
