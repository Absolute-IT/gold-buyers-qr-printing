import "dotenv/config";
import { PrintQueueManager } from "./services/print-queue.js";

/**
 * Immediate print mode — bypasses polling and prints a fixed number of labels directly.
 * Count is read from the PRINT_COUNT environment variable (set via the npm script).
 */

const count = parseInt(process.env.PRINT_COUNT ?? "", 10);

if (isNaN(count) || count < 1) {
	console.error("[Print] PRINT_COUNT must be a positive integer");
	process.exit(1);
}

async function main(): Promise<void> {
	console.log("========================================");
	console.log("Gold Buyers Label Printer — Immediate Print");
	console.log("========================================");
	console.log(`Printing ${count} label${count === 1 ? "" : "s"} now...`);
	console.log("========================================\n");

	const printQueue = new PrintQueueManager();

	try {
		console.log("[Print] Checking printer connection...");
		await printQueue.checkPrinter();
		console.log("[Print] Printer check successful\n");
	} catch (error) {
		console.error("[Print] Printer check failed:", error);
		process.exit(1);
	}

	try {
		await printQueue.printLabels(count);
		console.log("[Print] Done.");
	} catch (error) {
		console.error("[Print] Print job failed:", error);
		process.exit(1);
	}
}

main().catch((error) => {
	console.error("[Print] Fatal error:", error);
	process.exit(1);
});
