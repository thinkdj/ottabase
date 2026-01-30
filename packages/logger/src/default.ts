import { Logger } from './logger.js';

/**
 * Default logger instance
 * Can be used directly for simple logging needs
 */
const defaultLogger = new Logger({
    level: 1, // INFO
});

export default defaultLogger;
