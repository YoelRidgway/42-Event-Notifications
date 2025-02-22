import express from 'express';
import cors from 'cors';

import logger from './logger.js';
import TokenManager from './tokenManager.js';
import PollingService from './pollingService.js';
import { composeNewEventsEmail } from './eventChecking.js';

// Create an instance of express
const app = express();
const port = 3000;

const corsOptions = {
	origin: "*"
};

app.use(cors(corsOptions));

const SMTP = {
	host: process.env.SMTP_HOST,
	port: process.env.SMTP_PORT,
	user: process.env.SMTP_USER,
	pass: process.env.SMTP_PASS
};

const tokenManager = new TokenManager(process.env.CLIENT_ID, process.env.CLIENT_SECRET, SMTP);

const pollingService = new PollingService({
	tokenManager,
	api: {
		endpoint: 'https://api.intra.42.fr/v2/campus/1/events/', // 42 paris campus events
		params: {
			sort: '-id'
		}
	},
	intervalMs: 5 * 60 * 1000, // 5 minutes
	smtp: SMTP,
	maillist: [
		'yoelive@gmail.com',
		'yoelridgway@gmail.com',
	],
	composeEmail: composeNewEventsEmail
});

pollingService.start();

app.get('/subscribe/:id', (req, res) => {
});

app.get('/unsubscribe/:id', (req, res) => {
});

app.get('*', (req, res) => {
	logger.warn("404 REQUEST: " + req.url)
	res.status(404).send("Not Found");
});

app.listen(port, () => {
	logger.info(`Server is running on http://localhost:${port}`);
});

const gracefulShutdown = () => {
	logger.info('Server is shutting down');
	// stop polling service
	pollingService.stop();
	logger.info('Server shutdown complete');
	process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);