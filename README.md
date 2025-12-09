# Gold Buyers QR Code Label Printer

Automated QR code label printing service for Gold Buyers item tracking system. Interfaces with a Brother label printer via Raspberry Pi to print GBTID (Gold Buyers Tracking ID) labels on demand.

## Overview

This service continuously polls the Gold Buyers API for label print requests and automatically prints QR code labels when requested through the web application. Each label contains a unique GBTID consisting of a UUIDv7 and a human-readable alphanumeric ID.

### Features

- **On-Demand Printing**: Print labels directly from the Gold Buyers web app
- **Continuous Polling**: Automatically checks for print requests every 15 seconds
- **Robust Error Handling**: Gracefully handles network outages and printer errors
- **Auto-Updates**: Daily automatic updates from GitHub repository
- **PM2 Process Management**: Automatic restart on failure and boot persistence
- **Production Ready**: Designed for 24/7 operation on Raspberry Pi

## Hardware Requirements

- **Raspberry Pi** (Model 3B+ or newer recommended)
- **Brother Label Printer** (QL-700, QL-800, or compatible model)
- **USB Cable** to connect printer to Raspberry Pi
- **Network Connection** (WiFi or Ethernet)
- **Label Media**: 62mm continuous tape recommended

## Quick Start

### Automated Installation (Recommended)

SSH into your Raspberry Pi and run:

```bash
curl -fsSL https://raw.githubusercontent.com/Absolute-IT/gold-buyers-qr-printing/main/scripts/pi-setup.sh | sudo bash -s -- "https://api.goldbuyers.com.au"
```

Replace `https://api.goldbuyers.com.au` with your actual API base URL.

This script will:
1. Install Node.js 20.x, pnpm, and PM2
2. Clone this repository
3. Install dependencies and build the project
4. Configure the API endpoint
5. Start the service with PM2
6. Setup automatic updates (daily at 2:00 AM)
7. Configure the service to start on boot

### Manual Installation

If you prefer to install manually:

1. **Install dependencies:**
   ```bash
   # Install Node.js 20.x
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
   sudo apt-get install -y nodejs
   
   # Install pnpm and PM2
   sudo npm install -g pnpm pm2
   ```

2. **Clone and setup:**
   ```bash
   sudo mkdir -p /opt/gb-label-printer
   sudo chown $USER:$USER /opt/gb-label-printer
   cd /opt/gb-label-printer
   git clone https://github.com/Absolute-IT/gold-buyers-qr-printing.git .
   pnpm install
   ```

3. **Configure environment:**
   ```bash
   cat > .env <<EOF
   API_ENDPOINT=https://api.goldbuyers.com.au/v1/label-printer/count
   POLL_INTERVAL=15000
   MAX_RETRIES=5
   RETRY_DELAY=5000
   NODE_ENV=production
   EOF
   ```

4. **Build and start:**
   ```bash
   pnpm build
   pm2 start ecosystem.config.cjs
   pm2 save
   pm2 startup
   ```

## Configuration

### Environment Variables

Create a `.env` file in the project root:

| Variable | Description | Default |
|----------|-------------|---------|
| `API_ENDPOINT` | URL to poll for print requests | `http://localhost:4000/v1/label-printer/count` |
| `POLL_INTERVAL` | Time between polls in milliseconds | `15000` (15 seconds) |
| `MAX_RETRIES` | Maximum consecutive errors before warning | `5` |
| `RETRY_DELAY` | Base delay for exponential backoff (ms) | `5000` (5 seconds) |
| `NODE_ENV` | Environment (production/development) | `production` |

### API Endpoint

The service expects a JSON response from the API endpoint:

```json
{
  "count": 10,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

- `count`: Number of labels to print (0-500)
- `timestamp`: ISO 8601 timestamp

The API automatically resets the count to 0 after the service reads it.

## Usage

### Service Management

```bash
# View service status
pm2 status

# View live logs
pm2 logs gb-label-printer

# Restart service
pm2 restart gb-label-printer

# Stop service
pm2 stop gb-label-printer

# Start service
pm2 start gb-label-printer
```

### Manual Testing

For testing without PM2:

```bash
# Build and run once
pnpm build
pnpm start

# Run in development mode with debug output
pnpm start:dev
```

### Viewing Logs

```bash
# PM2 managed logs
pm2 logs gb-label-printer

# System logs
tail -f /var/log/gb-label-printer-combined.log
tail -f /var/log/gb-label-printer-error.log
tail -f /var/log/gb-label-printer-out.log

# Auto-update logs
tail -f /var/log/gb-label-printer-update.log
```

## How It Works

### Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  Gold Buyers    │  HTTP   │  Raspberry Pi    │   USB   │  Brother        │
│  Web App        │────────▶│  Polling Service │────────▶│  Label Printer  │
│                 │         │                  │         │                 │
└─────────────────┘         └──────────────────┘         └─────────────────┘
       │                             │
       │ User clicks "Print Labels"  │
       │ (10 labels)                 │
       │                             │
       └────────────────────────────▶│ API stores count=10
                                     │
                                     │ Service polls every 15s
                                     │
                                     │ Receives count=10
                                     │
                                     │ Generates 10 unique GBTIDs
                                     │
                                     └────────────────────────▶ Prints labels
```

