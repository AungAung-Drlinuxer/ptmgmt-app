#!/bin/bash

set -xe

APP_DIR="/home/ubuntu/app/ptmgmt-app"
APP_NAME="patient-management-api"
NODE_APP="server.js"

# --- Check if app directory exists ---
if [ ! -d "$APP_DIR" ]; then
  echo "❌ Application directory $APP_DIR does not exist!"
  exit 1
fi

# --- Navigate to app directory ---
cd "$APP_DIR"

# --- Check if PM2 is installed ---
if ! command -v pm2 &> /dev/null; then
  echo "❌ PM2 is not installed. Please install it first with: sudo npm install -g pm2"
  exit 1
fi

# --- Start the app only if not already running ---
if pm2 list | grep -q "$APP_NAME"; then
  echo "✅ PM2 process $APP_NAME is already running. Skipping start."
else
  echo "🚀 Starting $APP_NAME with PM2..."
  pm2 start "$NODE_APP" --name "$APP_NAME"
fi

# --- Setup PM2 startup only if not already configured ---
if [ ! -f ~/.pm2/dump.pm2 ]; then
  echo "⚙️ Setting up PM2 startup configuration..."
  pm2 startup
  sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
  pm2 save
else
  echo "✅ PM2 startup already configured."
fi

# --- Show PM2 status ---
pm2 status