#!/bin/bash
cd /home/z/my-project
while true; do
  echo "=== Starting production server at $(date) ==="
  setsid node .next/standalone/server.js 2>&1
  echo "=== Server exited at $(date), restarting in 2s ==="
  sleep 2
done
