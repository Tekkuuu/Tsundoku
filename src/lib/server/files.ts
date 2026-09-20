import { randomUUID } from 'node:crypto';
import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { isIP, type LookupFunction } from 'node:net';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { db } from './db';
import { file } from './db/schema';
import { logger } from './logger';

type Db = typeof db;

export const FILE_KINDS = ['cover', 'receipt'] as const;
export type FileKind = (typeof FILE_KINDS)[number];

export type StoredFile = typeof file.$inferSelect;

/** Per-kind upload/import caps. Enforced while streaming, not after. */
export const MAX_BYTES: Record<FileKind, number> = {
	cover: 5 * 1024 * 1024,
	receipt: 10 * 1024 * 1024
};

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const RECEIPT_TYPES = new Set([...IMAGE_TYPES, 'application/pdf']);
const ALLOWED_TYPES: Record<FileKind, Set<string>> = { cover: IMAGE_TYPES, receipt: RECEIPT_TYPES };

const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;

export type FileErrorCode =
	'too-large' | 'unsupported-type' | 'bad-url' | 'blocked-host' | 'fetch-failed' | 'io';

export class FileError extends Error {
	readonly code: FileErrorCode;
	constructor(code: FileErrorCode, message: string) {
		super(message);
		this.code = code;
	}
}

/** process.env is read directly (not $env) so this module stays unit-testable. */
export function resolveDataDir(dataDir?: string): string {
	return dataDir ?? process.env.DATA_DIR ?? './data';
}

/**
 * Sniff the real content type from magic bytes. The client-declared MIME is
 * never trusted. SVG (text) can never match: it is rejected by construction.
 */
export function sniffContentType(bytes: Uint8Array): string | null {
	if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
		return 'image/jpeg';
	}
	if (
		bytes.length >= 8 &&
		bytes[0] === 0x89 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x4e &&
		bytes[3] === 0x47 &&
		bytes[4] === 0x0d &&
		bytes[5] === 0x0a &&
		bytes[6] === 0x1a &&
		bytes[7] === 0x0a
	) {
		return 'image/png';
	}
	if (
		bytes.length >= 6 &&
		bytes[0] === 0x47 &&
		bytes[1] === 0x49 &&
		bytes[2] === 0x46 &&
		bytes[3] === 0x38 &&
		(bytes[4] === 0x37 || bytes[4] === 0x39) &&
		bytes[5] === 0x61
	) {
		return 'image/gif';
	}
	if (
		bytes.length >= 12 &&
		bytes[0] === 0x52 &&
		bytes[1] === 0x49 &&
		bytes[2] === 0x46 &&
		bytes[3] === 0x46 &&
		bytes[8] === 0x57 &&
		bytes[9] === 0x45 &&
		bytes[10] === 0x42 &&
		bytes[11] === 0x50
	) {
		return 'image/webp';
	}
	if (
		bytes.length >= 5 &&
		bytes[0] === 0x25 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x44 &&
		bytes[3] === 0x46 &&
		bytes[4] === 0x2d
	) {
		return 'application/pdf';
	}
	return null;
}

function ipv4ToInt(ip: string): number | null {
	const parts = ip.split('.');
	if (parts.length !== 4) return null;
	let n = 0;
	for (const part of parts) {
		if (!/^\d+$/.test(part)) return null;
		const v = Number(part);
		if (v < 0 || v > 255) return null;
		n = n * 256 + v;
	}
	return n;
}

function inCidr(ip: string, cidr: string): boolean {
	const [base, bits] = cidr.split('/');
	const baseInt = ipv4ToInt(base);
	const ipInt = ipv4ToInt(ip);
	if (baseInt === null || ipInt === null) return false;
	const mask = bits === '0' ? 0 : ~((1 << (32 - Number(bits))) - 1) >>> 0;
	return (baseInt & mask) >>> 0 === (ipInt & mask) >>> 0;
}

/**
 * True for non-routable addresses: loopback, private, link-local,
 * unspecified, multicast, CGNAT. IPv4-mapped IPv6 is unwrapped first.
 */
export function isBlockedIp(raw: string): boolean {
	let ip = raw.toLowerCase();
	if (ip.startsWith('::ffff:')) ip = ip.slice('::ffff:'.length);
	if (ip.includes(':')) {
		if (ip === '::1' || ip === '::') return true;
		if (ip.startsWith('fe80:') || ip.startsWith('fec0:')) return true;
		if (ip.startsWith('fc') || ip.startsWith('fd')) return true;
		if (ip.startsWith('ff')) return true;
		return false;
	}
	if (ipv4ToInt(ip) === null) return true;
	return (
		inCidr(ip, '0.0.0.0/8') ||
		inCidr(ip, '10.0.0.0/8') ||
		inCidr(ip, '100.64.0.0/10') ||
		inCidr(ip, '127.0.0.0/8') ||
		inCidr(ip, '169.254.0.0/16') ||
		inCidr(ip, '172.16.0.0/12') ||
		inCidr(ip, '192.0.0.0/24') ||
		inCidr(ip, '192.0.2.0/24') ||
		inCidr(ip, '192.168.0.0/16') ||
		inCidr(ip, '198.18.0.0/15') ||
		inCidr(ip, '198.51.100.0/24') ||
		inCidr(ip, '203.0.113.0/24') ||
		inCidr(ip, '224.0.0.0/4') ||
		inCidr(ip, '240.0.0.0/4')
	);
}

