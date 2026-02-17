#!/bin/bash
set -e

echo "======================================"
echo "🚀 HR MODULE – FULL SETUP & DEPLOY"
echo "======================================"

# -------- CONFIG --------
BASE_DIR="/home/project/hr-module"
SERVER_DIR="$BASE_DIR/server"
CLIENT_DIR="$BASE_DIR/client"
ECOSYSTEM="$BASE_DIR/ecosystem.config.js"

NGINX_CONF="/etc/nginx/conf.d/hr.conf"
REACT_BUILD="$CLIENT_DIR/build"
BACKEND_PORT=9100

# -------- GIT --------
echo "📥 Pulling latest code..."
cd $BASE_DIR
git pull origin main

# -------- BACKEND --------
echo "🔧 Installing backend dependencies..."
cd $SERVER_DIR
#npm install --production
npm install 
echo "........... Building Backend ............."
npm run build
# -------- PM2 --------
echo "##############🎇🎇🎇🎇 Restarting PM2 for Backend 🎇🎇🎇🎇🎇🎇" 
pm2 restart hr-backend

# -------- FRONTEND --------
echo "🎨 Building frontend..."
cd $CLIENT_DIR
npm install
npm run build

# -------- NGINX --------
systemctl reload nginx

echo "======================================"
echo "✅ HR MODULE DEPLOY COMPLETED"
echo "UI  → http://IP/hr"
echo "API → http://IP/hr-api"
echo "======================================"
