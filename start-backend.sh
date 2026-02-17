#!/bin/bash

# Start backend server for ShadowOps

echo "🔧 Starting ShadowOps backend server..."

# Navigate to API directory
cd "$(dirname "$0")/apps/api"

# Install dependencies if needed (workspace root)
if [ ! -x "$(dirname "$0")/node_modules/.bin/tsx" ]; then
    echo "📦 Installing workspace dependencies..."
    cd "$(dirname "$0")" && npm install
    cd "$(dirname "$0")/apps/api"
fi

# Start the server
echo "🚀 Starting backend on http://localhost:5050..."
npm run dev
