import { createRequire } from 'node:module';
import pino from 'pino';

const require = createRequire(import.meta.url);

export const logger = pino({
	level: process.env.LOG_LEVEL || 'info',
	transport:
		process.env.NODE_ENV !== 'production'
			? {
					target: require.resolve('pino-pretty'),
					options: {
						colorize: true,
						translateTime: 'SYS:standard',
						ignore: 'pid,hostname'
					}
				}
			: undefined
});
