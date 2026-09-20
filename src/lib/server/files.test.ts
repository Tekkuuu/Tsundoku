import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import {
	fetchUrlBytes,
	isBlockedIp,
	resolveDataDir,
	sniffContentType,
	storedPath,
	validateImportUrl,
	FileError
} from './files';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const GIF89 = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01]);
const GIF87 = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0x01]);
const WEBP = new Uint8Array([
	0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50
]);
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e]);
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg">');
const HTML = new TextEncoder().encode('<!doctype html><html>');

describe('sniffContentType', () => {
	it('recognizes images and PDF from magic bytes', () => {
		expect(sniffContentType(JPEG)).toBe('image/jpeg');
		expect(sniffContentType(PNG)).toBe('image/png');
		expect(sniffContentType(GIF89)).toBe('image/gif');
		expect(sniffContentType(GIF87)).toBe('image/gif');
		expect(sniffContentType(WEBP)).toBe('image/webp');
		expect(sniffContentType(PDF)).toBe('application/pdf');
	});

	it('rejects SVG, HTML and polyglots starting with text', () => {
		expect(sniffContentType(SVG)).toBeNull();
		expect(sniffContentType(HTML)).toBeNull();
		expect(sniffContentType(new Uint8Array())).toBeNull();
		expect(sniffContentType(new Uint8Array([0xff, 0xd8]))).toBeNull();
	});

	it('does not confuse near-misses', () => {
		// RIFF but not WEBP.
		expect(
			sniffContentType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0, 0, 0, 0]))
		).toBeNull();
		// GIF with a bad version byte.
		expect(sniffContentType(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x30, 0x61]))).toBeNull();
	});
});

describe('isBlockedIp', () => {
	it('blocks loopback, private, link-local and special ranges', () => {
		for (const ip of [
			'127.0.0.1',
			'127.1.2.3',
			'10.0.0.5',
			'172.16.0.1',
			'172.31.255.255',
			'192.168.1.1',
			'169.254.169.254',
			'0.0.0.0',
			'100.64.0.1',
			'::1',
			'::',
			'fe80::1',
			'fc00::1',
			'fd00::1',
			'ff02::1',
			'::ffff:127.0.0.1',
			'::ffff:10.1.2.3'
		]) {
			expect(isBlockedIp(ip), ip).toBe(true);
		}
	});

	it('allows public addresses', () => {
		for (const ip of [
			'8.8.8.8',
			'1.1.1.1',
			'93.184.216.34',
			'172.15.0.1',
			'172.32.0.1',
			'11.0.0.1',
			'2606:4700:4700::1111'
		]) {
			expect(isBlockedIp(ip), ip).toBe(false);
		}
	});
});

describe('validateImportUrl', () => {
	it('accepts plain http(s) URLs', () => {
		expect(validateImportUrl('https://example.com/cover.jpg').hostname).toBe('example.com');
	});

	it('rejects credentials, non-http schemes and garbage', () => {
		for (const raw of [
			'https://user:pass@example.com/x.jpg',
			'file:///etc/passwd',
			'ftp://example.com/x.jpg',
			'gopher://example.com/',
			'not a url',
			''
		]) {
			expect(() => validateImportUrl(raw), raw).toThrow(FileError);
		}
	});
});

describe('storedPath', () => {
	it('carries no metadata: UUID sharding only, no extension', () => {
		const p = storedPath('/data', '12345678-1234-1234-1234-1234567890ab');
		expect(p).toBe('/data/12/12345678-1234-1234-1234-1234567890ab');
		expect(p).not.toContain('.jpg');
	});
});

describe('resolveDataDir', () => {
	it('prefers the explicit dir, then env, then ./data', () => {
		expect(resolveDataDir('/tmp/x')).toBe('/tmp/x');
		const prev = process.env.DATA_DIR;
		process.env.DATA_DIR = '/env/dir';
		expect(resolveDataDir()).toBe('/env/dir');
		delete process.env.DATA_DIR;
		expect(resolveDataDir()).toBe('./data');
		if (prev !== undefined) process.env.DATA_DIR = prev;
	});
});

describe('fetchUrlBytes', () => {
	let server: ReturnType<typeof createServer> | undefined;
	afterEach(async () => {
		await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
		server = undefined;
	});

	async function localUrl(
		handler: (reqUrl: string, res: import('node:http').ServerResponse) => void
	) {
		server = createServer((req, res) => handler(req.url ?? '/', res));
		await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
		const { port } = server!.address() as AddressInfo;
		return `http://127.0.0.1:${port}`;
	}

	it('downloads bytes from a plain response', async () => {
		const base = await localUrl((_url, res) => {
			res.setHeader('content-type', 'image/png');
			res.end(Buffer.from(PNG));
		});
		await expect(
			fetchUrlBytes(`${base}/a.png`, { maxBytes: 1024, allowPrivateIps: true })
		).resolves.toEqual(Buffer.from(PNG));
	});

	it('blocks loopback unless explicitly allowed in tests', async () => {
		const base = await localUrl((_url, res) => res.end('x'));
		await expect(fetchUrlBytes(`${base}/a`, { maxBytes: 1024 })).rejects.toMatchObject({
			code: 'blocked-host'
		});
	});

	it('aborts oversized responses mid-stream', async () => {
		const base = await localUrl((_url, res) => {
			res.end(Buffer.alloc(4096));
		});
		await expect(
			fetchUrlBytes(`${base}/big`, { maxBytes: 16, allowPrivateIps: true })
		).rejects.toMatchObject({ code: 'too-large' });
	});

	it('follows same-host redirects within the hop limit', async () => {
		const base = await localUrl((reqUrl, res) => {
			if (reqUrl === '/old') {
				res.writeHead(302, { location: '/new' });
				res.end();
				return;
			}
			res.end(Buffer.from(JPEG));
		});
		await expect(
			fetchUrlBytes(`${base}/old`, { maxBytes: 1024, allowPrivateIps: true })
		).resolves.toEqual(Buffer.from(JPEG));
	});

	it('rejects non-200 statuses', async () => {
		const base = await localUrl((_url, res) => {
			res.statusCode = 404;
			res.end('nope');
		});
		await expect(
			fetchUrlBytes(`${base}/missing`, { maxBytes: 1024, allowPrivateIps: true })
		).rejects.toMatchObject({ code: 'fetch-failed' });
	});

	it('resolves a hostname through the guarded lookup (autoSelectFamily asks for all addresses)', async () => {
		// Literal IPs bypass `lookup`, so this is the only path that exercises
		// guardedLookup. On Node 20+ net calls it with { all: true }.
		server = createServer((_req, res) => {
			res.setHeader('content-type', 'image/png');
			res.end(Buffer.from(PNG));
		});
		await new Promise<void>((resolve) => server!.listen(0, resolve));
		const { port } = server!.address() as AddressInfo;
		await expect(
			fetchUrlBytes(`http://localhost:${port}/a.png`, { maxBytes: 1024, allowPrivateIps: true })
		).resolves.toEqual(Buffer.from(PNG));
	});
});
