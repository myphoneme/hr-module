module.exports = {
  apps: [
    {
      name: "hr-backend",
      cwd: "/home/project/hr-module/server",
      script: "index.ts",            // change if needed
      env_file: "/home/project/hr-module/.env",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "300M"
    }
  ]
}