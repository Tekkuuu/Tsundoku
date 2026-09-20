#!/usr/bin/env node
/**
 * Reset a user's password without an email service.
 *
 * The app has no self-service "forgot password" flow (homelab, no mail
 * configured), so recovery happens here with server/DB access:
 *
 *   npm run user:reset-password -- user@example.com
 *   npm run user:reset-password -- user@example.com "new-password-here"
 *
 * Omitting the password prompts for it with hidden input (preferred: keeps it
 * out of shell history). All existing sessions are revoked, forcing re-login.
 *
 * Requires DATABASE_URL (loaded from .env by the npm script).
 */
import readline from 'node:readline';
import { Writable } from 'node:stream';
import postgres from 'postgres';
import { hashPassword } from 'better-auth/crypto';

const MIN_PASSWORD_LENGTH = 8;

function fail(message) {
	console.error(`error: ${message}`);
	process.exit(1);
}

function promptHidden(query) {
	return new Promise((resolve) => {
		process.stdout.write(query);
		const muted = new Writable({
			write(_chunk, _encoding, callback) {
				callback();
			}
		});
		const rl = readline.createInterface({ input: process.stdin, output: muted, terminal: true });
		rl.question('', (answer) => {
			rl.close();
			process.stdout.write('\n');
			resolve(answer);
		});
	});
}

const args = process.argv.slice(2);
if (args[0] === '--') args.shift();
const email = args[0];
if (!email) {
	console.error('usage: npm run user:reset-password -- <email> [new-password]');
	process.exit(1);
}

let password = args[1];
if (password === undefined) {
	password = await promptHidden('New password: ');
}
if (!password || password.length < MIN_PASSWORD_LENGTH) {
	fail(`password must be at least ${MIN_PASSWORD_LENGTH} characters`);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) fail('DATABASE_URL is not set');

const sql = postgres(connectionString);

try {
	const users = await sql`SELECT id, email FROM "user" WHERE lower(email) = lower(${email})`;
	if (users.length === 0) fail(`no user found for ${email}`);
	const target = users[0];

	const accounts =
		await sql`SELECT id FROM account WHERE user_id = ${target.id} AND provider_id = 'credential'`;
	if (accounts.length === 0) {
		fail(`user ${target.email} has no password login (no credential account)`);
	}

	const hash = await hashPassword(password);
	await sql`UPDATE account SET password = ${hash} WHERE user_id = ${target.id} AND provider_id = 'credential'`;
	const revoked = await sql`DELETE FROM session WHERE user_id = ${target.id}`;

	console.log(`password reset for ${target.email} (revoked ${revoked.count} session(s))`);
} finally {
	await sql.end();
}
