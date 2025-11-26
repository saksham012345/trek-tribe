// PM2 ecosystem file for running the ai-service with process management
module.exports = {
  apps: [
    {
      name: 'trek-tribe-ai',
      script: 'uvicorn',
      args: 'app.main:app --host 0.0.0.0 --port 8000',
      interpreter: '/usr/bin/env',
      env: {
        AI_SERVICE_KEY: process.env.AI_SERVICE_KEY || 'change-me',
        PYTHONUNBUFFERED: '1',
      },
      restart_delay: 5000,
    },
  ],
};