/** Opaque on-disk path: UUID sharded by prefix, no extension, no metadata. */
export function storedPath(dataDir: string, id: string): string {
	return path.join(dataDir, id.slice(0, 2), id);
}

/** Reject anything that is not a plain http(s) URL without credentials. */
export function validateImportUrl(raw: string): URL {
	let url: URL;
	try {
		url = new URL(raw.trim());
	} catch {
		throw new FileError('bad-url', 'Enter a valid http(s) URL');
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		throw new FileError('bad-url', 'Only http(s) URLs can be imported');
	}
	if (url.username || url.password) {
		throw new FileError('bad-url', 'URLs with credentials cannot be imported');
	}
	if (!url.hostname) {
		throw new FileError('bad-url', 'Enter a valid http(s) URL');
	}
	return url;
}

/**
 * DNS lookup that pins the first resolved address after rejecting the whole
 * answer set when any record is non-routable. Resolving all records (not just
 * the first) closes the "one clean + one internal record" trick, and pinning
 * closes DNS rebinding between check and connect.
 */
function guardedLookup(allowPrivateIps: boolean): LookupFunction {
	return ((hostname: string, options: { all?: boolean }, callback: (...args: never[]) => void) => {
		dns
			.lookup(hostname, { all: true, verbatim: true })
			.then((records) => {
				if (records.length === 0) throw new FileError('blocked-host', 'Hostname did not resolve');
				if (!allowPrivateIps) {
					const blocked = records.find((r) => isBlockedIp(r.address));
					if (blocked) {
						throw new FileError('blocked-host', 'That host cannot be imported');
					}
				}
				return records;
			})
			.then(
				(records) => {
					// net asks for all addresses when `autoSelectFamily` is on
					// (Node 20+ default); otherwise it wants a single address.
					// Return the shape it requested or Node throws ERR_INVALID_IP_ADDRESS.
					if (options?.all) {
						(callback as (err: null, addresses: typeof records) => void)(null, records);
					} else {
						(callback as (err: null, address: string, family: number) => void)(
							null,
							records[0].address,
							records[0].family
						);
					}
				},
				(err) =>
					(callback as (err: unknown) => void)(
						err instanceof FileError ? err : new FileError('fetch-failed', 'Could not resolve host')
					)
			);
	}) as LookupFunction;
}

function requestOnce(
	url: URL,
	maxBytes: number,
	allowPrivateIps: boolean
): Promise<{ bytes: Uint8Array; status: number; location: string | null }> {
	// Literal IPs never reach the DNS lookup override below, so they need an
	// explicit check here (every redirect hop passes through this function).
	if (!allowPrivateIps && isIP(url.hostname) !== 0 && isBlockedIp(url.hostname)) {
		throw new FileError('blocked-host', 'That host cannot be imported');
	}
	return new Promise((resolve, reject) => {
		const lib = url.protocol === 'https:' ? https : http;
		let settled = false;
		const fail = (err: unknown) => {
			if (settled) return;
			settled = true;
			reject(asFileError(err));
		};
		const req = lib.request(
			url,
			{
				method: 'GET',
				lookup: guardedLookup(allowPrivateIps),
				headers: { 'user-agent': 'Tsundoku/1.0 (+self-hosted)', accept: '*/*' }
			},
			(res) => {
				if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400) {
					res.resume();
					if (settled) return;
					settled = true;
					resolve({
						bytes: new Uint8Array(),
						status: res.statusCode,
						location: res.headers.location ?? null
					});
					return;
				}
				if (res.statusCode !== 200) {
					res.resume();
					fail(
						new FileError('fetch-failed', `Server responded with status ${res.statusCode ?? '?'}`)
					);
					return;
				}
				const chunks: Buffer[] = [];
				let total = 0;
				res.on('data', (chunk: Buffer) => {
					if (settled) return;
					total += chunk.length;
					if (total > maxBytes) {
						res.destroy();
						fail(new FileError('too-large', 'Remote file exceeds the size limit'));
						return;
					}
					chunks.push(chunk);
				});
				res.on('end', () => {
					if (settled) return;
					settled = true;
					resolve({ bytes: Buffer.concat(chunks), status: 200, location: null });
				});
				res.on('error', fail);
			}
		);
		req.setTimeout(FETCH_TIMEOUT_MS, () => {
			req.destroy();
			fail(new FileError('fetch-failed', 'Remote server timed out'));
		});
		req.on('error', fail);
		req.end();
	});
}

