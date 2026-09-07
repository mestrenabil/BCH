module.exports = {
  apps: [
    {
      name: 'bch-health',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000 -H 127.0.0.1',
      cwd: process.env.BCH_APP_DIR || '/home/bch/BCH',
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: '1G',
      time: true,
    },
  ],
}
