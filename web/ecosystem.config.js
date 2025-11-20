module.exports = {
  apps: [{
    name: 'scoresnap',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/scoresnap/web',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/www/scoresnap/logs/err.log',
    out_file: '/var/www/scoresnap/logs/out.log',
    log_file: '/var/www/scoresnap/logs/combined.log',
    time: true
  }]
};

