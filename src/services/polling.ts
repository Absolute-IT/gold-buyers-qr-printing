import "dotenv/config";

/**
 * Polling Service
 * 
 * Continuously polls the API endpoint for label print requests.
 * Implements exponential backoff for network errors and graceful
 * error handling to maintain service resilience.
 */

/**
 * API response structure
 */
interface LabelCountResponse {
	count: number;
	timestamp: string;
}

/**
 * Callback function type for when labels need to be printed
 */
type PrintCallback = (count: number) => Promise<void>;

/**
 * Polling service configuration
 */
interface PollingConfig {
	apiEndpoint: string;
	pollInterval: number;
	maxRetries: number;
	retryDelay: number;
}

/**
 * Polling service state
 */
interface PollingState {
	isRunning: boolean;
	isPrinting: boolean;
	consecutiveErrors: number;
	lastPollTime: Date | null;
}

export class PollingService {
	private config: PollingConfig;
	private state: PollingState;
	private printCallback: PrintCallback;
	private pollTimer: NodeJS.Timeout | null = null;
	private shouldStop = false;

	constructor(printCallback: PrintCallback) {
		// Load configuration from environment
		this.config = {
			apiEndpoint: process.env.API_ENDPOINT || 'http://localhost:4000/v1/label-printer/count',
			pollInterval: parseInt(process.env.POLL_INTERVAL || '5000', 10),
			maxRetries: parseInt(process.env.MAX_RETRIES || '5', 10),
			retryDelay: parseInt(process.env.RETRY_DELAY || '5000', 10),
		};

		this.state = {
			isRunning: false,
			isPrinting: false,
			consecutiveErrors: 0,
			lastPollTime: null,
		};

		this.printCallback = printCallback;

		console.log('[Polling Service] Initialized with config:', {
			apiEndpoint: this.config.apiEndpoint,
			pollInterval: `${this.config.pollInterval}ms`,
			maxRetries: this.config.maxRetries,
			retryDelay: `${this.config.retryDelay}ms`,
		});
	}

	/**
	 * Start the polling service
	 */
	async start(): Promise<void> {
		if (this.state.isRunning) {
			console.log('[Polling Service] Already running');
			return;
		}

		this.shouldStop = false;
		this.state.isRunning = true;
		console.log('[Polling Service] Starting...');

		// Start first poll immediately
		await this.poll();

		// Schedule subsequent polls
		this.scheduleNextPoll();
	}

	/**
	 * Stop the polling service
	 */
	stop(): void {
		console.log('[Polling Service] Stopping...');
		this.shouldStop = true;
		this.state.isRunning = false;

		if (this.pollTimer) {
			clearTimeout(this.pollTimer);
			this.pollTimer = null;
		}

		console.log('[Polling Service] Stopped');
	}

	/**
	 * Schedule the next poll
	 */
	private scheduleNextPoll(): void {
		if (this.shouldStop || !this.state.isRunning) {
			return;
		}

		// Calculate delay with exponential backoff for errors
		let delay = this.config.pollInterval;
		if (this.state.consecutiveErrors > 0) {
			// Exponential backoff: retryDelay * 2^(errors - 1)
			const backoffMultiplier = Math.pow(2, Math.min(this.state.consecutiveErrors - 1, 5));
			delay = this.config.retryDelay * backoffMultiplier;
			console.log(`[Polling Service] Error backoff: ${delay}ms (${this.state.consecutiveErrors} errors)`);
		}

		this.pollTimer = setTimeout(async () => {
			await this.poll();
			this.scheduleNextPoll();
		}, delay);
	}

	/**
	 * Perform a single poll operation
	 */
	private async poll(): Promise<void> {
		// Don't poll if currently printing
		if (this.state.isPrinting) {
			console.log('[Polling Service] Skipping poll - currently printing');
			return;
		}

		try {
			this.state.lastPollTime = new Date();
			console.log(`[Polling Service] Polling at ${this.state.lastPollTime.toISOString()}`);

			const response = await this.fetchLabelCount();

			if (response.count > 0) {
				console.log(`[Polling Service] Print request received: ${response.count} labels`);
				await this.handlePrintRequest(response.count);
			} else {
				console.log('[Polling Service] No labels to print');
			}

			// Reset error counter on success
			if (this.state.consecutiveErrors > 0) {
				console.log('[Polling Service] Connection restored');
				this.state.consecutiveErrors = 0;
			}
		} catch (error) {
			this.handlePollError(error);
		}
	}

	/**
	 * Fetch label count from API
	 */
	private async fetchLabelCount(): Promise<LabelCountResponse> {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

		try {
			const response = await fetch(this.config.apiEndpoint, {
				method: 'GET',
				headers: {
					'Accept': 'application/json',
				},
				signal: controller.signal,
			});

			clearTimeout(timeout);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json() as LabelCountResponse;

			// Validate response structure
			if (typeof data.count !== 'number') {
				throw new Error('Invalid response: missing or invalid count field');
			}

			return data;
		} catch (error) {
			clearTimeout(timeout);
			throw error;
		}
	}

	/**
	 * Handle print request
	 */
	private async handlePrintRequest(count: number): Promise<void> {
		this.state.isPrinting = true;

		try {
			console.log(`[Polling Service] Starting print job: ${count} labels`);
			await this.printCallback(count);
			console.log(`[Polling Service] Print job completed successfully`);
		} catch (error) {
			console.error('[Polling Service] Print job failed:', error);
			// Don't increment error counter for print errors - continue polling
		} finally {
			this.state.isPrinting = false;
		}
	}

	/**
	 * Handle polling errors
	 */
	private handlePollError(error: unknown): void {
		this.state.consecutiveErrors++;

		const errorMessage = error instanceof Error ? error.message : String(error);

		if (error instanceof Error && error.name === 'AbortError') {
			console.error('[Polling Service] Request timeout');
		} else if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('ECONNREFUSED')) {
			console.error('[Polling Service] Network unavailable');
		} else {
			console.error('[Polling Service] Poll error:', errorMessage);
		}

		// Log warning if max retries exceeded
		if (this.state.consecutiveErrors >= this.config.maxRetries) {
			console.warn(
				`[Polling Service] Max retries (${this.config.maxRetries}) exceeded. ` +
				'Will continue retrying with exponential backoff.'
			);
		}
	}

	/**
	 * Get current service status
	 */
	getStatus(): Readonly<PollingState> {
		return { ...this.state };
	}
}
