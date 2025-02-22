import nodemailer from 'nodemailer';
import axios from 'axios';

import logger from './logger.js';

/**
 * polling service that checks a 42 api endpoint and sends updates
 * via email about the response from the api.
 */
class PollingService {
	/**
	 * Create a new polling service
	 * @param {object} config - Configuration object
	 * @param {object} config.tokenManager - The token manager instance to use for fetching the 42 API token
	 * @param {object} config.api - The URL and params of the 42 API endpoint to check
	 * @param {number} [config.intervalMs=300000] - The interval in milliseconds between checks
	 * @param {object} config.smtp - SMTP server configuration
	 * @param {list} config.maillist - The email addresses to send updates to
	 * @param {function} config.composeEmail - A function that takes the API response and returns an email subject and body (returns null if no email should be sent)
	 */
	constructor(config) {
		this.tokenManager = config.tokenManager;
		this.api = config.api;
		this.intervalMs = config.intervalMs || 5 * 60 * 1000; // Default 5 minutes
		this.isRunning = false;
		this.lastCheck = null;
		this.maillist = config.maillist;
		this.composeEmail = config.composeEmail;
		
		// Email configuration
		this.mailer = nodemailer.createTransport({
			host: config.smtp.host,
			port: config.smtp.port,
			// secure: config.smtp.secure,
			auth: {
				user: config.smtp.user,
				pass: config.smtp.pass
			}
		});
	}

	async checkEndpoint() {
		try {
			const token = await this.tokenManager.getValidToken();
			// logger.debug(`token ${token}`);
			const response = await axios.get(this.api.endpoint, {
					params: this.api.params,
					headers: {
						'Authorization': `Bearer ${token}`
					}
			});

			return response.data;
		} catch (error) {
			logger.error(`Error checking endpoint: ${error}`);
			throw error;
		}
	}

	async sendEmail(subject, body) {
		const mailOptions = {
			from: 'bingobongo',
			to: this.maillist,
			subject: subject,
			text: body,
		};

		try {
			await this.mailer.sendMail(mailOptions);
			logger.info('Email sent successfully');
		} catch (error) {
			logger.error(`Error sending email: ${error}`);
			throw error;
		}
	}

	async poll() {
		if (!this.isRunning) return;

		try {
			this.lastCheck = new Date();
			const data = await this.checkEndpoint();
			
			const emailContent = this.composeEmail(data);
			if (emailContent?.subject && emailContent?.body) {
				await this.sendEmail(emailContent.subject, emailContent.body);
			}
			
		} catch (error) {
			logger.error(`Polling error: ${error}`);
		} finally {
			// Schedule next poll only after current one is complete
			if (this.isRunning) {
				setTimeout(() => this.poll(), this.intervalMs);
			}
		}
	}

	start() {
		if (this.isRunning) return;
		
		this.isRunning = true;
		logger.info('Polling service started');
		this.poll(); // Start first poll immediately
	}

	stop() {
		this.isRunning = false;
		logger.info('Polling service stopped');
	}
}

export default PollingService;