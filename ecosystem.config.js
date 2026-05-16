const path = require("node:path");

module.exports = {
  apps: [
    {
      name: "qr-restaurant-api",
      cwd: path.join(__dirname, "server"),
      script: "dist/server.js",
      exec_mode: "fork",
      instances: 1,
      watch: false,
      autorestart: true,
      max_memory_restart: "512M",
      time: true,
      env: {
        NODE_ENV: "production",
        PORT: "4000",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: "4000",
      },
    },
  ],
};
