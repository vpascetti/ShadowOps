#!/bin/bash
set -e

echo "ShadowOps Pilot Setup"
echo "======================================="
echo ""

# Check Docker
if ! docker info > /dev/null 2>&1; then
    echo "ERROR: Docker is not running."
    echo "Please download and start Docker Desktop:"
    echo "   https://www.docker.com/products/docker-desktop"
    exit 1
fi

echo "SUCCESS: Docker is running"
echo ""

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    cp .env.example .env
    echo "SUCCESS: Created .env from template"
fi

# ============================================
# IQMS DATABASE CONFIGURATION
# ============================================

setup_iqms_credentials() {
    echo ""
    echo "IQMS Database Configuration"
    echo "=============================="
    echo ""
    echo "ShadowOps connects to your IQMS database to validate the integration."
    echo "This pilot uses LIVE DATA - no demo/sample data."
    echo ""
    
    # Check if credentials already exist and are populated
    EXISTING_HOST=$(grep '^IQMS_HOST=' .env 2>/dev/null | cut -d= -f2 || echo "")
    
    if [ ! -z "$EXISTING_HOST" ] && [ "$EXISTING_HOST" != "your-iqms-host" ]; then
        echo "Current IQMS Configuration:"
        echo "  Host: $EXISTING_HOST"
        echo "  Port: $(grep '^IQMS_PORT=' .env 2>/dev/null | cut -d= -f2)"
        echo "  User: $(grep '^IQMS_USER=' .env 2>/dev/null | cut -d= -f2)"
        echo ""
        read -p "Do you want to reconfigure IQMS? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Using existing configuration"
            return
        fi
    fi
    
    # Prompt for IQMS host
    echo "Enter your IQMS database details:"
    echo ""
    read -p "1. IQMS Host/IP Address: " IQMS_HOST
    if [ -z "$IQMS_HOST" ]; then
        echo "ERROR: IQMS Host is required"
        exit 1
    fi
    
    # Prompt for IQMS port
    read -p "2. IQMS Port (default 1521): " IQMS_PORT
    IQMS_PORT=${IQMS_PORT:-1521}
    
    # Prompt for IQMS user
    read -p "3. IQMS Username: " IQMS_USER
    if [ -z "$IQMS_USER" ]; then
        echo "ERROR: IQMS Username is required"
        exit 1
    fi
    
    # Prompt for IQMS password (hidden)
    read -sp "4. IQMS Password (won't display): " IQMS_PASSWORD
    echo
    if [ -z "$IQMS_PASSWORD" ]; then
        echo "ERROR: IQMS Password is required"
        exit 1
    fi
    
    # Prompt for IQMS database/SID
    read -p "5. IQMS Database/SID Name: " IQMS_DB
    if [ -z "$IQMS_DB" ]; then
        echo "ERROR: IQMS Database name is required"
        exit 1
    fi
    
    # Confirm settings
    echo ""
    echo "Confirming your settings:"
    echo "  Host: $IQMS_HOST"
    echo "  Port: $IQMS_PORT"
    echo "  User: $IQMS_USER"
    echo "  Database: $IQMS_DB"
    echo ""
    read -p "Are these correct? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Let's try again..."
        setup_iqms_credentials
        return
    fi
    
    # Update .env file
    echo ""
    echo "Saving IQMS configuration..."
    
    # Remove old IQMS settings if they exist
    sed -i.bak '/^IQMS_HOST=/d' .env
    sed -i '/^IQMS_PORT=/d' .env
    sed -i '/^IQMS_USER=/d' .env
    sed -i '/^IQMS_PASSWORD=/d' .env
    sed -i '/^IQMS_DB=/d' .env
    rm -f .env.bak
    
    # Add new IQMS settings
    cat >> .env << EOF

# IQMS Database Configuration (Configured on $(date '+%Y-%m-%d %H:%M:%S'))
IQMS_HOST=${IQMS_HOST}
IQMS_PORT=${IQMS_PORT}
IQMS_USER=${IQMS_USER}
IQMS_PASSWORD=${IQMS_PASSWORD}
IQMS_DB=${IQMS_DB}
EOF
    
    echo "✅ IQMS configuration saved"
    echo ""
}

# Run IQMS setup
setup_iqms_credentials

# ============================================
# START SERVICES
# ============================================

echo "🐳 Starting ShadowOps services..."
echo "   - PostgreSQL database"
echo "   - API server"
echo "   - Web application"
echo ""

docker-compose up -d

# Wait for services
echo "⏳ Waiting for services to start (this takes ~30 seconds on first run)..."
sleep 10

# Check health
echo "🔍 Checking service health..."
API_URL="http://localhost:5050"
WEB_URL="http://localhost:5173"
MAX_RETRIES=12
RETRY=0

# Check API health
while [ $RETRY -lt $MAX_RETRIES ]; do
    if curl -s "${API_URL}/health" > /dev/null 2>&1; then
        echo "SUCCESS: API is running"
        break
    fi
    RETRY=$((RETRY + 1))
    if [ $RETRY -eq $MAX_RETRIES ]; then
        echo "Note: API is taking longer to start... it should be ready soon"
    else
        sleep 5
    fi
done

# Give web app a moment
sleep 5

if curl -s "${WEB_URL}" > /dev/null 2>&1; then
    echo "SUCCESS: Web application is running"
else
    echo "Note: Web application is starting up..."
fi

# ============================================
# SUCCESS MESSAGE
# ============================================

echo ""
echo "ShadowOps Pilot is Ready"
echo "======================================="
echo ""
echo "Access the application:"
echo "   http://localhost:5173"
echo ""
echo "IQMS Connection:"
echo "   Connected to: $(grep '^IQMS_HOST=' .env | cut -d= -f2)"
echo "   Using LIVE DATA from your production IQMS"
echo ""
echo "Useful commands:"
echo "   View logs:     docker-compose logs -f"
echo "   Stop services: ./stop.sh"
echo "   Restart API:   docker-compose restart api"
echo ""
echo "Next steps:"
echo "   1. Open http://localhost:5173 in your browser"
echo "   2. Review DEMO_GUIDE.md for feature walkthrough"
echo "   3. Test data import and validation"
echo "   4. Provide feedback to the ShadowOps team"
