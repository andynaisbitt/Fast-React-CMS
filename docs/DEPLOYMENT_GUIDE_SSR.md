# FastReactCMS - SSR Deployment Guide

**Quick deployment guide for canonical URL support and SSR functionality.**

---

## 🚀 Quick Deployment (5 Steps)

### Step 1: Prepare Production Server

```bash
# SSH into production server
ssh user@theitapprentice.com

# Navigate to project directory
cd /var/www/fastreactcms

# Pull latest code from GitHub
git pull origin master  # or main

# Verify files are present
ls -l Frontend/server.js
ls -l deployment/fastreactcms-ssr.service
ls -l deployment/nginx.conf
```

### Step 2: Deploy Backend (Database + API)

```bash
# Navigate to backend
cd /var/www/fastreactcms/Backend

# Activate virtual environment
source venv/bin/activate

# Run database migration
alembic upgrade head

# Verify migration
alembic current
# Expected output: 6f7e8d9c0a1b (head)

# Restart backend service
sudo systemctl restart fastreactcms-backend

# Verify backend is running
sudo systemctl status fastreactcms-backend
curl http://localhost:8100/health
```

### Step 3: Build and Deploy Frontend

```bash
cd /var/www/fastreactcms/Frontend

# Install dependencies (if package.json changed)
npm install

# Build production bundle
npm run build

# Verify dist/ directory
ls -lh dist/

# Frontend is now ready (NGINX will serve automatically)
```

### Step 4: Setup SSR Server

```bash
# Create SSR directory
sudo mkdir -p /var/www/fastreactcms/ssr
cd /var/www/fastreactcms/ssr

# Copy SSR files
sudo cp /var/www/fastreactcms/Frontend/server.js .
sudo cp /var/www/fastreactcms/Frontend/ssr-package.json package.json

# Install Node.js dependencies
sudo npm install

# Create log files
sudo touch /var/log/fastreactcms-ssr.log
sudo touch /var/log/fastreactcms-ssr-error.log
sudo chown www-data:www-data /var/log/fastreactcms-ssr*.log

# Set correct permissions
sudo chown -R www-data:www-data /var/www/fastreactcms/ssr

# Install systemd service
sudo cp /var/www/fastreactcms/deployment/fastreactcms-ssr.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable service (start on boot)
sudo systemctl enable fastreactcms-ssr

# Start SSR server
sudo systemctl start fastreactcms-ssr

# Verify SSR server is running
sudo systemctl status fastreactcms-ssr
curl http://localhost:3001/health
```

Expected health response:
```json
{
  "status": "ok",
  "cache_size": 0,
  "cache_max": 100,
  "uptime": 1.234
}
```

### Step 5: Update NGINX

```bash
# Backup current NGINX config
sudo cp /etc/nginx/sites-available/theitapprentice.com \
       /etc/nginx/sites-available/theitapprentice.com.backup.$(date +%F)

# Copy new config
sudo cp /var/www/fastreactcms/deployment/nginx.conf \
       /etc/nginx/sites-available/theitapprentice.com

# Test NGINX configuration
sudo nginx -t

# If test passes, reload NGINX
sudo systemctl reload nginx

# Verify NGINX is running
sudo systemctl status nginx
```

---

## ✅ Verification Tests

### Test 1: API Endpoints

```bash
# Test unified content lookup
curl "http://localhost:8100/api/v1/content/by-canonical?url=https://theitapprentice.com/RAM-Price-Spikes"

# Expected: JSON with type, slug, data
# If 404: No content with that canonical URL (OK if it doesn't exist yet)
```

### Test 2: SSR Server (Direct)

```bash
# Test SSR server health
curl http://localhost:3001/health

# Test SSR rendering with Googlebot User-Agent
curl -H "User-Agent: Mozilla/5.0 (compatible; Googlebot/2.1)" \
  http://localhost:3001/

# Should return HTML with meta tags
```

### Test 3: NGINX + SSR (Full Stack)

```bash
# Regular user (should get SPA)
curl -I https://theitapprentice.com/
# Should return 200 OK
# Should NOT have X-Rendered-By header

# Crawler (should get SSR)
curl -I -H "User-Agent: Mozilla/5.0 (compatible; Googlebot/2.1)" \
  https://theitapprentice.com/
# Should return 200 OK
# Should have: X-Rendered-By: SSR

# Test canonical URL resolution
curl -L -H "User-Agent: Mozilla/5.0 (compatible; Googlebot/2.1)" \
  https://theitapprentice.com/RAM-Price-Spikes
# Should return proper meta tags
```

### Test 4: Social Media Previews

Visit these tools to test:
1. **Facebook**: https://developers.facebook.com/tools/debug/
2. **LinkedIn**: https://www.linkedin.com/post-inspector/
3. **Twitter**: https://cards-dev.twitter.com/validator

Enter URL: `https://theitapprentice.com/blog/your-post-slug`
- Should show post-specific title, description, image
- Should NOT show generic "FastReactCMS" metadata

---

## 📊 Monitoring

### Check Service Status

```bash
# All services status
sudo systemctl status fastreactcms-backend
sudo systemctl status fastreactcms-ssr
sudo systemctl status nginx

# Quick health check
curl http://localhost:8100/health  # Backend
curl http://localhost:3001/health  # SSR
```

### View Logs