### Polling Cycle

1. **Poll**: Service requests count from API endpoint
2. **Receive**: API returns count and resets to 0
3. **Print**: If count > 0, generate and print labels sequentially
4. **Wait**: Sleep for poll interval (default 15 seconds)
5. **Repeat**: Return to step 1

### Label Format

Each label contains:
- **QR Code**: Encodes `gbtid://[UUIDv7]:[8-char-ID]`
- **Human-Readable ID**: 8-character alphanumeric below QR code

Example:
```
gbtid://0199b901-a24c-730e-8191-31b929420d35:RR4HA3W8
```

### Error Handling

The service implements robust error handling:

- **Network Errors**: Exponential backoff retry (5s → 10s → 20s → 40s → 80s)
- **Printer Errors**: Log error and continue polling
- **API Errors**: Log warning and continue polling
- **Invalid Responses**: Reset count to 0 and continue

The service never crashes - it continues retrying indefinitely.

## Auto-Updates

The service automatically updates daily at 2:00 AM:

1. `git pull origin main` - Pull latest code
2. `pnpm install` - Update dependencies
3. Wait 30 minutes - Allow build to complete
4. `pm2 restart gb-label-printer` - Restart service

To manually trigger an update:

```bash
cd /opt/gb-label-printer
git pull origin main
pnpm install
pnpm build
pm2 restart gb-label-printer
```

## Troubleshooting

### Service Not Starting

```bash
# Check PM2 status
pm2 status

# View error logs
pm2 logs gb-label-printer --err

# Check if printer is connected
lsusb | grep Brother

# Restart service
pm2 restart gb-label-printer
```

### Printer Not Found

```bash
# Check USB connection
lsusb

# Check printer mode (should be in Printer mode, not Mass Storage)
# Press and hold Feed button while powering on to toggle modes

# Verify printer permissions
ls -l /dev/bus/usb/
```

### Network Issues

```bash
# Test API endpoint
curl https://api.goldbuyers.com.au/v1/label-printer/count

# Check network connectivity
ping google.com

# View network-related errors
pm2 logs gb-label-printer | grep -i "network\|enotfound\|econnrefused"
```

### Labels Not Printing

```bash
# Check printer status in logs
pm2 logs gb-label-printer | grep -i "printer"

# Verify label media is loaded
# Check Brother printer display for errors

# Try manual print test
cd /opt/gb-label-printer
pnpm start:dev
# Then submit print request from web app
```

### Service Logs Full

```bash
# Clear PM2 logs
pm2 flush gb-label-printer

# Clear system logs
sudo truncate -s 0 /var/log/gb-label-printer-*.log
```

## Development

### Local Development

```bash
# Install dependencies
pnpm install

# Create .env file
cp .env.example .env
# Edit .env with your settings

# Build
pnpm build

# Run in development mode
pnpm start:dev
```

### Project Structure

```
qr-code-printing/
├── src/
│   ├── classes/
│   │   └── generator.ts        # QR code generation and printing
│   ├── services/
│   │   ├── polling.ts          # API polling service
│   │   └── print-queue.ts      # Print job management
│   ├── types/
│   │   └── *.d.ts              # TypeScript definitions
│   └── index.ts                # Main entry point
├── scripts/
│   └── pi-setup.sh             # Raspberry Pi setup script
├── ecosystem.config.cjs        # PM2 configuration
├── package.json
├── tsconfig.json
└── README.md
```

### Testing

```bash
# Lint code
pnpm lint

# Fix linting issues
pnpm fix

# Build
pnpm build
```

## Security

- **API Endpoint**: Public endpoint (no authentication required)
- **Data Exposure**: Only label count (non-sensitive)
- **Network**: Can be restricted by IP at infrastructure level
- **Permissions**: Service runs as normal user (not root)

## Performance

- **Polling Frequency**: 240 requests/hour (15s interval)
- **Print Speed**: ~2-3 seconds per label
- **Memory Usage**: ~50-100 MB
- **CPU Usage**: Minimal (<5% on Pi 3B+)

## Support

### Common Issues

1. **Labels printing with wrong size**: Check media type settings in `generator.ts`
2. **QR codes not scanning**: Ensure `width: 720` in QR generation
3. **Service stops after reboot**: Run `pm2 startup` and follow instructions

### Getting Help

- Check logs: `pm2 logs gb-label-printer`
- Review printer manual for media settings
- Ensure Brother printer is in Printer mode (not Mass Storage)

## License

ISC

## Author

Matthew Scott

## Repository

https://github.com/Absolute-IT/gold-buyers-qr-printing
