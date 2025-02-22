import nodemailer from 'nodemailer';

import logger from './logger.js';

/**
 * TokenManager class to manage the 42 API access token
 * It fetches a new token when needed and notifies if the secret is close to expiring
 */
class TokenManager {
	/**
	 * Create a new TokenManager
	 * @param {string} client_id - The 42 API client ID
	 * @param {string} client_secret - The 42 API client secret
	 * @param {object} smtp - SMTP server configuration
	 */
	constructor(client_id, client_secret, smtp) {
		this.client_id = client_id;
		this.client_secret = client_secret;
		this.smtp = smtp;
		this.access_token = null;
		this.token_valid_until = 0;
		this.secret_valid_until = 0;
		this.thresholds = [
			[604800, 'ONE WEEK'],
			[86400, 'ONE DAY'],
			[3600, 'ONE HOUR'],
			[600, 'TEN MINUTES'],
			[60, 'ONE MINUTE'],
			[1, 'ONE SECOND... EXPIRES NOW!!!'],
		];
		this.notifiedThresholds = new Set();

		// Email configuration
		this.mailer = nodemailer.createTransport({
			host: smtp.host,
			port: smtp.port,
			// secure: smtp.secure,
			auth: {
				user: smtp.user,
				pass: smtp.pass
			}
		});
	}

	/**
	 * Get the current access token, or fetch a new one if the current one is expired
	 * it will also notify (by email) if the secret is about to expire.
	 * @returns {string} The current access token
	 */
	async getValidToken() {
		const now = Date.now();
		const secretTimeLeft = (this.secret_valid_until - now) / 1000;

		if (this.secret_valid_until === 0) {
			logger.info('First time fetching access token');
		} else {
			for (const [threshold, message] of this.thresholds) {
				if (secretTimeLeft < threshold && !this.notifiedThresholds.has(threshold)) {
					logger.warn(`Secret expires in less than ${message}`);
					logger.debug(`Secret expires in ${secretTimeLeft} seconds`);
					logger.debug(`Expires at ${new Date(this.secret_valid_until)} (${this.secret_valid_until})`);
					// this.sendEmail("42 API Secret Expiry Alert", `Secret expires in less than ${message}`);
					this.notifiedThresholds.add(threshold);
				}
			}
		}
		if (!this.access_token || Date.now() > this.token_valid_until) {
			return await this.fetchNewToken();
		}
		return this.access_token;
	}

	/**
	 * Fetch a new access token from the 42 API and store it
	 * @returns {string} The new access token
	 */
	async fetchNewToken() {
		const response = await fetch('https://api.intra.42.fr/oauth/token', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				grant_type: 'client_credentials',
				client_id: this.client_id,
				client_secret: this.client_secret,
			}),
		});
		const data = await response.json();
		if (!response.ok) {
			logger.error(`Failed to fetch access token: ${response.status} ${response.statusText} ${data.error}: ${data.message}`);
			return null;
		} else if (data.access_token) {
			this.access_token = data.access_token;
			this.token_valid_until = Date.now() + data.expires_in * 1000;
			this.secret_valid_until = Date.now() + data.secret_valid_until * 1000;
			logger.info(`Fetched new access token (expires at ${new Date(this.token_valid_until)})`);
		}
		return this.access_token;
	}

	/**
	 * Send an email notification
	 * @param {string} subject - The email subject
	 * @param {string} body - The email body
	 */
	async sendEmail(subject, body) {
		const mailOptions = {
			from: 'bingobongo',
			to: this.smtp.user,
			subject: subject,
			text: body,
		};

		try {
			await this.mailer.sendMail(mailOptions);
			logger.info('Secret expiry email sent successfully');
		} catch (error) {
			logger.error(`Error sending secret expiry email: ${error}`);
			throw error;
		}
	}

}

export default TokenManager; 