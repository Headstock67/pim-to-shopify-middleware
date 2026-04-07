#!/bin/bash

echo ""
echo "🚀 Starting Pendulum Ops API Middleware (Port 4000)..."
echo "======================================================"

# Ensure we are inside the middleware directory natively
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR" || { echo "❌ Failed to secure working directory context"; exit 1; }

# Verify dependencies exist
if [ ! -d "node_modules" ]; then
    echo "📦 node_modules not found. Running npm install..."
    npm install
fi

echo "🟢 Booting into development watch mode (Hot-reload enabled)..."
echo "To cleanly exit this server and stop the process, press Ctrl+C."
echo ""

# Execute the watch daemon natively hooking `.env` configurations securely
npm run dev
