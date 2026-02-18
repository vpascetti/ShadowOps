#!/bin/bash

# ShadowOps Demo Stop Script
# Stops API and Web App

echo ""
echo "🛑 Stopping ShadowOps Demo Services"
echo "===================================="
echo ""

# Stop Node processes
echo "Stopping API server..."
pkill -f "npm run dev.*src/index.ts" 2>/dev/null || echo "   (not running)"

echo "Stopping Web app..."
pkill -f "npm run dev.*5173" 2>/dev/null || echo "   (not running)"

# Give processes time to shut down
sleep 1

echo ""
echo "✅ All services stopped"
echo ""
echo "Logs available at: api.log, web.log"
echo ""
