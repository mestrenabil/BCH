#!/bin/bash
cd /home/z/my-project
while true; do
  echo "=== Starting dev server at $(date) ==="
  bunx next dev -p 3000 -H 0.0.0.0 --webpack
  echo "=== Dev server exited at $(date), restarting in 3s ==="
  sleep 3
done
