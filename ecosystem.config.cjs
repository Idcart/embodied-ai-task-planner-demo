module.exports = {
  apps: [
    {
      name: "embodied-ai-demo-api",
      script: "server/index.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || 3001
      }
    }
  ]
};
