#!/usr/bin/env node
/**
 * Plain-SQL backup of the database to ./backups/
 *
 *   pnpm db:backup
 *   pnpm db:backup backups/custom-name.sql
 *
 * Credentials come from DATABASE_URL (.env).
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function fail(message) {
	console.error(`error: ${message}`);
	process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) fail('DATABASE_URL is not set');

let parsed;
try {
	parsed = new URL(connectionString);
} catch {
	fail('DATABASE_URL is not a valid connection string');
}
const dbname = parsed.pathname.replace(/^\//, '');
if (!dbname) fail('DATABASE_URL has no database name');
const user = decodeURIComponent(parsed.username);

const stamp = new Date().toISOString().slice(0, 19).replace('T', '-').replace(/:/g, '');
const outputFile = process.argv[2] ?? `backups/${dbname}-${stamp}.sql`;

function composeDbRunning() {
	const result = spawnSync('docker', ['compose', 'ps', '--status', 'running', '--quiet', 'db'], {
		encoding: 'utf8'
	});
	return result.status === 0 && (result.stdout ?? '').trim().length > 0;
}

let stdout;

if (composeDbRunning()) {
	const args = [
		'compose',
		'exec',
		'-T',
		'db',
		'pg_dump',
		'-U',
		user,
		'--clean',
		'--if-exists',
		dbname
	];
	const result = spawnSync('docker', args, { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
	stdout = result.stdout;
	if (result.status !== 0) {
		fail(`docker compose pg_dump failed: ${result.stderr || 'unknown error'}`);
	}
} else {
	const host = parsed.hostname || 'localhost';
	const port = parsed.port || '5432';
	const password = decodeURIComponent(parsed.password ?? '');
	const args = [
		'--clean',
		'--if-exists',
		'--no-password',
		'-h',
		host,
		'-p',
		port,
		'-U',
		user,
		dbname
	];
	const result = spawnSync('pg_dump', args, {
		encoding: 'utf8',
		maxBuffer: 512 * 1024 * 1024,
		env: { ...process.env, PGPASSWORD: password }
	});
	stdout = result.stdout;
	if (result.error) {
		fail(`pg_dump failed: ${result.error.message} (is pg_dump installed?)`);
	}
	if (result.status !== 0) {
		fail(`pg_dump failed: ${result.stderr || 'unknown error'}`);
	}
}

if (!stdout.includes('PostgreSQL database dump')) {
	fail('pg_dump produced no recognizable output — nothing was written');
}

mkdirSync(path.dirname(outputFile), { recursive: true });
writeFileSync(outputFile, stdout);
console.log(`backup written: ${outputFile}`);
