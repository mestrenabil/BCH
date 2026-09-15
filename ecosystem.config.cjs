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
        SMTP_HOST: process.env.SMTP_HOST || '',
        SMTP_PORT: process.env.SMTP_PORT || '587',
        SMTP_SECURE: process.env.SMTP_SECURE || 'false',
        SMTP_USER: process.env.SMTP_USER || '',
        SMTP_PASSWORD: process.env.SMTP_PASSWORD || '',
        SMTP_FROM: process.env.SMTP_FROM || '',
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: '1G',
      time: true,
    },
  ],
}
