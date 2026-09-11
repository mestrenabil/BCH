# Deployment — دليل النشر الإنتاجي

> دليل كامل لنشر منصة BCH على خادم Ubuntu VPS مع Nginx + PM2 + PostgreSQL.

---

## 1. المتطلبات

### الخادم
- **OS:** Ubuntu 22.04 LTS أو أحدث
- **RAM:** 2GB كحد أدنى (4GB موصى به)
- **Disk:** 20GB كحد أدنى (لتخزين الصور والوثائق)
- **Node.js:** 20.9 أو أحدث
- **PostgreSQL:** 15+ مع PostGIS (للإحداثيات الجغرافية)

### النطاق
- اسم نطاق مُسجّل (مثال: `bchealth.gov.ma`)
- شهادة SSL (Let's Encrypt مجانية)

---

## 2. إعداد الخادم

```bash
# تحديث النظام
sudo apt update && sudo apt upgrade -y

# تثبيت Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# تثبيت PM2 عالمياً
sudo npm install -g pm2

# تثبيت PostgreSQL 15 + PostGIS
sudo apt install -y postgresql postgresql-contrib postgis postgresql-15-postgis-3

# تثبيت Nginx
sudo apt install -y nginx

# تثبيت Certbot (Let's Encrypt)
sudo apt install -y certbot python3-certbot-nginx

# تثبيت Git
sudo apt install -y git
```

---

## 3. إعداد PostgreSQL

```bash
# بدّل لمستخدم postgres
sudo -u postgres psql

# أنشئ قاعدة البيانات والمستخدم
CREATE DATABASE bch_health;
CREATE USER bch_user WITH ENCRYPTED PASSWORD 'replace-with-strong-password';
GRANT ALL PRIVILEGES ON DATABASE bch_health TO bch_user;

# فعّل PostGIS
\c bch_health
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
\q

# اضبط المصادقة (pg_hba.conf)
sudo nano /etc/postgresql/15/main/pg_hba.conf
# أضف: host bch_health bch_user 127.0.0.1/32 scram-sha-256

sudo systemctl restart postgresql
```

---

## 4. نشر التطبيق

```bash
# أنشئ مستخدم للنشر
sudo adduser --disabled-password --gecos '' bch
sudo usermod -aG sudo bch

# انتقل للمستخدم
su - bch

# استنسخ المستودع
cd /home/bch
git clone <your-repo-url> BCH
cd BCH

# ثبّت الاعتماديات
npm install

# انسخ .env وعدّله
cp .env.example .env
nano .env
```

### `.env` للإنتاج
```env
DATABASE_URL="postgresql://bch_user:replace-with-strong-password@localhost:5432/bch_health?schema=public"
INITIAL_SETUP_TOKEN=replace-with-a-long-random-secret
INITIAL_ADMIN_USERNAME=admin
INITIAL_ADMIN_PASSWORD=replace-with-a-strong-password-of-at-least-12-characters
INITIAL_ADMIN_NAME=المسؤول العام
ALLOW_DEMO_SEED=false
NODE_ENV=production

# SMTP للإشعارات
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=notifications@example.com
SMTP_PASSWORD=replace-with-an-app-password
SMTP_FROM="منصة BCH <notifications@example.com>"
```

### بناء + تطبيق المخطط

```bash
# اضبط متغيرات البيئة مؤقتاً للبناء
export DATABASE_URL="postgresql://bch_user:password@localhost:5432/bch_health?schema=public"

# طبّق مخطط Prisma
npx prisma generate
npx prisma migrate deploy   # أو: npx prisma db push

# ابنِ التطبيق
npm run build
```

---

## 5. إعداد PM2

```bash
# أنشئ ملف PM2
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'BCH',
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p 3002 -H 127.0.0.1',
    cwd: '/var/www/BCH',
    env: {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://bch_user:password@localhost:5432/bch_staging?schema=public',
    },
    instances: 1,
    autorestart: true,
    max_memory_restart: '1G',
    error_file: '/var/www/BCH/logs/error.log',
    out_file: '/var/www/BCH/logs/output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }]
}
EOF

# أنشئ مجلد السجلات
mkdir -p logs

# ابدأ التطبيق
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # اتبع التعليمات لتشغيل PM2 مع النظام
```

---

## 6. إعداد Nginx (Reverse Proxy + HTTPS)

```bash
sudo nano /etc/nginx/sites-available/bch-health
```

```nginx
server {
    listen 80;
    server_name bchealth.gov.ma;  # بدّل بنطاقك

    # إعادة توجيه لـ HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name bchealth.gov.ma;  # بدّل بنطاقك

    # شهادة SSL (سيُنشئها Certbot)
    ssl_certificate /etc/letsencrypt/live/bchealth.gov.ma/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bchealth.gov.ma/privkey.pem;

    # إعدادات الأمان
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # headers الأمان
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # رفع الملفات (صور البلاغات)
    client_max_body_size 10M;

    # الوكيل العكسي لـ Next.js
    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # الملفات الثابتة (أداء)
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3002;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# فعّل الموقع
sudo ln -s /etc/nginx/sites-available/bch-health /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# احصل على شهادة SSL
sudo certbot --nginx -d bchealth.gov.ma
```

---

## 7. النسخ الاحتياطي

### سكريبت نسخ احتياطي يومي

```bash
# /home/bch/backup.sh
#!/bin/bash
BACKUP_DIR="/home/bch/backups"
DATE=$(date +%F)
mkdir -p "$BACKUP_DIR"

# قاعدة البيانات
PGPASSWORD="your-password" pg_dump -U bch_user -h localhost bch_staging | gzip > "$BACKUP_DIR/db-$DATE.sql.gz"

# الملفات
tar -czf "$BACKUP_DIR/storage-$DATE.tar.gz" -C /var/www/BCH storage/

# احتفظ بآخر 7 أيام فقط
find "$BACKUP_DIR" -name "*.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

```bash
chmod +x /home/bch/backup.sh

# أضفه لـ cron (يومياً 2:00 صباحاً)
crontab -e
# 0 2 * * * /home/bch/backup.sh >> /home/bch/backups/cron.log 2>&1
```

---

## 8. التحديث

```bash
cd /var/www/BCH

# اسحب التحديثات
git pull origin main

# ثبّت اعتماديات جديدة
npm install

# طبّق تحديثات المخطط
npx prisma generate
npx prisma migrate deploy   # أو: npx prisma db push

# أعد البناء
npm run build

# أعد التشغيل
pm2 restart BCH
```

### سكريبت تحديث سريع
```bash
# /root/update.sh
#!/bin/bash
set -e
cd /var/www/BCH
git pull
npm install
npx prisma generate
npx prisma db push
npm run build
pm2 restart BCH
echo "Update completed successfully"
```

### النشر التلقائي من GitHub

يوجد سير عمل في `.github/workflows/deploy-production.yml`. عند دمج تغيير في فرع
`main`، ينفّذ GitHub الاختبارات والبناء أولاً، ثم يتصل بالخادم عبر SSH ويشغّل
`scripts/deploy-production.sh`. لا يتم نشر فروع التطوير تلقائياً.

#### إعداد الخادم مرة واحدة

```bash
cd /var/www/BCH
chmod +x scripts/deploy-production.sh
git remote set-url origin git@github.com:mestrnabil/BCH.git
```

يجب أن يكون مفتاح SSH الخاص بالخادم مضافاً إلى GitHub كمفتاح قراءة للمستودع،
وأن يكون الخادم قادراً على تنفيذ `git fetch origin main`. يجب أن يبقى `.env`
خارج Git، كما يجب أن تبقى PostgreSQL و`storage/` في مسارين دائمين على الخادم.

#### أسرار ومتغيرات GitHub المطلوبة

أضف الأسرار التالية في إعدادات المستودع أو في Environment باسم `production`:

- `SERVER_HOST`: عنوان IP أو اسم الخادم.
- `SERVER_USER`: مستخدم النشر.
- `SERVER_SSH_KEY`: المفتاح الخاص الذي يسمح لـ GitHub Actions بالدخول إلى الخادم.

يمكن إضافة `SERVER_PORT` إذا لم يكن منفذ SSH هو `22`. ويوصى بإضافة
`SERVER_KNOWN_HOSTS` من ناتج `ssh-keyscan -H <عنوان-الخادم>` بعد التحقق من بصمة الخادم يدوياً.

#### طريقة العمل اليومية

على Windows يمكن تشغيل `.\deploy.ps1` من جذر المشروع. يفتح السكربت نسخة `localhost:3000` للمعاينة أولاً وينتظر موافقة المستخدم قبل أي commit أو push. بعد الموافقة والدفع، ينتظر ظهور رقم commit المطلوب في `/api/health` ثم يفتح منصة الإنتاج تلقائياً في المتصفح الافتراضي.

```bash
git checkout -b feat/my-change
# عدّل واختبر محلياً على localhost
git add <الملفات-المقصودة>
git commit -m "وصف التغيير"
git push -u origin feat/my-change
```

بعد مراجعة Pull Request ودمجه في `main`، يبدأ النشر تلقائياً. لا ترفع `.env`
أو قاعدة SQLite أو مجلد `storage/` إلى GitHub، ولا تعدّل ملفات التطبيق مباشرة
على الخادم؛ فالسيرفر الإنتاجي يجب أن يبقى نسخة مطابقة لفرع `main`.

---

## 9. المراقبة

```bash
# حالة التطبيق
pm2 status
pm2 logs BCH --lines 50

# فحص الصحة
curl http://localhost:3002/api/health

# مراقبة النظام
htop
df -h          # مساحة القرص
free -m        # الذاكرة
sudo systemctl status nginx
sudo systemctl status postgresql
```

---

## 10. استكشاف الأخطاء

| المشكلة | الحل |
|---|---|
| `ECONNREFUSED 127.0.0.1:3002` | `pm2 restart BCH` |
| `Database connection failed` | تحقق من `DATABASE_URL` + `pg_hba.conf` |
| `502 Bad Gateway` | تأكد أن Next.js يعمل: `pm2 status` |
| الصفحة البيضاء | تحقق من السجلات: `pm2 logs BCH` |
| رفع الملفات يفشل | `client_max_body_size` في Nginx |
| SSL منتهي | `sudo certbot renew` |

---

## 11. قائمة فحص ما قبل الإطلاق

- [ ] تغيير `INITIAL_SETUP_TOKEN` وكلمات المرور الافتراضية
- [ ] `ALLOW_DEMO_SEED=false` في الإنتاج
- [ ] شهادة SSL صالحة + تجديد تلقائي
- [ ] النسخ الاحتياطي اليومي يعمل
- [ ] `pm2 startup` مُفعّل (إعادة تشغيل تلقائي)
- [ ] Firewall مُفعّل (ufw): 22, 80, 443 فقط
- [ ] `NODE_ENV=production`
- [ ] مجلد `storage/` قابل للكتابة
- [ ] مراقبة `/api/health` تعمل
- [ ] اختبار رفع الصور (5MB+)
