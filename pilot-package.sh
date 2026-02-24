#!/bin/bash

# ShadowOps Pilot Package Creator
# Creates a clean, ready-to-use package for customers

set -e

VERSION=${1:-"1.0.0"}
OUTPUT_DIR="shadowops-pilot-${VERSION}"

echo "Creating ShadowOps Pilot Package v${VERSION}\""
echo "================================================"

# Create output directory
mkdir -p "${OUTPUT_DIR}"
cd "${OUTPUT_DIR}"

echo "Setting up directory structure..."

# Copy essential files
mkdir -p apps/api apps/web packages connectors logs

# Copy package files
cp ../package.json .
cp ../package-lock.json .
cp ../tsconfig.base.json .

# Copy app configurations
cp -r ../apps/api/package.json apps/api/
cp -r ../apps/api/src apps/api/ 2>/dev/null || true
cp -r ../apps/api/tsconfig.json apps/api/
cp -r ../apps/web/package.json apps/web/
cp -r ../apps/web/src apps/web/ 2>/dev/null || true
cp -r ../apps/web/tsconfig.json apps/web/
cp -r ../apps/web/public apps/web/ 2>/dev/null || true
cp -r ../apps/web/vite.config.js apps/web/ 2>/dev/null || true
cp -r ../apps/web/index.html apps/web/ 2>/dev/null || true

# Copy packages
cp -r ../packages/* packages/ 2>/dev/null || true

# Copy Docker files
cp ../Dockerfile.api .
cp ../Dockerfile.web .
cp ../nginx.conf .
cp ../docker-compose.pilot.yml docker-compose.yml

# Copy configuration templates
cp ../.env.pilot.example .env.example
cp ../.gitignore . 2>/dev/null || true

# Copy documentation
cp ../PILOT_SETUP.md README.md
cp ../PILOT_PITCH.md ./PILOT_PITCH.md 2>/dev/null || true
cp ../DEMO_GUIDE.md ./DEMO_GUIDE.md 2>/dev/null || true

# Copy interactive setup scripts
cp ../pilot-start.sh start.sh
cp ../pilot-stop.sh stop.sh
chmod +x start.sh stop.sh

# Create .dockerignore
cat > .dockerignore << 'EOF'
node_modules
npm-debug.log
dist
.git
.gitignore
README.md
.env
.env.local
.ds_store
yarn-error.log
.next
out
.nuxt
dist
.cache
.vuepress/dist
.serverless/
.fusebox/
.dynamodb/
.tern-port
.vscode-test
.yarn/cache
.yarn/unplugged
.yarn/build-state.yml
.yarn/install-state.gz
.pnp.*
EOF

# Create version file
cat > VERSION << EOF
${VERSION}
EOF

# Create .gitignore for pilot package
cat > .gitignore << 'EOF'
node_modules/
dist/
.DS_Store
.env
.env.local
*.log
logs/
.next/
.cache/
.vuepress/dist/
.nuxt/
.fusebox/
.tern-port
.env.*.local
EOF

cd ..

# Create README for distribution
cat > "${OUTPUT_DIR}/QUICKSTART.txt" << 'EOF'
╔════════════════════════════════════════════════════╗
║          ShadowOps Pilot Package                   ║
║          Quick Start Guide                         ║
╚════════════════════════════════════════════════════╝

🚀 GET STARTED IN 3 STEPS:

  1. Ensure Docker is installed and running
     https://www.docker.com/products/docker-desktop

  2. Run the start script:
     ./start.sh

  3. Open your browser:
     http://localhost:5173

📖 FOR DETAILED SETUP:
   See README.md for full instructions

🆘 NEED HELP?
   Check README.md troubleshooting section

🎉 Ready to deploy your manufacturing operations!
EOF

# Create archive
echo "Packaging files..."
tar -czf "${OUTPUT_DIR}.tar.gz" "${OUTPUT_DIR}/"
zip -r "${OUTPUT_DIR}.zip" "${OUTPUT_DIR}/" > /dev/null 2>&1 || true

echo ""
echo "SUCCESS: Pilot package created!"
echo ""
echo "Output:"
echo "   Directory: ${OUTPUT_DIR}/"
echo "   Archive:   ${OUTPUT_DIR}.tar.gz"
echo "   ZIP:       ${OUTPUT_DIR}.zip"
echo ""
echo "To get started:"
echo "   cd ${OUTPUT_DIR}"
echo "   ./start.sh"
echo ""
echo "For distribution:"
echo "   Share ${OUTPUT_DIR}.zip with customers"
echo ""
