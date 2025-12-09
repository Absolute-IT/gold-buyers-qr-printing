import "dotenv/config";
import { PollingService } from "./services/polling.js";
import { PrintQueueManager } from "./services/print-queue.js";

/**
 * Gold Buyers Label Printer Service
 * 
 * Continuously polls the Gold Buyers API for label print requests
 * and prints QR code labels on demand using a Brother label printer.
 */

// Initialize services
const printQueue = new PrintQueueManager();
const pollingService = new PollingService(async (count: number) => {
	await printQueue.printLabels(count);
});

/**
 * Graceful shutdown handler
 */
async function shutdown(signal: string): Promise<void> {
	console.log(`\n[Main] Received ${signal}, shutting down gracefully...`);
	
	// Stop polling
	pollingService.stop();
	
	// Wait for any ongoing print job to complete
	const status = pollingService.getStatus();
	if (status.isPrinting) {
		console.log('[Main] Waiting for current print job to complete...');
		// Wait up to 60 seconds for print job
		const maxWait = 60000;
		const startWait = Date.now();
		while (pollingService.getStatus().isPrinting && (Date.now() - startWait) < maxWait) {
			await new Promise(resolve => setTimeout(resolve, 1000));
		}
	}
	
	console.log('[Main] Shutdown complete');
	process.exit(0);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
	console.log('========================================');
	console.log('Gold Buyers Label Printer Service');
	console.log('========================================');
	console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
	console.log(`API Endpoint: ${process.env.API_ENDPOINT || 'not configured'}`);
	console.log('========================================\n');

	// Setup graceful shutdown handlers
	process.on('SIGINT', () => shutdown('SIGINT'));
	process.on('SIGTERM', () => shutdown('SIGTERM'));

	// Check printer before starting
	try {
		console.log('[Main] Checking printer connection...');
		await printQueue.checkPrinter();
		console.log('[Main] Printer check successful\n');
	} catch (error) {
		console.error('[Main] Warning: Printer check failed:', error);
		console.log('[Main] Service will start anyway and retry on first print request\n');
	}

	// Start polling service
	try {
		await pollingService.start();
		console.log('[Main] Service started successfully');
		console.log('[Main] Press Ctrl+C to stop\n');
	} catch (error) {
		console.error('[Main] Failed to start service:', error);
		process.exit(1);
	}
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
	console.error('[Main] Uncaught exception:', error);
	// Don't exit - let service continue running
});

process.on('unhandledRejection', (reason, promise) => {
	console.error('[Main] Unhandled rejection at:', promise, 'reason:', reason);
	// Don't exit - let service continue running
});

// Start the service
main().catch((error) => {
	console.error('[Main] Fatal error:', error);
	process.exit(1);
});