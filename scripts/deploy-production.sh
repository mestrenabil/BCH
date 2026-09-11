#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${BCH_APP_DIR:-/var/www/BCH}"
BRANCH="${BCH_DEPLOY_BRANCH:-main}"
PORT="${BCH_PORT:-3002}"
PM2_NAME="${BCH_PM2_NAME:-BCH}"
DB_NAME="${BCH_DB_NAME:-bch_staging}"
BACKUP_DIR="${BCH_BACKUP_DIR:-/root/BCH-backups}"

fail() {
  echo "[BCH deploy] $*" >&2
  exit 1
}

cd "$APP_DIR" || fail "Application directory not found: $APP_DIR"

command -v git >/dev/null 2>&1 || fail "git is required"
command -v npm >/dev/null 2>&1 || fail "npm is required"
command -v pm2 >/dev/null 2>&1 || fail "pm2 is required"
command -v pg_dump >/dev/null 2>&1 || fail "pg_dump is required"
command -v curl >/dev/null 2>&1 || fail "curl is required"
test -f .env || fail "Production .env is missing"

if [[ -n "$(git status --porcelain)" ]]; then
  fail "The production checkout is not clean; refusing to overwrite server-side changes"
fi

mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}-before-deploy-$(date +%Y%m%d-%H%M%S).sql"
echo "[BCH deploy] Backing up PostgreSQL to $BACKUP_FILE"
sudo -u postgres pg_dump "$DB_NAME" > "$BACKUP_FILE"

git fetch --prune origin "$BRANCH"
git merge --ff-only "origin/$BRANCH"

# حمّل إعدادات الإنتاج للخدمات والأوامر التالية دون تخزينها في Git.
set -a
# shellcheck disable=SC1091
source .env
set +a
export BCH_APP_DIR="$APP_DIR"
export BCH_PORT="$PORT"
export BCH_PM2_NAME="$PM2_NAME"
export APP_RELEASE="$(git rev-parse HEAD)"

npm ci
npx prisma generate
npx prisma migrate deploy
npm run build

if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs --update-env
fi
pm2 save

for attempt in 1 2 3 4 5; do
  if curl --fail --silent --show-error "http://127.0.0.1:${PORT}/api/health" >/dev/null; then
    echo "[BCH deploy] Deployment completed successfully"
    exit 0
  fi
  sleep 2
done

echo "[BCH deploy] Application health check failed after restart" >&2
pm2 status
exit 1
