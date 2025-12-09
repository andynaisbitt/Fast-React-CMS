# FastReactCMS - Production Deployment Guide

> **Complete guide for deploying FastReactCMS to Google Cloud VM with PostgreSQL, NGINX, SSL, and CDN**

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Google Cloud VM Setup](#google-cloud-vm-setup)
3. [Domain & DNS Configuration](#domain--dns-configuration)
4. [Server Initial Setup](#server-initial-setup)
5. [PostgreSQL Installation](#postgresql-installation)
6. [Application Deployment](#application-deployment)
7. [NGINX Configuration](#nginx-configuration)
8. [SSL with Let's Encrypt](#ssl-with-lets-encrypt)
9. [Cloudflare Setup (Optional)](#cloudflare-setup-optional)
10. [CDN Configuration](#cdn-configuration)
11. [Monitoring & Maintenance](#monitoring--maintenance)
12. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools
- Google Cloud account with billing enabled
- Domain name (e.g., from Namecheap, GoDaddy, Google Domains)
- SSH client (built-in on macOS/Linux, PuTTY on Windows)
- Basic command-line knowledge

### Recommended VM Specs
- **Minimum**: e2-small (2 vCPU, 2GB RAM) - $13/month
- **Recommended**: e2-medium (2 vCPU, 4GB RAM) - $24/month
- **Production**: e2-standard-2 (2 vCPU, 8GB RAM) - $49/month

---

## Google Cloud VM Setup

### 1. Create VM Instance

```bash
# Via Google Cloud Console:
# 1. Go to Compute Engine > VM Instances
# 2. Click "Create Instance"
# 3. Configure:
#    - Name: fastreactcms-prod
#    - Region: us-central1 (or closest to your users)
#    - Machine type: e2-medium
#    - Boot disk: Ubuntu 22.04 LTS (20GB minimum)
#    - Firewall: Allow HTTP and HTTPS traffic
```

Or via gcloud CLI:

```bash
gcloud compute instances create fastreactcms-prod \
  --zone=us-central1-a \
  --machine-type=e2-medium \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=20GB \
  --boot-disk-type=pd-standard \
  --tags=http-server,https-server
```

### 2. Configure Firewall Rules

```bash
# Allow HTTP (80)
gcloud compute firewall-rules create allow-http \
  --allow tcp:80 \
  --target-tags http-server \
  --description="Allow HTTP traffic"

# Allow HTTPS (443)
gcloud compute firewall-rules create allow-https \
  --allow tcp:443 \
  --target-tags https-server \
  --description="Allow HTTPS traffic"
```

### 3. Reserve Static IP

```bash
# Reserve static IP
gcloud compute addresses create fastreactcms-ip --region=us-central1

# Get the IP address
gcloud compute addresses describe fastreactcms-ip --region=us-central1

# Assign to VM
gcloud compute instances delete-access-config fastreactcms-prod --access-config-name="external-nat"
gcloud compute instances add-access-config fastreactcms-prod \
  --access-config-name="external-nat" \
  --address=<STATIC_IP>
```

---

## Domain & DNS Configuration

### Option 1: Direct DNS (Without Cloudflare)

Configure your domain's DNS with these records:

```
Type    Name    Value               TTL
A       @       <STATIC_IP>         3600
A       www     <STATIC_IP>         3600
```

### Option 2: With Cloudflare (Recommended)

1. **Add Site to Cloudflare**:
   - Go to cloudflare.com and add your domain
   - Update nameservers at your domain registrar

2. **DNS Records**:
   ```
   Type    Name    Value               Proxy Status
   A       @       <STATIC_IP>         Proxied (Orange)
   A       www     <STATIC_IP>         Proxied (Orange)
   ```

3. **Cloudflare Settings**:
   - SSL/TLS: Full (strict)
   - Always Use HTTPS: On
   - Automatic HTTPS Rewrites: On
   - Brotli Compression: On

---

## Server Initial Setup

### 1. Connect to VM

```bash
# Via SSH
gcloud compute ssh fastreactcms-prod --zone=us-central1-a

# Or using standard SSH
ssh username@<STATIC_IP>
```

### 2. Update System

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y build-essential curl git ufw
```

### 3. Configure Firewall (UFW)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw enable
```

### 4. Create App User

```bash
sudo adduser --disabled-password --gecos "" appuser
sudo usermod -aG sudo appuser
echo "appuser ALL=(ALL) NOPASSWD:ALL" | sudo tee /etc/sudoers.d/appuser
```

---

## PostgreSQL Installation

### 1. Install PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
```

### 2. Configure Database

```bash
# Switch to postgres user
sudo -u postgres psql

-- Create database and user
CREATE DATABASE fastreactcms;
CREATE USER fastreactcms_user WITH PASSWORD 'CHANGE_THIS_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE fastreactcms TO fastreactcms_user;

-- Grant schema permissions (PostgreSQL 15+)
\c fastreactcms
GRANT ALL ON SCHEMA public TO fastreactcms_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO fastreactcms_user;

-- Exit
\q
```

### 3. Configure PostgreSQL for Remote Access (Optional)

```bash
# Edit postgresql.conf
sudo nano /etc/postgresql/14/main/postgresql.conf
# Set: listen_addresses = 'localhost'

# Edit pg_hba.conf
sudo nano /etc/postgresql/14/main/pg_hba.conf
# Add: local   all   fastreactcms_user   md5

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### 4. Test Connection

```bash
psql -h localhost -U fastreactcms_user -d fastreactcms
# Enter password when prompted
# Type \q to exit
```

---

## Application Deployment

### 1. Clone Repository

```bash
# Switch to app user
sudo su - appuser

# Clone repo
cd /home/appuser
git clone https://github.com/yourusername/fastreactcms.git
cd fastreactcms
```

### 2. Backend Setup

```bash
cd Backend

# Install Python 3.10+
sudo apt install -y python3.10 python3.10-venv python3-pip

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn

# Create .env file
cp .env.example .env
nano .env
```

**Edit `.env` with production values:**

```env
# Database
DATABASE_URL=postgresql://fastreactcms_user:YOUR_PASSWORD@localhost/fastreactcms

# Security (GENERATE NEW SECRETS!)
SECRET_KEY=$(openssl rand -hex 32)
CSRF_SECRET_KEY=$(openssl rand -hex 32)

# Admin
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=STRONG_PASSWORD_HERE

# Cookie Security
COOKIE_SECURE=true
COOKIE_SAMESITE=lax
ENVIRONMENT=production

# CORS
CORS_ORIGINS=["https://yourdomain.com","https://www.yourdomain.com"]
```

**Run Migrations:**

```bash
alembic upgrade head

# Seed initial data
python scripts/create_admin.py
python scripts/seed_categories.py
python scripts/seed_navigation_theme.py
python scripts/seed_pages.py
```

### 3. Frontend Setup

```bash
cd ../Frontend

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install dependencies
npm install

# Create .env file
cp .env.example .env
nano .env
```

**Edit `.env`:**

```env
VITE_API_URL=https://yourdomain.com
```

**Build for Production:**

```bash
npm run build
# Output in Frontend/dist/
```

### 4. Create Systemd Service for Backend

```bash
sudo nano /etc/systemd/system/fastreactcms.service
```

**Service File:**

```ini
[Unit]
Description=FastReactCMS Backend
After=network.target postgresql.service

[Service]
Type=notify
User=appuser
Group=appuser
WorkingDirectory=/home/appuser/fastreactcms/Backend
Environment="PATH=/home/appuser/fastreactcms/Backend/venv/bin"
ExecStart=/home/appuser/fastreactcms/Backend/venv/bin/gunicorn app.main:app \
    --workers 4 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 127.0.0.1:8100 \
    --timeout 60 \
    --access-logfile /var/log/fastreactcms/access.log \
    --error-logfile /var/log/fastreactcms/error.log

Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Enable and Start Service:**

```bash
# Create log directory
sudo mkdir -p /var/log/fastreactcms
sudo chown appuser:appuser /var/log/fastreactcms

# Enable service
sudo systemctl daemon-reload
sudo systemctl enable fastreactcms
sudo systemctl start fastreactcms
sudo systemctl status fastreactcms
```

---

## NGINX Configuration

### 1. Install NGINX

```bash
sudo apt install -y nginx
```

### 2. Create Site Configuration

```bash
sudo nano /etc/nginx/sites-available/fastreactcms
```

**NGINX Configuration:**

```nginx
# Rate limiting
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=login_limit:10m rate=5r/m;

# Upstream backend
upstream backend {
    server 127.0.0.1:8100;
}

# HTTP -> HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL certificates (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Frontend (React SPA)
    root /home/appuser/fastreactcms/Frontend/dist;
    index index.html;

    # Static files with caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API endpoints
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;

        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support (if needed)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Auth endpoints with stricter rate limiting
    location /auth/login {
        limit_req zone=login_limit burst=3 nodelay;

        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend docs
    location /docs {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend static files (uploads)
    location /static/ {
        alias /home/appuser/fastreactcms/Backend/static/;
        expires 30d;
        add_header Cache-Control "public";
    }

    # React Router fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Deny access to sensitive files
    location ~ /\. {
        deny all;
    }
}
```

### 3. Enable Site

```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/fastreactcms /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Restart NGINX
sudo systemctl restart nginx
```

---

## SSL with Let's Encrypt

### 1. Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 2. Obtain Certificate

```bash
# Stop NGINX temporarily
sudo systemctl stop nginx

# Obtain certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Follow prompts:
# - Enter email address
# - Agree to terms
# - Optional: Share email with EFF
```

### 3. Auto-Renewal

```bash
# Test renewal
sudo certbot renew --dry-run

# Certbot creates a cron job automatically at:
# /etc/cron.d/certbot
```

### 4. Restart NGINX

```bash
sudo systemctl start nginx
sudo systemctl status nginx
```

### 5. Verify SSL

Visit https://www.ssllabs.com/ssltest/ and test your domain (should get A+ rating).

---

## Cloudflare Setup (Optional)

### Benefits of Cloudflare
- **DDoS Protection** - Automatic mitigation
- **Global CDN** - Edge caching worldwide
- **Web Application Firewall** - Bot protection
- **Analytics** - Traffic insights
- **Free SSL** - Cloudflare-issued certificates

### Configuration Steps

1. **Add Site to Cloudflare**
   - Go to cloudflare.com → Add Site
   - Follow DNS setup instructions

2. **SSL/TLS Settings**
   ```
   SSL/TLS Encryption Mode: Full (strict)
   Always Use HTTPS: On
   Automatic HTTPS Rewrites: On
   Minimum TLS Version: 1.2
   Opportunistic Encryption: On
   TLS 1.3: On
   ```

3. **Speed Settings**
   ```
   Auto Minify: JS, CSS, HTML
   Brotli Compression: On
   Early Hints: On
   HTTP/2 to Origin: On
   HTTP/3 (with QUIC): On
   Rocket Loader: Off (conflicts with React)
   ```

4. **Caching**
   ```
   Caching Level: Standard
   Browser Cache TTL: 4 hours
   Always Online: On
   Development Mode: Off
   ```

5. **Page Rules** (example):
   ```
   Rule 1: yourdomain.com/static/*
   - Cache Level: Cache Everything
   - Edge Cache TTL: 1 month

   Rule 2: yourdomain.com/api/*
   - Cache Level: Bypass

   Rule 3: yourdomain.com/*
   - SSL: Full (strict)
   - Always Use HTTPS: On
   ```

6. **Firewall Rules** (optional):
   ```
   Block bots:
   (cf.bot_management.score lt 30) or (cf.threat_score gt 10)
   Action: Block

   Rate limit API:
   (http.request.uri.path contains "/api/")
   Action: Rate Limit (100 req/min)
   ```

### Origin Certificate (for Full Strict SSL)

```bash
# On server, download Cloudflare Origin Certificate
sudo mkdir -p /etc/cloudflare/certs
cd /etc/cloudflare/certs

# Generate certificate in Cloudflare dashboard:
# SSL/TLS → Origin Server → Create Certificate
# Copy certificate and private key

sudo nano origin-cert.pem  # Paste certificate
sudo nano origin-key.pem   # Paste private key
sudo chmod 600 origin-*.pem

# Update NGINX config
sudo nano /etc/nginx/sites-available/fastreactcms
```

Update SSL paths:
```nginx
ssl_certificate /etc/cloudflare/certs/origin-cert.pem;
ssl_certificate_key /etc/cloudflare/certs/origin-key.pem;
```

---

## CDN Configuration

### Option 1: Cloudflare CDN (Recommended)

Already included if using Cloudflare! Auto-caches static assets globally.

### Option 2: Google Cloud CDN

```bash
# Create backend bucket for static assets
gsutil mb gs://fastreactcms-static

# Upload frontend build
cd /home/appuser/fastreactcms/Frontend/dist
gsutil -m rsync -r . gs://fastreactcms-static

# Make bucket public
gsutil iam ch allUsers:objectViewer gs://fastreactcms-static

# Enable Cloud CDN
gcloud compute backend-buckets create fastreactcms-cdn \
  --gcs-bucket-name=fastreactcms-static \
  --enable-cdn
```

Update NGINX to serve from CDN:
```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    proxy_pass https://storage.googleapis.com/fastreactcms-static;
}
```

### Option 3: BunnyCDN (Budget Option - $1/TB)

1. Sign up at bunny.net
2. Create Pull Zone pointing to your domain
3. Update asset URLs in frontend to use CDN URL

---

## Monitoring & Maintenance

### 1. Log Management

```bash
# View backend logs
sudo journalctl -u fastreactcms -f

# View NGINX logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Rotate logs
sudo nano /etc/logrotate.d/fastreactcms
```

**Logrotate Config:**
```
/var/log/fastreactcms/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 appuser appuser
    sharedscripts
    postrotate
        systemctl reload fastreactcms > /dev/null
    endscript
}
```

### 2. Database Backups

```bash
# Create backup script
sudo nano /usr/local/bin/backup-db.sh
```

**Backup Script:**
```bash
#!/bin/bash
BACKUP_DIR="/home/appuser/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup database
pg_dump -h localhost -U fastreactcms_user fastreactcms | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Keep last 7 days
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete

echo "Backup completed: db_$DATE.sql.gz"
```

```bash
# Make executable
sudo chmod +x /usr/local/bin/backup-db.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /usr/local/bin/backup-db.sh
```

### 3. Monitoring (Optional)

**Install Prometheus + Grafana:**
```bash
# Install Prometheus
wget https://github.com/prometheus/prometheus/releases/download/v2.40.0/prometheus-2.40.0.linux-amd64.tar.gz
tar xvfz prometheus-*.tar.gz
sudo mv prometheus-2.40.0.linux-amd64 /opt/prometheus

# Install Node Exporter
wget https://github.com/prometheus/node_exporter/releases/download/v1.5.0/node_exporter-1.5.0.linux-amd64.tar.gz
tar xvfz node_exporter-*.tar.gz
sudo mv node_exporter-1.5.0.linux-amd64 /opt/node_exporter
```

Or use Google Cloud Monitoring (built-in):
```bash
# Install monitoring agent
curl -sSO https://dl.google.com/cloudagents/add-google-cloud-ops-agent-repo.sh
sudo bash add-google-cloud-ops-agent-repo.sh --also-install
```

### 4. Update Deployment Script

```bash
# Create update script
nano /home/appuser/update.sh
```

**Update Script:**
```bash
#!/bin/bash
set -e

echo "🚀 Updating FastReactCMS..."

cd /home/appuser/fastreactcms

# Pull latest code
git pull origin main

# Backend updates
cd Backend
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head

# Frontend updates
cd ../Frontend
npm install
npm run build

# Restart backend
sudo systemctl restart fastreactcms

# Reload NGINX
sudo systemctl reload nginx

echo "✅ Update complete!"
```

```bash
chmod +x /home/appuser/update.sh
```

---

## Troubleshooting

### Backend Won't Start

```bash
# Check service status
sudo systemctl status fastreactcms

# Check logs
sudo journalctl -u fastreactcms -n 50 --no-pager

# Common issues:
# 1. Database connection error → Check DATABASE_URL in .env
# 2. Port in use → sudo lsof -i :8100
# 3. Permission error → Check file ownership (appuser:appuser)
```

### SSL Certificate Issues

```bash
# Renew certificate manually
sudo certbot renew --force-renewal

# Check certificate expiry
sudo certbot certificates

# Test renewal
sudo certbot renew --dry-run
```

### NGINX 502 Bad Gateway

```bash
# Check if backend is running
sudo systemctl status fastreactcms

# Check NGINX error logs
sudo tail -f /var/log/nginx/error.log

# Test backend directly
curl http://localhost:8100/health
```

### Database Connection Errors

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -h localhost -U fastreactcms_user -d fastreactcms

# Check pg_hba.conf
sudo cat /etc/postgresql/14/main/pg_hba.conf
```

### Performance Issues

```bash
# Check resource usage
htop
df -h
free -m

# Check slow queries
sudo -u postgres psql fastreactcms
SELECT * FROM pg_stat_activity WHERE state = 'active';

# Optimize PostgreSQL
sudo nano /etc/postgresql/14/main/postgresql.conf
# Adjust: shared_buffers, work_mem, effective_cache_size
```

---

## Quick Reference Commands

```bash
# Restart backend
sudo systemctl restart fastreactcms

# Reload NGINX
sudo systemctl reload nginx

# View backend logs
sudo journalctl -u fastreactcms -f

# View NGINX logs
sudo tail -f /var/log/nginx/error.log

# Backup database
/usr/local/bin/backup-db.sh

# Update application
/home/appuser/update.sh

# Check SSL certificate
sudo certbot certificates

# Monitor system resources
htop
```

---

## Security Checklist

- [ ] Strong database password
- [ ] Unique SECRET_KEY and CSRF_SECRET_KEY (32+ chars)
- [ ] COOKIE_SECURE=true in production
- [ ] HTTPS enforced (SSL certificate valid)
- [ ] Firewall configured (UFW)
- [ ] Regular backups configured
- [ ] Log rotation enabled
- [ ] Strong admin password (12+ chars)
- [ ] CORS origins restricted to your domain
- [ ] Rate limiting configured in NGINX
- [ ] Security headers enabled
- [ ] PostgreSQL not exposed to public
- [ ] SSH key authentication (disable password auth)
- [ ] Auto-updates enabled: `sudo apt install unattended-upgrades`

---

## Performance Optimization

### Database Tuning

```bash
sudo nano /etc/postgresql/14/main/postgresql.conf
```

```ini
# For 4GB RAM server
shared_buffers = 1GB
effective_cache_size = 3GB
maintenance_work_mem = 256MB
work_mem = 16MB
max_connections = 100
```

### NGINX Caching

```nginx
# Add to server block
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=100m inactive=60m;

location /api/v1/blog/posts {
    proxy_cache api_cache;
    proxy_cache_valid 200 5m;
    proxy_cache_use_stale error timeout updating;
    add_header X-Cache-Status $upstream_cache_status;

    proxy_pass http://backend;
}
```

### Gunicorn Workers

```bash
# Adjust workers based on CPU cores
# Formula: (2 × CPU cores) + 1

# For 2 vCPU
--workers 5

# For 4 vCPU
--workers 9
```

---

**Deployment complete!** 🎉

Your FastReactCMS instance should now be live at `https://yourdomain.com`

For support, see the main [README.md](README.md) or open an issue on GitHub.
