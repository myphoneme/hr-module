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

NGINX_CONF="/etc/nginx/conf.d/hr-module.conf"
REACT_BUILD="$CLIENT_DIR/build"
BACKEND_PORT=9100

# -------- GIT --------
echo "📥 Pulling latest code..."
cd $BASE_DIR
git pull origin main

# -------- BACKEND --------
echo "🔧 Installing backend dependencies..."
cd $SERVER_DIR
npm install --production

# -------- PM2 --------
if ! command -v pm2 &> /dev/null; then
  echo "📦 Installing PM2..."
  npm install -g pm2
fi

# Enable PM2 startup only once
if ! systemctl list-unit-files | grep -q pm2-root; then
  echo "⚙️ Enabling PM2 startup..."
  pm2 startup systemd -u root --hp /root
fi

echo "♻️ Starting / Reloading backend..."
pm2 startOrReload $ECOSYSTEM
pm2 save

# -------- FRONTEND --------
echo "🎨 Building frontend..."
cd $CLIENT_DIR
npm install
npm run build

# -------- NGINX --------
if [ ! -f "$NGINX_CONF" ]; then
  echo "🌐 Creating Nginx config..."

  cat > $NGINX_CONF <<EOF
# HR MODULE (auto-generated)

location /hr/ {
    alias $REACT_BUILD/;
    index index.html;
    try_files \$uri \$uri/ /index.html;
}

location /hr-api/ {
    proxy_pass http://127.0.0.1:$BACKEND_PORT/;
    proxy_http_version 1.1;

    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host \$host;
    proxy_cache_bypass \$http_upgrade;
}
EOF
else
  echo "ℹ️ Nginx config already exists, skipping"
fi

echo "🔁 Reloading Nginx..."
nginx -t && systemctl reload nginx

echo "======================================"
echo "✅ HR MODULE DEPLOY COMPLETED"
echo "UI  → http://IP/hr"
echo "API → http://IP/hr-api"
echo "======================================"
