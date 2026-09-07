#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${BCH_APP_DIR:-/home/bch/BCH}"
BRANCH="${BCH_DEPLOY_BRANCH:-main}"

fail() {
  echo "[BCH deploy] $*" >&2
  exit 1
}

cd "$APP_DIR" || fail "Application directory not found: $APP_DIR"

command -v git >/dev/null 2>&1 || fail "git is required"
command -v npm >/dev/null 2>&1 || fail "npm is required"
command -v pm2 >/dev/null 2>&1 || fail "pm2 is required"
test -f .env || fail "Production .env is missing"

if [[ -n "$(git status --porcelain)" ]]; then
  fail "The production checkout is not clean; refusing to overwrite server-side changes"
fi

git fetch --prune origin "$BRANCH"
git merge --ff-only "origin/$BRANCH"

# حمّل إعدادات الإنتاج للخدمات والأوامر التالية دون تخزينها في Git.
set -a
# shellcheck disable=SC1091
source .env
set +a
export BCH_APP_DIR="$APP_DIR"

npm ci
npx prisma generate
npx prisma db push
npm run build

if pm2 describe bch-health >/dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs --update-env
fi
pm2 save

for attempt in 1 2 3 4 5; do
  if curl --fail --silent --show-error http://127.0.0.1:3000/api/health >/dev/null; then
    echo "[BCH deploy] Deployment completed successfully"
    exit 0
  fi
  sleep 2
done

echo "[BCH deploy] Application health check failed after restart" >&2
pm2 status
exit 1
