module.exports = {
  apps: [
    {
      name: process.env.BCH_PM2_NAME || 'BCH',
      script: 'node_modules/next/dist/bin/next',
      args: `start -p ${process.env.BCH_PORT || '3002'} -H 127.0.0.1`,
      cwd: process.env.BCH_APP_DIR || '/var/www/BCH',
      env: {
        NODE_ENV: 'production',
        APP_RELEASE: process.env.APP_RELEASE || 'unknown',
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: '1G',
      time: true,
    },
  ],
}
