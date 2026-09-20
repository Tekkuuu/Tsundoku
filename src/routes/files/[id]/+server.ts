import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { getOwnedFile, readOwnedFileBytes } from '$lib/server/files';
import { logger } from '$lib/server/logger';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Serve an owned file. Missing, malformed, foreign, or disk-gone ids all
 * produce the identical 404: existence is never confirmed to non-owners.
 * PDFs download as attachments; SVG can never be stored (see files.ts), and
 * the sandbox CSP contains anything unexpected on direct navigation.
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) error(401, 'Unauthorized');
	if (!UUID_RE.test(params.id)) error(404, 'File not found');

	const row = await getOwnedFile(db, params.id, locals.user.id);
	if (!row) error(404, 'File not found');

	let bytes: Buffer;
	try {
		bytes = await readOwnedFileBytes(row);
	} catch {
		error(404, 'File not found');
	}

	const headers = new Headers({
		'content-type': row.contentType,
		'content-length': String(bytes.length),
		'cache-control': 'private, max-age=31536000, immutable',
		'x-content-type-options': 'nosniff',
		'content-security-policy': 'sandbox'
	});
	if (row.contentType === 'application/pdf') {
		headers.set('content-disposition', `attachment; filename="${row.id}.pdf"`);
	}
	logger.debug({ userId: locals.user.id, fileId: row.id }, 'File served');
	return new Response(new Uint8Array(bytes), { headers });
};
