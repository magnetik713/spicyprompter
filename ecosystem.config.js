module.exports = {
  apps: [{
    name: 'comfy-prompts',
    script: 'server.js',
    cwd: '/var/www/comfy-prompts',
    env: {
      NODE_ENV: 'production',
      PORT: 3016,
      IMAGE_GEN: 'true'
    }
  }]
};
