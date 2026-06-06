#!/bin/bash
cd /home/z/my-project
ATTEMPT=0
while true; do
  ATTEMPT=$((ATTEMPT + 1))
  echo "=== Attempt $ATTEMPT: Starting Next.js server at $(date) ==="
  node node_modules/next/dist/bin/next dev -p 3000 -H 0.0.0.0 2>&1
  EXIT_CODE=$?
  echo "=== Server exited with code $EXIT_CODE at $(date) ==="
  sleep 2
done
