module.exports = {
  apps: [{
    name: 'comfy-prompts',
    script: 'server.js',
    cwd: '/var/www/comfy-prompts',
    env: {
      NODE_ENV: 'production',
      PORT: 3014
    }
  }]
};
