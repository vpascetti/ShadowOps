#!/bin/bash
echo "Stopping ShadowOps..."
docker-compose down
echo "SUCCESS: ShadowOps stopped"
echo ""
echo "Your data is preserved. Run ./start.sh again to resume."
