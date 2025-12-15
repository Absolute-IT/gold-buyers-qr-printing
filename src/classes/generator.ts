import { 
	printPngFileAuto, 
	detectSingleBrotherPrinter,
	queryPrinterStatus,
	hasStatusError,
	getStatusErrorMessage,
	detectLabelWidth,
	type LabelWidth
} from "node-brother-label-printer";
import QRCode from "qrcode-esm";
import { v7 } from "uuid";
import { createCanvas, loadImage } from "canvas";
import fs from "fs";

class Generator {
	constructor() {
		
	}

	async generateQRCode(input: string) {
		const id = v7();
		await QRCode.toFile(`./images/${id}.png`, input, {
			width: 720,
			margin: 1,
		});
		return `./images/${id}.png`;
	}

	/**
	 * Add text label to an existing QR code image
	 */
	async addTextToImage(imagePath: string, text: string): Promise<string> {
		// Load the original QR code image
		const originalImage = await loadImage(imagePath);
		
		const fontSize = 140;
		const padding = 15;
		const textHeight = fontSize + padding * 2;
		
		// Create a new canvas with extra height for text
		const canvas = createCanvas(originalImage.width, originalImage.height + textHeight);
		const ctx = canvas.getContext('2d');
		
		// Fill entire canvas with white background
		ctx.fillStyle = 'white';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		
		// Draw the original QR code at the top
		ctx.drawImage(originalImage, 0, 0);
		
		// Set text properties
		ctx.fillStyle = 'black';
		ctx.font = `${fontSize}px monospace`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		
		// Draw the text centered below the QR code
		const textX = canvas.width / 2;
		const textY = originalImage.height + padding + (fontSize / 2);
		ctx.fillText(text, textX, textY);
		
		// Save the new image (overwrite the original)
		const buffer = canvas.toBuffer('image/png');
		fs.writeFileSync(imagePath, buffer);
		
		return imagePath;
	}

	/**
	 * Detect current label width from printer
	 */
	private async detectCurrentLabelWidth(): Promise<LabelWidth> {
		try {
			const printer = detectSingleBrotherPrinter();
			if (!printer) {
				console.warn('No Brother printer detected, using fallback label width');
				return "62-mm-wide continuous";
			}

			// Type assertion required as device is typed as 'unknown' to avoid USB dependency
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/no-explicit-any
			const status = await queryPrinterStatus(printer.device as any);
			
			if (hasStatusError(status)) {
				const errorMsg = getStatusErrorMessage(status);
				console.warn(`Printer error during label detection: ${errorMsg}, using fallback`);
				return "62-mm-wide continuous";
			}

			const detectedLabel = detectLabelWidth(status);
			if (detectedLabel) {
				console.log(`Detected label width: ${detectedLabel}`);
				return detectedLabel;
			}

			console.warn('Could not detect label width, using fallback');
			return "62-mm-wide continuous";
		} catch (error) {
			console.warn('Label detection failed:', error, '- using fallback');
			return "62-mm-wide continuous";
		}
	}

	/**
	 * Print a PNG file using auto-detection for printer and media
	 */
	async printFile(filename: string) {
		try {
			// Detect current label width before each print
			const labelWidth = await this.detectCurrentLabelWidth();
			
			// Use the new auto-detection API (recommended)
			await printPngFileAuto({
				filename: filename,
				options: { 
					landscape: false,
					labelWidth: labelWidth,
					blackwhiteThreshold: 128
				}
			});
			console.log(`✓ Print job sent successfully: ${filename}`);
		} catch (error) {
			console.error(`✗ Print failed:`, error);
			throw error;
		}
	}

	/**
	 * Generate QR code and print it
	 * @param input - The data to encode in the QR code
	 * @param humanReadableId - Optional text to display below the QR code
	 */
	async print(input: string, humanReadableId?: string) {
		const filename = await this.generateQRCode(input);
		
		// Add text below QR code if provided
		if (humanReadableId) {
			await this.addTextToImage(filename, humanReadableId);
		}
		
		await this.printFile(filename);
	}

	/**
	 * Check printer status before printing (optional diagnostic method)
	 */
	async checkPrinterStatus() {
		const printer = detectSingleBrotherPrinter();
		if (!printer) {
			throw new Error('No Brother printer detected. Please ensure printer is connected and in printer mode.');
		}

		console.log(`Found printer: ${printer.capabilities.model}`);
		console.log(`Printer mode: ${printer.isInPrinterMode ? '✓ Ready' : '✗ Mass Storage Mode'}`);

		// Type assertion required as device is typed as 'unknown' to avoid USB dependency
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/no-explicit-any
		const status = await queryPrinterStatus(printer.device as any);
		
		if (hasStatusError(status)) {
			const errorMsg = getStatusErrorMessage(status);
			console.error(`Printer error: ${errorMsg}`);
			throw new Error(errorMsg || 'Unknown printer error');
		}

		console.log(`Media: ${status.mediaWidth}mm ${status.mediaType}`);
		
		const detectedLabel = detectLabelWidth(status);
		if (detectedLabel) {
			console.log(`Detected label: ${detectedLabel}`);
		}

		return { printer, status, detectedLabel };
	}
}

export default Generator;