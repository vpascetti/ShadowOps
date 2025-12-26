#!/bin/bash

# ShadowOps - Stop Script
# This script stops all ShadowOps services

echo "🛑 Stopping ShadowOps services..."
echo ""

# Stop Node processes
echo "Stopping backend and frontend..."
pkill -f "node.*index.js" || echo "Backend already stopped"
pkill -f "vite" || echo "Frontend already stopped"

# Stop PostgreSQL
echo "Stopping PostgreSQL..."
docker-compose down

echo ""
echo "✅ All ShadowOps services stopped"
echo "   Database: Stopped (data preserved)"
echo "   Backend: Stopped"
echo "   Frontend: Stopped"
echo ""
echo "🚀 To restart: ./start.sh"
