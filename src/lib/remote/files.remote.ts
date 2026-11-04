import { getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import { z } from 'zod/v4';
import { db } from '#lib/server/db/index.js';
import { logger } from '#lib/server/logger.js';
import { getOwnedFile, readOwnedFileBytes } from '#lib/server/services/files.js';

export const getFilePreview = query(z.uuidv4(), async (id) => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized file preview');
		error(401, 'Unauthorized');
	}

	const row = await getOwnedFile(db, id, locals.user.id);
	if (!row) error(404, 'File not found');
	const bytes = await readOwnedFileBytes(row);
	return {
		contentType: row.contentType,
		dataUrl: `data:${row.contentType};base64,${bytes.toString('base64')}`
	};
});

export const getFileMetadata = query(z.uuidv4(), async (id) => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized file metadata');
		error(401, 'Unauthorized');
	}

	const row = await getOwnedFile(db, id, locals.user.id);
	if (!row) error(404, 'File not found');
	return { kind: row.kind, contentType: row.contentType, size: row.size };
});