function asFileError(err: unknown): FileError {
	if (err instanceof FileError) return err;
	return new FileError('fetch-failed', 'Could not download that URL');
}

/**
 * Download bytes with manual redirect handling so every hop is re-validated
 * (a redirect may bounce from public to internal). The fetch carries no
 * cookies or credentials: it sees what anonymous curl would see.
 */
export async function fetchUrlBytes(
	rawUrl: string,
	opts: { maxBytes: number; allowPrivateIps?: boolean }
): Promise<Uint8Array> {
	let url = validateImportUrl(rawUrl);
	const allowPrivateIps = opts.allowPrivateIps ?? false;
	for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
		const { bytes, status, location } = await requestOnce(url, opts.maxBytes, allowPrivateIps);
		if (status >= 300 && status < 400) {
			if (!location) throw new FileError('fetch-failed', 'Redirect without a destination');
			url = validateImportUrl(new URL(location, url).toString());
			continue;
		}
		return bytes;
	}
	throw new FileError('fetch-failed', 'Too many redirects');
}

export async function storeBytes(
	database: Db,
	input: { userId: string; kind: FileKind; bytes: Uint8Array; dataDir?: string }
): Promise<StoredFile> {
	const allowed = ALLOWED_TYPES[input.kind];
	if (input.bytes.length === 0) {
		throw new FileError('unsupported-type', 'Empty files cannot be stored');
	}
	if (input.bytes.length > MAX_BYTES[input.kind]) {
		throw new FileError('too-large', 'File exceeds the size limit');
	}
	const contentType = sniffContentType(input.bytes);
	if (!contentType || !allowed.has(contentType)) {
		throw new FileError(
			'unsupported-type',
			input.kind === 'cover'
				? 'Only JPEG, PNG, GIF or WebP images are allowed'
				: 'Only images or PDF files are allowed'
		);
	}

	const dir = resolveDataDir(input.dataDir);
	const id = randomUUID();
	const dest = storedPath(dir, id);
	await mkdir(path.dirname(dest), { recursive: true });
	await writeFile(dest, input.bytes, { mode: 0o600 });

	try {
		const [row] = await database
			.insert(file)
			.values({ id, userId: input.userId, kind: input.kind, contentType, size: input.bytes.length })
			.returning();
		return row;
	} catch (err) {
		// Don't leave orphan bytes behind when the row insert fails.
		await unlink(dest).catch(() => {});
		throw err;
	}
}

export async function importFromUrl(
	database: Db,
	input: {
		userId: string;
		kind: FileKind;
		url: string;
		dataDir?: string;
		allowPrivateIps?: boolean;
	}
): Promise<StoredFile> {
	const bytes = await fetchUrlBytes(input.url, {
		maxBytes: MAX_BYTES[input.kind],
		allowPrivateIps: input.allowPrivateIps
	});
	return storeBytes(database, {
		userId: input.userId,
		kind: input.kind,
		bytes,
		dataDir: input.dataDir
	});
}

/**
 * Load a file row only when it belongs to the user. Returns null otherwise —
 * callers map null to 404 without distinguishing "missing" from "not yours",
 * so existence is never confirmed to non-owners.
 */
export async function getOwnedFile(
	database: Db,
	id: string,
	userId: string
): Promise<StoredFile | null> {
	const [row] = await database
		.select()
		.from(file)
		.where(and(eq(file.id, id), eq(file.userId, userId)))
		.limit(1);
	return row ?? null;
}

/** For mutations linking an uploaded file: 404 unless owned and of the right kind. */
export async function requireOwnedFile(
	database: Db,
	id: string,
	userId: string,
	kind: FileKind
): Promise<StoredFile> {
	const row = await getOwnedFile(database, id, userId);
	if (!row || row.kind !== kind) {
		logger.warn({ userId, fileId: id }, 'File link to unowned or wrong-kind file');
		error(404, 'File not found');
	}
	return row;
}

export async function readOwnedFileBytes(row: StoredFile, dataDir?: string): Promise<Buffer> {
	try {
		return await readFile(storedPath(resolveDataDir(dataDir), row.id));
	} catch (err) {
		logger.error({ fileId: row.id, err }, 'File row exists but bytes are missing on disk');
		throw err;
	}
}

/**
 * Delete an owned file row and its bytes. Returns false when the row does not
 * exist or belongs to someone else (callers surface 404 either way).
 */
export async function deleteOwnedFile(
	database: Db,
	id: string,
	userId: string,
	dataDir?: string
): Promise<boolean> {
	const [deleted] = await database
		.delete(file)
		.where(and(eq(file.id, id), eq(file.userId, userId)))
		.returning({ id: file.id });
	if (!deleted) return false;
	await unlink(storedPath(resolveDataDir(dataDir), id)).catch((err) => {
		logger.warn({ fileId: id, err }, 'File row deleted but bytes were already gone');
	});
	return true;
}
