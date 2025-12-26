#!/bin/bash

# ShadowOps - Quick Start Script
# This script starts all required services for the demo

set -e

echo "🚀 ShadowOps Quick Start"
echo "========================"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker and try again."
    exit 1
fi

echo "✅ Docker is running"

# Start PostgreSQL
echo "📦 Starting PostgreSQL database..."
docker-compose up -d
sleep 2

if docker ps | grep -q shadowops-db; then
    echo "✅ PostgreSQL is running"
else
    echo "❌ Failed to start PostgreSQL"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "server/node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    cd server && npm install && cd ..
fi

if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

# Start backend server
echo "🔧 Starting backend server on http://localhost:5050..."
cd server
nohup npm start > ../server.log 2>&1 &
BACKEND_PID=$!
cd ..
sleep 2

# Check backend health
if curl -s http://localhost:5050/api/health | grep -q "ok"; then
    echo "✅ Backend server is running (PID: $BACKEND_PID)"
else
    echo "❌ Backend server failed to start. Check server.log for details."
    cat server.log
    exit 1
fi

# Start frontend
echo "🎨 Starting frontend on http://localhost:5173..."
nohup npm run dev > vite.log 2>&1 &
FRONTEND_PID=$!
sleep 3

# Check frontend
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "✅ Frontend is running (PID: $FRONTEND_PID)"
else
    echo "⚠️  Frontend may still be starting up..."
fi

echo ""
echo "✅ ShadowOps is ready!"
echo "========================"
echo "📊 Open your browser to: http://localhost:5173"
echo ""
echo "📝 Logs:"
echo "   Backend:  tail -f server.log"
echo "   Frontend: tail -f vite.log"
echo ""
echo "🛑 To stop all services:"
echo "   ./stop.sh"
echo ""
echo "🎯 Ready to demo! See DEMO_GUIDE.md for demo script."