```bash
# SSR server logs
sudo tail -f /var/log/fastreactcms-ssr.log

# SSR error logs
sudo tail -f /var/log/fastreactcms-ssr-error.log

# NGINX access logs
sudo tail -f /var/log/nginx/theitapprentice.access.log

# NGINX error logs
sudo tail -f /var/log/nginx/theitapprentice.error.log

# Backend logs
sudo journalctl -u fastreactcms-backend -f

# SSR logs (systemd)
sudo journalctl -u fastreactcms-ssr -f
```

### Monitor SSR Cache

```bash
# Check cache stats
curl http://localhost:3001/health

# Expected response:
{
  "status": "ok",
  "cache_size": 42,      # Number of cached pages
  "cache_max": 100,      # Maximum cache size
  "uptime": 12345.67     # Uptime in seconds
}
```

---

## 🔧 Troubleshooting

### Issue: SSR Server Won't Start

**Check logs**:
```bash
sudo journalctl -u fastreactcms-ssr -n 50
```

**Common causes**:
1. Port 3001 already in use: `sudo lsof -i :3001`
2. Missing dependencies: `cd /var/www/fastreactcms/ssr && npm install`
3. Permissions issue: `sudo chown -R www-data:www-data /var/www/fastreactcms/ssr`
4. Node.js not installed: `node --version` (need 18+)

### Issue: Crawlers Not Getting SSR

**Check crawler detection**:
```bash
# Test with explicit User-Agent
curl -I -H "User-Agent: Googlebot/2.1" https://theitapprentice.com/

# Should have header: X-Rendered-By: SSR
# If missing, check NGINX config
```

**Verify NGINX config**:
```bash
sudo nginx -t
# Check for syntax errors

# Verify crawler map is present
sudo grep -A 10 "map.*is_crawler" /etc/nginx/sites-available/theitapprentice.com
```

### Issue: 404 on Canonical URLs

**Check database**:
```bash
# SSH to server
psql -U fastreactcms -d fastreactcms_db

# Check if canonical URLs exist
SELECT id, slug, canonical_url FROM blog_posts WHERE canonical_url IS NOT NULL;
SELECT id, slug, canonical_url FROM pages WHERE canonical_url IS NOT NULL;
```

**Test API endpoint**:
```bash
curl "http://localhost:8100/api/v1/content/by-canonical?url=YOUR_CANONICAL_URL"
# Should return JSON, not 404
```

### Issue: Meta Tags Not Appearing

**Verify SSR is active**:
```bash
curl -H "User-Agent: Googlebot/2.1" https://theitapprentice.com/blog/test-post | grep "<title>"
# Should see post title, not "FastReactCMS"
```

**Check SSR logs**:
```bash
sudo tail -f /var/log/fastreactcms-ssr.log
# Look for "Cache HIT" or "Cache MISS" messages
```

### Issue: High Memory Usage

**Check SSR cache size**:
```bash
curl http://localhost:3001/health
# If cache_size is near cache_max (100), this is normal
```

**Restart SSR server**:
```bash
sudo systemctl restart fastreactcms-ssr
# Cache will be cleared
```

---

## 🔄 Rollback Plan

If issues occur, rollback NGINX config:

```bash
# Stop SSR server
sudo systemctl stop fastreactcms-ssr

# Restore old NGINX config
sudo cp /etc/nginx/sites-available/theitapprentice.com.backup.YYYY-MM-DD \
       /etc/nginx/sites-available/theitapprentice.com

# Test config
sudo nginx -t

# Reload NGINX
sudo systemctl reload nginx
```

To rollback database migration:

```bash
cd /var/www/fastreactcms/Backend
source venv/bin/activate

# Rollback one migration
alembic downgrade -1

# Restart backend
sudo systemctl restart fastreactcms-backend
```

---

## 📝 Post-Deployment Checklist

- [ ] Backend migration applied: `alembic current`
- [ ] Backend service running: `systemctl status fastreactcms-backend`
- [ ] Frontend built: `ls Frontend/dist/index.html`
- [ ] SSR server running: `systemctl status fastreactcms-ssr`
- [ ] SSR health check: `curl http://localhost:3001/health`
- [ ] NGINX config updated: `nginx -t`
- [ ] NGINX reloaded: `systemctl status nginx`
- [ ] API endpoints working: `curl localhost:8100/api/v1/content/by-canonical?url=...`
- [ ] SSR rendering for crawlers: `curl -H "User-Agent: Googlebot" https://...`
- [ ] Regular users get SPA: `curl https://theitapprentice.com/`
- [ ] Social media previews tested (Facebook/LinkedIn/Twitter)
- [ ] Monitoring setup: Check logs for errors
- [ ] Backup NGINX config created
- [ ] Services set to start on boot: `systemctl is-enabled fastreactcms-ssr`

---

## 📞 Support

**Logs to check first**:
1. `/var/log/fastreactcms-ssr.log` - SSR server logs
2. `/var/log/nginx/theitapprentice.error.log` - NGINX errors
3. `journalctl -u fastreactcms-backend -n 50` - Backend errors

**Quick diagnostics**:
```bash
# All services running?
sudo systemctl status fastreactcms-backend fastreactcms-ssr nginx

# All ports listening?
sudo ss -tlnp | grep -E ':(8100|3001|443)'

# Any errors in logs?
sudo tail -n 20 /var/log/fastreactcms-ssr-error.log
```

---

**Document Version**: 1.0
**Last Updated**: 2025-12-10
**Estimated Deployment Time**: 30-45 minutes
