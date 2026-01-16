module.exports = {
  apps: [
    {
      name: "hr-backend",
      cwd: "/home/project/hr-module/server",
      script: "dist/index.js",   // ✅ MUST BE dist, NOT src
      interpreter: "node",
      env_file: "/home/project/hr-module/.env",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "300M"
    }
  ]
}

