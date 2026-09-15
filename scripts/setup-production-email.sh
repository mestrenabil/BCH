#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${BCH_APP_DIR:-/var/www/BCH}"
PM2_NAME="${BCH_PM2_NAME:-BCH}"
GMAIL_ADDRESS="bchmaroc2030@gmail.com"

fail() {
  echo "[BCH email] $*" >&2
  exit 1
}

cd "$APP_DIR" || fail "Application directory not found: $APP_DIR"
test -f .env || fail "Production .env is missing"
command -v node >/dev/null 2>&1 || fail "node is required"
command -v npm >/dev/null 2>&1 || fail "npm is required"
command -v pm2 >/dev/null 2>&1 || fail "pm2 is required"

echo
echo "BCH production Gmail configuration"
echo "Account: $GMAIL_ADDRESS"
echo "Paste the 16-character Google App Password."
read -r -s -p "Google App Password: " app_password
echo

app_password="${app_password//[[:space:]]/}"
[[ "$app_password" =~ ^[A-Za-z0-9]{16}$ ]] ||
  fail "The Google App Password must contain exactly 16 letters or digits"

set_env_value() {
  local key="$1"
  local value="$2"
  local temporary
  temporary="$(mktemp "$APP_DIR/.env.smtp.XXXXXX")"

  awk -v key="$key" -v value="$value" '
    BEGIN { replaced = 0 }
    index($0, key "=") == 1 {
      if (!replaced) {
        print key "=" value
        replaced = 1
      }
      next
    }
    { print }
    END {
      if (!replaced) print key "=" value
    }
  ' .env > "$temporary"

  chmod --reference=.env "$temporary"
  chown --reference=.env "$temporary"
  mv "$temporary" .env
}

set_env_value "SMTP_HOST" "smtp.gmail.com"
set_env_value "SMTP_PORT" "587"
set_env_value "SMTP_SECURE" "false"
set_env_value "SMTP_USER" "$GMAIL_ADDRESS"
set_env_value "SMTP_PASSWORD" "$app_password"
set_env_value "SMTP_FROM" '"منصة قسم الوقاية وحفظ الصحة <bchmaroc2030@gmail.com>"'

unset app_password
chmod 600 .env

set -a
# shellcheck disable=SC1091
source .env
set +a

node <<'NODE'
const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
})

transporter.verify()
  .then(() => console.log('[BCH email] Gmail authentication succeeded'))
  .catch((error) => {
    console.error('[BCH email] Gmail authentication failed:', error.code || 'UNKNOWN')
    process.exit(1)
  })
NODE

# قد يضمّن Next.js بعض متغيرات البيئة أثناء البناء، لذلك يجب إعادة البناء بعد إعداد SMTP.
echo "[BCH email] Rebuilding the production application with SMTP settings..."
npm run build

pm2 reload ecosystem.config.cjs --only "$PM2_NAME" --update-env
pm2 save

pm2_process_id="$(pm2 pid "$PM2_NAME" | head -n 1)"
[[ "$pm2_process_id" =~ ^[0-9]+$ ]] || fail "Unable to determine the PM2 process ID"

for required_name in SMTP_HOST SMTP_PORT SMTP_SECURE SMTP_USER SMTP_PASSWORD SMTP_FROM; do
  if ! tr '\0' '\n' < "/proc/$pm2_process_id/environ" |
    cut -d= -f1 |
    grep -Fxq "$required_name"; then
    fail "PM2 process is missing $required_name"
  fi
done

echo "[BCH email] PM2 has loaded all SMTP variables."
echo "[BCH email] Production email is configured and the application was restarted."
