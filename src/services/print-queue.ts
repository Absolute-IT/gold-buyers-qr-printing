import { v7 } from "uuid";
import Generator from "#classes/generator";

/**
 * Print Queue Manager
 * 
 * Manages the printing of QR code labels. Generates unique GBTID
 * codes and sends them to the Brother label printer sequentially.
 */

/**
 * Generate a random alphanumeric ID (8 characters)
 * Omits 'O' to avoid confusion with '0'
 */
function randomString(length: number): string {
	const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ0123456789';
	let result = '';
	for (let i = length; i > 0; --i) {
		result += chars[Math.floor(Math.random() * chars.length)];
	}
	return result;
}

export class PrintQueueManager {
	private generator: Generator;
	private isPrinting = false;

	constructor() {
		this.generator = new Generator();
	}

	/**
	 * Print a batch of labels
	 * 
	 * @param count Number of labels to print (1-500)
	 * @throws Error if count is invalid or printing fails
	 */
	async printLabels(count: number): Promise<void> {
		// Validate count
		if (count < 1 || count > 500) {
			throw new Error('Count must be between 1 and 500');
		}

		if (this.isPrinting) {
			throw new Error('Already printing');
		}

		this.isPrinting = true;
		const startTime = Date.now();

		try {
			console.log(`[Print Queue] Starting batch print: ${count} labels`);

			// Print each label sequentially
			for (let i = 0; i < count; i++) {
				await this.printSingleLabel(i + 1, count);
			}

			const duration = ((Date.now() - startTime) / 1000).toFixed(2);
			console.log(`[Print Queue] Batch completed: ${count} labels in ${duration}s`);
		} catch (error) {
			console.error('[Print Queue] Batch print failed:', error);
			throw error;
		} finally {
			this.isPrinting = false;
		}
	}

	/**
	 * Print a single label
	 */
	private async printSingleLabel(current: number, total: number): Promise<void> {
		try {
			// Generate unique GBTID
			const uuid = v7();
			const humanId = randomString(8);
			const gbtid = `gbtid://${uuid}:${humanId}`;

			console.log(`[Print Queue] Printing label ${current}/${total}: ${humanId} (${uuid})`);

			// Print the label
			await this.generator.print(gbtid, humanId);

			console.log(`[Print Queue] Label ${current}/${total} printed successfully`);
		} catch (error) {
			console.error(`[Print Queue] Failed to print label ${current}/${total}:`, error);
			
			// Check if it's a printer error
			if (error instanceof Error) {
				if (error.message.includes('printer') || error.message.includes('Brother')) {
					throw new Error(`Printer error on label ${current}/${total}: ${error.message}`);
				}
			}
			
			throw error;
		}
	}

	/**
	 * Check if currently printing
	 */
	isBusy(): boolean {
		return this.isPrinting;
	}

	/**
	 * Check printer status (optional diagnostic)
	 */
	async checkPrinter(): Promise<void> {
		try {
			console.log('[Print Queue] Checking printer status...');
			const status = await this.generator.checkPrinterStatus();
			console.log('[Print Queue] Printer is ready:', {
				model: status.printer.capabilities.model,
				media: `${status.status.mediaWidth}mm ${status.status.mediaType}`,
				label: status.detectedLabel,
			});
		} catch (error) {
			console.error('[Print Queue] Printer check failed:', error);
			throw error;
		}
	}
}
