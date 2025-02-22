import winston from 'winston';

// Custom format that adds brackets around the timestamp
const consoleFormat = winston.format.printf(({ level, message, timestamp }) => {
	let format = `[${timestamp}] ${level}: ${message}`;
	return format;
});

// Create a logger instance
export const logger = winston.createLogger({
	levels: winston.config.npm.levels, // { error: 0, warn: 1, info: 2, verbose: 3, debug: 4, silly: 5 }

	// default format
	format: winston.format.combine(
		winston.format.timestamp({
			format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' // ISO 8601 format
		}),
		winston.format.errors({ stack: true }),  // to log the stack trace
		winston.format.splat(),
		winston.format.json()
	),

	// Define different transports i.e., where logs will be written
	transports: [
		// stdout transport
		new winston.transports.Console({
			level: 'debug',
			format: winston.format.combine(
				winston.format.colorize(),
				// winston.format.simple(),
				consoleFormat // custom line print format
			),
			silent: process.env.NODE_ENV === 'production'
		}),
		// File transport
		new winston.transports.File({
			filename: '/tmp/logs/error.log',
			level: 'error',  // Only log errors and above
		}),
		new winston.transports.File({ 
			filename: '/tmp/logs/combined.log',
			level: 'info',  // Log everything from info level and above
		})
	]
});

// Example of logging different levels
// logger.debug('Debugging info');
// logger.verbose('Verbose info');
// logger.info('Hello world');
// logger.warn('Warning message');
// logger.error('Error info');

export default logger;