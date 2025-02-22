import logger from './logger.js';

/**
 * TokenManager class to manage the 42 API access token
 * It fetches a new token when needed and notifies if the secret is close to expiring
 */
class TokenManager {
	constructor(client_id, client_secret) {
		this.client_id = client_id;
		this.client_secret = client_secret;
		this.access_token = null;
		this.expires_at = 0;
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
	}

	/**
	 * Get the current access token, or fetch a new one if the current one is expired
	 * it will also notify (by email) if the secret is about to expire.
	 * @returns {string} The current access token
	 */
	async getValidToken() {
		const now = Date.now();
		const secretTimeLeft = (this.expires_at - now) / 1000;

		if (this.secret_valid_until === 0) {
			logger.info('First time fetching access token');
		} else {
			for (const [threshold, message] of this.thresholds) {
				if (secretTimeLeft < threshold && !this.notifiedThresholds.has(threshold)) {
					logger.warn(`Secret expires in less than ${message}`);
					send_email("42 API Secret Expiry Alert", `Secret expires in less than ${message}`);
					this.notifiedThresholds.add(threshold);
				}
			}
		}
		if (!this.access_token || Date.now() > this.expires_at) {
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
			this.expires_at = Date.now() + data.expires_in * 1000;
			this.secret_valid_until = Date.now() + data.secret_valid_until * 1000;
			logger.info(`Fetched new access token (expires at ${new Date(this.expires_at)})`);
		}
		return this.access_token;
	}

}

export default TokenManager; 