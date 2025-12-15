#!/bin/bash

################################################################################
# Gold Buyers Label Printer - Raspberry Pi Setup Script
#
# This script automates the complete setup of the label printing service
# on a Raspberry Pi. It will:
# - Install Node.js, pnpm, and PM2
# - Clone the repository
# - Configure the service
# - Setup automatic updates
# - Start the service with PM2
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Absolute-IT/gold-buyers-qr-printing/main/scripts/pi-setup.sh | sudo bash -s -- "https://api.goldbuyers.com.au"
#
# Or download and run locally:
#   chmod +x pi-setup.sh
#   sudo ./pi-setup.sh "https://api.goldbuyers.com.au"
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE_URL="${1:-https://api.goldbuyers.com.au}"
API_ENDPOINT="${API_BASE_URL}/v1/label-printer/count"
INSTALL_DIR="/opt/gb-label-printer"
REPO_URL="https://github.com/Absolute-IT/gold-buyers-qr-printing.git"
SERVICE_USER="${SUDO_USER:-$USER}"

# Functions
print_header() {
    echo ""
    echo -e "${BLUE}==========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}==========================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_error "This script must be run as root (use sudo)"
    exit 1
fi

print_header "Gold Buyers Label Printer Setup"

echo "Configuration:"
echo "  API Base URL: ${API_BASE_URL}"
echo "  API Endpoint: ${API_ENDPOINT}"
echo "  Install Directory: ${INSTALL_DIR}"
echo "  Service User: ${SERVICE_USER}"
echo ""
read -p "Continue with installation? (y/N) " -n 1 -r </dev/tty
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_info "Installation cancelled"
    exit 0
fi

# Update system
print_header "Updating System Packages"
apt-get update
apt-get upgrade -y
print_success "System updated"

# Install Node.js 20.x
print_header "Installing Node.js 20.x"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    print_info "Node.js already installed: ${NODE_VERSION}"
    
    # Check if it's the right version
    if [[ ! "$NODE_VERSION" =~ ^v20\. ]]; then
        print_info "Upgrading to Node.js 20.x..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    fi
else
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
print_success "Node.js installed: $(node -v)"
print_success "npm installed: $(npm -v)"

# Install pnpm globally
print_header "Installing pnpm"
if command -v pnpm &> /dev/null; then
    print_info "pnpm already installed: $(pnpm -v)"
else
    npm install -g pnpm
    print_success "pnpm installed: $(pnpm -v)"
fi

# Install PM2 globally
print_header "Installing PM2"
if command -v pm2 &> /dev/null; then
    print_info "PM2 already installed: $(pm2 -v)"
else
    npm install -g pm2
    print_success "PM2 installed: $(pm2 -v)"
fi

# Install git if not present
if ! command -v git &> /dev/null; then
    print_header "Installing Git"
    apt-get install -y git
    print_success "Git installed"
fi

# Create installation directory
print_header "Setting up Installation Directory"
if [ -d "${INSTALL_DIR}" ]; then
    print_info "Directory ${INSTALL_DIR} already exists"
    read -p "Remove existing installation and reinstall? (y/N) " -n 1 -r </dev/tty
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Stop and delete PM2 process if it exists
        su - ${SERVICE_USER} -c "pm2 delete gb-label-printer" 2>/dev/null || true
        rm -rf ${INSTALL_DIR}
        print_success "Removed existing installation"
    else
        print_info "Updating existing installation..."
        cd ${INSTALL_DIR}
        su - ${SERVICE_USER} -c "cd ${INSTALL_DIR} && git pull origin main"
        print_success "Updated repository"
    fi
fi

if [ ! -d "${INSTALL_DIR}" ]; then
    mkdir -p ${INSTALL_DIR}
    chown ${SERVICE_USER}:${SERVICE_USER} ${INSTALL_DIR}
    print_success "Created installation directory"
    
    # Clone repository
    print_header "Cloning Repository"
    su - ${SERVICE_USER} -c "git clone ${REPO_URL} ${INSTALL_DIR}"
    print_success "Repository cloned"
fi

cd ${INSTALL_DIR}

# Install dependencies
print_header "Installing Dependencies"
su - ${SERVICE_USER} -c "cd ${INSTALL_DIR} && pnpm install"
print_success "Dependencies installed"

# Create .env file
print_header "Creating Configuration File"
cat > ${INSTALL_DIR}/.env <<EOF
# API Configuration
API_ENDPOINT=${API_ENDPOINT}

# Polling Configuration
POLL_INTERVAL=15000

# Retry Configuration
MAX_RETRIES=5
RETRY_DELAY=5000

# Environment
NODE_ENV=production
EOF
chown ${SERVICE_USER}:${SERVICE_USER} ${INSTALL_DIR}/.env
chmod 600 ${INSTALL_DIR}/.env
print_success "Configuration file created"

# Build the project
print_header "Building Project"
su - ${SERVICE_USER} -c "cd ${INSTALL_DIR} && pnpm build"
print_success "Project built"

# Create log directory
mkdir -p /var/log
touch /var/log/gb-label-printer-error.log
touch /var/log/gb-label-printer-out.log
touch /var/log/gb-label-printer-combined.log
touch /var/log/gb-label-printer-update.log
chown ${SERVICE_USER}:${SERVICE_USER} /var/log/gb-label-printer-*.log

# Start with PM2
print_header "Starting Service with PM2"
su - ${SERVICE_USER} -c "cd ${INSTALL_DIR} && pm2 delete gb-label-printer" 2>/dev/null || true
su - ${SERVICE_USER} -c "cd ${INSTALL_DIR} && pm2 start ecosystem.config.cjs"
su - ${SERVICE_USER} -c "pm2 save"
print_success "Service started"

# Setup PM2 startup
print_header "Configuring PM2 Startup"
su - ${SERVICE_USER} -c "pm2 startup systemd -u ${SERVICE_USER} --hp /home/${SERVICE_USER}" | tail -n 1 > /tmp/pm2_startup_cmd.sh
if [ -s /tmp/pm2_startup_cmd.sh ]; then
    bash /tmp/pm2_startup_cmd.sh
    rm /tmp/pm2_startup_cmd.sh
    print_success "PM2 startup configured"
else
    print_info "PM2 startup already configured or command not needed"
fi

# Setup auto-update cron job
print_header "Setting up Auto-Update Cron Job"

# Remove existing cron job if present
su - ${SERVICE_USER} -c "crontab -l 2>/dev/null | grep -v 'gb-label-printer' | crontab -" 2>/dev/null || true

# Add new cron job (runs at 2:00 AM daily)
CRON_CMD="0 2 * * * cd ${INSTALL_DIR} && git pull origin main && pnpm install && sleep 1800 && pm2 restart gb-label-printer >> /var/log/gb-label-printer-update.log 2>&1"
su - ${SERVICE_USER} -c "(crontab -l 2>/dev/null; echo \"${CRON_CMD}\") | crontab -"
print_success "Auto-update cron job configured (runs daily at 2:00 AM)"

# Print service status
print_header "Installation Complete!"

echo ""
echo -e "${GREEN}Service is now running!${NC}"
echo ""
echo "Useful commands:"
echo "  View status:  pm2 status"
echo "  View logs:    pm2 logs gb-label-printer"
echo "  Stop service: pm2 stop gb-label-printer"
echo "  Start service: pm2 start gb-label-printer"
echo "  Restart:      pm2 restart gb-label-printer"
echo ""
echo "Configuration:"
echo "  API Endpoint: ${API_ENDPOINT}"
echo "  Config File:  ${INSTALL_DIR}/.env"
echo "  Logs:         /var/log/gb-label-printer-*.log"
echo ""
echo "The service will automatically:"
echo "  • Restart on crash"
echo "  • Start on system boot"
echo "  • Update daily at 2:00 AM"
echo ""

# Show current PM2 status
su - ${SERVICE_USER} -c "pm2 status"

print_header "Setup Complete"
