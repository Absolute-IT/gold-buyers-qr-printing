import "dotenv/config";

import { v7 } from "uuid";

import Generator from "#classes/generator";

const generator = new Generator();

// Example usage - uncomment the one you want to use:

// 1. Print an existing image file
//await generator.printFile("./images/019907e3-dde8-70a3-814f-6f7bf007c970.png");

// 2. Generate and print a QR code (without text label)
// await generator.print("https://example.com");

// 3. Generate and print a QR code with human-readable ID below
// await generator.print("https://example.com", "ID-12345");

// 4. Check printer status before printing
// const status = await generator.checkPrinterStatus();
// console.log('Printer is ready!', status);

function randomString(length: number) {
	const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ0123456789'; // O is omitted to avoid confusion with 0
    var result = '';
    for (var i = length; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
    return result;
}

for (let i = 0; i < 10; i++) {
	const id = randomString(8);
	await generator.print(`gbtid://${v7()}:${id}`, id);
}