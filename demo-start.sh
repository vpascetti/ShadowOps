#!/bin/bash

# ShadowOps Demo Startup Script
# Starts API and Web App for live demo

set -e

echo ""
echo "🚀 ShadowOps Demo Setup"
echo "======================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if workspace root
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this script from the ShadowOps workspace root"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing workspace dependencies..."
    npm install
    echo "✅ Dependencies installed"
    echo ""
fi

# Start API in background
echo -e "${BLUE}Starting API Server...${NC}"
cd apps/api
npm run dev > ../../api.log 2>&1 &
API_PID=$!
cd ../..
sleep 3

if ps -p $API_PID > /dev/null; then
    echo -e "${GREEN}✅ API running on http://localhost:5050${NC}"
else
    echo "❌ Failed to start API. Check api.log for details"
    exit 1
fi

# Start Web App in background
echo -e "${BLUE}Starting Web App...${NC}"
cd apps/web
npm run dev -- --host 0.0.0.0 --port 5173 > ../../web.log 2>&1 &
WEB_PID=$!
cd ../..
sleep 3

if ps -p $WEB_PID > /dev/null; then
    echo -e "${GREEN}✅ Web app running on http://localhost:5173${NC}"
else
    echo "❌ Failed to start web app. Check web.log for details"
    kill $API_PID
    exit 1
fi

echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}✅ ShadowOps is ready for demo!${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "📊 Open your browser:"
echo "   🌐 http://localhost:5173"
echo ""
echo "⚙️  API Status:"
echo "   🔌 http://localhost:5050/health"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT - SSH Tunnel${NC}"
echo "   Before the demo, ensure SSH tunnel is running on your Windows machine:"
echo "   Run this command on your Windows Terminal:"
echo ""
echo -e "   ${BLUE}gh codespace ssh --codespace organic-journey-x549j5xg9x76h6979 -- -R 1521:localhost:1521 -o ServerAliveInterval=60 -N${NC}"
echo ""
echo "📝 Logs:"
echo "   API:     tail -f api.log"
echo "   Web:     tail -f web.log"
echo ""
echo "🛑 To stop all services, run: ./demo-stop.sh"
echo ""

# Wait for user interrupt
wait
