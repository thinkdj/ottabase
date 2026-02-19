import { Logger } from './logger.js';

/**
 * Default logger instance.
 * Uses Console transport (console.debug / info / warn / error) so logs appear in
 * browser DevTools, Node.js, and Cloudflare Workers. Safe for client and server.
 */
const defaultLogger = new Logger({
    level: 1, // INFO
});

export default defaultLogger;
