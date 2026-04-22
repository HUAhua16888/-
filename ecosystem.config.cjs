module.exports = {
  apps: [
    {
      name: "tongqu-growth-web",
      cwd: "/var/www/tongqu-growth-web",
      script: "npm",
      args: "start -- --hostname 0.0.0.0 --port 3000",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
