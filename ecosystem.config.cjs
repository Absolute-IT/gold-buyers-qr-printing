/**
 * PM2 Ecosystem Configuration
 * 
 * Configuration for running the Gold Buyers label printer service
 * as a managed process with PM2.
 */

module.exports = {
	apps: [{
		name: 'gb-label-printer',
		script: './dist/index.js',
		instances: 1,
		autorestart: true,
		watch: false,
		max_memory_restart: '200M',
		env: {
			NODE_ENV: 'production'
		},
		error_file: '/var/log/gb-label-printer-error.log',
		out_file: '/var/log/gb-label-printer-out.log',
		log_file: '/var/log/gb-label-printer-combined.log',
		time: true,
		// Restart strategies
		exp_backoff_restart_delay: 100,
		max_restarts: 10,
		min_uptime: '10s',
		// Kill timeout
		kill_timeout: 5000,
	}]
};
