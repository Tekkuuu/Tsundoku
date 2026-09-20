#!/usr/bin/env node
/**
 * Delete staged uploads that were never linked to a book or order.
 *
 * Uploads are staged immediately (POST /api/files) and linked on form
 * submit. Abandoned staged files — e.g. the dialog was closed without
 * saving — are reaped here. Only files older than 24h with no references
 * from book.cover_file_id / "order".receipt_file_id are removed.
 *
 *   pnpm files:prune
 *
 * DATA_DIR defaults to ./data. DATABASE_URL comes from the environment.
 */
import postgres from 'postgres';
import { unlink } from 'node:fs/promises';
import path from 'node:path';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
	console.error('error: DATABASE_URL is not set');
	process.exit(1);
}

const dataDir = process.env.DATA_DIR ?? './data';
const sql = postgres(connectionString, { max: 1 });

try {
	const rows = await sql`
		DELETE FROM "file" f
		WHERE f.created_at < now() - interval '24 hours'
			AND NOT EXISTS (SELECT 1 FROM book b WHERE b.cover_file_id = f.id)
			AND NOT EXISTS (SELECT 1 FROM "order" o WHERE o.receipt_file_id = f.id)
		RETURNING f.id
	`;
	let removed = 0;
	for (const row of rows) {
		const dest = path.join(dataDir, row.id.slice(0, 2), row.id);
		try {
			await unlink(dest);
			removed += 1;
		} catch (err) {
			if (err?.code !== 'ENOENT') throw err;
		}
	}
	console.log(`pruned ${rows.length} staged file(s), removed ${removed} from disk`);
} finally {
	await sql.end();
}
