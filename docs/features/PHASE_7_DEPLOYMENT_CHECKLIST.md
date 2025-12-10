# Phase 7: Production Deployment - Checklist

**Status**: 📋 **Ready to Deploy**
**Estimated Time**: 30-45 minutes
**Downtime Expected**: <5 minutes (NGINX reload only)

---

## 🎯 Pre-Deployment Checklist

### Prerequisites

- [x] All code committed to GitHub (commit: `6d7e7d2`)
- [x] Local testing complete (Phase 6: 10/10 tests passed)
- [x] Documentation complete
- [ ] Production server access verified (SSH)
- [ ] Backup of current production database
- [ ] NGINX configuration backed up

---

## 📋 Deployment Steps

### Step 1: Backup Production (5 minutes)

**Commands**:
```bash
# SSH into production server
ssh user@theitapprentice.com

# Backup current NGINX configuration
sudo cp /etc/nginx/sites-available/theitapprentice.com \
     /etc/nginx/sites-available/theitapprentice.com.backup-$(date +%Y%m%d)

# Backup database
pg_dump -U itapp_user blogcms_db > ~/backups/blogcms_db_backup_$(date +%Y%m%d_%H%M%S).sql
```

**Verification**:
- [ ] NGINX config backup created
- [ ] Database backup created
- [ ] Backup files verified (check file sizes)

---

### Step 2: Pull Latest Code (2 minutes)

**Commands**:
```bash
# Navigate to project directory
cd /var/www/FastReactCMS  # Adjust path as needed

# Pull latest changes from GitHub
git fetch origin
git pull origin master

# Verify commit hash
git log -1 --oneline
# Should show: 6d7e7d2 feat: Add canonical URL support and SSR for crawlers
```

**Verification**:
- [ ] Latest code pulled successfully
- [ ] Commit hash matches: `6d7e7d2`
- [ ] All new files present (server.js, CanonicalResolver.tsx, etc.)

---

### Step 3: Backend Database Migration (3 minutes)

**Commands**:
```bash
# Navigate to Backend directory
cd Backend

# Activate virtual environment
source venv/bin/activate  # or: . venv/bin/activate

# Run database migration
python -m alembic upgrade 6f7e8d9c0a1b

# Verify migration applied
python -m alembic current
```

**Expected Output**:
```
INFO  [alembic.runtime.migration] Running upgrade 08038c92d6b9 -> 6f7e8d9c0a1b, add canonical_url to pages
```

**Verification**:
- [ ] Migration ran without errors
- [ ] Both heads present: `f8b6be7f8a0c` and `6f7e8d9c0a1b`
- [ ] pages table now has canonical_url column

**Rollback Command** (if needed):
```bash
python -m alembic downgrade 08038c92d6b9
```

---

### Step 4: Restart Backend Server (2 minutes)

**Commands**:
```bash
# Restart FastAPI backend service
sudo systemctl restart fastreactcms-backend

# Check status
sudo systemctl status fastreactcms-backend

# Check logs for errors
sudo journalctl -u fastreactcms-backend -n 50 --no-pager
```

**Verification**:
- [ ] Backend service restarted successfully
- [ ] No errors in logs
- [ ] API endpoint responding: `curl http://localhost:8000/health`

---

### Step 5: Install SSR Server Dependencies (3 minutes)

**Commands**:
```bash
# Navigate to Frontend directory
cd /var/www/FastReactCMS/Frontend  # Adjust path

# Install SSR server dependencies
npm install axios express lru-cache

# Verify installations
npm list axios express lru-cache
```

**Verification**:
- [ ] Dependencies installed successfully
- [ ] No npm errors
- [ ] package.json updated

---

### Step 6: Build Frontend (5 minutes)

**Commands**:
```bash
# Still in Frontend directory
npm run build

# Verify dist folder created
ls -lh dist/
```

**Expected Output**:
```
✓ 2022 modules transformed
✓ built in 4.24s
```

**Verification**:
- [ ] Build completed without errors
- [ ] dist/ folder contains all files
- [ ] CanonicalResolver component built
- [ ] Total bundle size ~385 kB

---

### Step 7: Configure SSR Server Systemd Service (5 minutes)

**Commands**:
```bash
# Copy systemd service file
sudo cp /var/www/FastReactCMS/deployment/fastreactcms-ssr.service \
        /etc/systemd/system/fastreactcms-ssr.service

# Edit service file to match your paths
sudo nano /etc/systemd/system/fastreactcms-ssr.service

# Reload systemd daemon
sudo systemctl daemon-reload

# Enable SSR service (start on boot)
sudo systemctl enable fastreactcms-ssr

# Start SSR service
sudo systemctl start fastreactcms-ssr

# Check status
sudo systemctl status fastreactcms-ssr

# Check logs
sudo journalctl -u fastreactcms-ssr -n 50 --no-pager
```

**Expected Log Output**:
```
[SSR] Server running on http://localhost:3001
[SSR] API Base URL: http://localhost:8000
[SSR] Site URL: https://theitapprentice.com
[SSR] Cache: max=100, ttl=3600000ms
```

**Service File Check**:
- [ ] WorkingDirectory path correct
- [ ] ExecStart path correct
- [ ] Environment variables set correctly (API_BASE_URL, SITE_URL)

**Verification**:
- [ ] SSR service started successfully
- [ ] No errors in logs
- [ ] Server listening on port 3001
- [ ] Test endpoint: `curl http://localhost:3001/health`

---

### Step 8: Update NGINX Configuration (5 minutes)

**Commands**:
```bash
# Copy new NGINX configuration
sudo cp /var/www/FastReactCMS/deployment/nginx.conf \
        /etc/nginx/sites-available/theitapprentice.com

# Test NGINX configuration syntax
sudo nginx -t

# If test passes, reload NGINX (NO DOWNTIME)
sudo systemctl reload nginx

# Check NGINX status
sudo systemctl status nginx
```

**NGINX Test Expected Output**:
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

**Verification**:
- [ ] NGINX syntax test passed
- [ ] NGINX reloaded without errors
- [ ] No error logs: `sudo tail -f /var/log/nginx/theitapprentice.error.log`

**Rollback Command** (if needed):
```bash
sudo cp /etc/nginx/sites-available/theitapprentice.com.backup-* \
        /etc/nginx/sites-available/theitapprentice.com
sudo nginx -t && sudo systemctl reload nginx
```

---

### Step 9: Verify Deployment (5 minutes)

#### Test 1: Health Checks

```bash
# Backend API health check
curl https://theitapprentice.com/api/v1/health

# SSR server health check (from server)
curl http://localhost:3001/health
```

**Expected Responses**:
- Backend: `{"status":"healthy","app":"BlogCMS","version":"1.0.0"}`
- SSR: `{"status":"ok","cache_size":0,"cache_max":100,"uptime":...}`

#### Test 2: Canonical URL API

```bash
# Test canonical URL lookup (should return 404 for now)
curl https://theitapprentice.com/api/v1/content/by-canonical?url=https://theitapprentice.com/test
```

**Expected**: `{"detail":"No published content found with canonical URL: https://theitapprentice.com/test"}`

#### Test 3: SSR with Crawler User-Agent

```bash
# Test from production server
curl -A "Googlebot/2.1" https://theitapprentice.com/blog/welcome-to-fastreactcms | grep -o '<meta property="og:title"[^>]*>'
```

**Expected**: Should see Open Graph meta tags in HTML

#### Test 4: Regular User (Non-Crawler)

```bash
# Test with normal user agent
curl https://theitapprentice.com/blog/welcome-to-fastreactcms | grep -o '<div id="root">'
```

**Expected**: Should see SPA (not SSR)

**Verification Checklist**:
- [ ] Backend API responding
- [ ] SSR server responding
- [ ] Canonical URL API working
- [ ] Crawlers receive SSR HTML with meta tags
- [ ] Regular users receive SPA
- [ ] No errors in logs

---

### Step 10: Monitor for Issues (10 minutes)

**Monitor Logs**:
```bash
# Backend logs
sudo journalctl -u fastreactcms-backend -f

# SSR server logs
sudo journalctl -u fastreactcms-ssr -f

# NGINX access logs (watch for crawler requests)
sudo tail -f /var/log/nginx/theitapprentice.access.log | grep -E 'googlebot|facebookbot|linkedinbot'

# NGINX error logs
sudo tail -f /var/log/nginx/theitapprentice.error.log
```

**Look For**:
- [ ] No errors in any logs
- [ ] Crawler requests being proxied to SSR server (port 3001)
- [ ] Regular requests going to static files / frontend
- [ ] SSR cache hits increasing over time

---

## 🧪 Post-Deployment Testing

### Test 1: Social Media Previews

**Facebook Sharing Debugger**:
1. Go to: https://developers.facebook.com/tools/debug/
2. Enter URL: `https://theitapprentice.com/blog/welcome-to-fastreactcms`
3. Click "Scrape Again"
4. Verify:
   - [ ] Correct title shown
   - [ ] Correct description shown
   - [ ] Image shown (if featured image exists)

**LinkedIn Post Inspector**:
1. Go to: https://www.linkedin.com/post-inspector/
2. Enter URL: `https://theitapprentice.com/blog/welcome-to-fastreactcms`
3. Verify:
   - [ ] Correct title shown
   - [ ] Correct description shown
   - [ ] Image shown

**Twitter Card Validator**:
1. Go to: https://cards-dev.twitter.com/validator
2. Enter URL: `https://theitapprentice.com/blog/welcome-to-fastreactcms`
3. Verify:
   - [ ] Twitter Card shows correctly
   - [ ] Title and description correct

### Test 2: Canonical URL Redirects

1. Create a test page with canonical URL in admin panel
2. Set canonical_url to: `https://theitapprentice.com/RAM-Price-Spikes`
3. Navigate to: `https://theitapprentice.com/RAM-Price-Spikes`
4. Verify:
   - [ ] Redirects to actual page URL
   - [ ] No 404 error

### Test 3: Search Engine Crawling

**Google Search Console** (wait 24-48 hours):
1. Submit URL for indexing
2. Check coverage report
3. Verify:
   - [ ] Pages indexed with correct meta tags
   - [ ] No crawl errors

---

## 📊 Performance Monitoring

### Metrics to Track

**SSR Server**:
```bash
# Check cache statistics
curl http://localhost:3001/health | jq
```

**Track**:
- Cache hit rate (should increase over time)
- Cache size (should stay under 100)
- Server uptime
- Memory usage

**NGINX Logs Analysis** (after 1 week):
```bash
# Count crawler requests
sudo grep -E 'googlebot|facebookbot|linkedinbot' \
     /var/log/nginx/theitapprentice.access.log | wc -l

# Count requests to SSR server
sudo grep '127.0.0.1:3001' \
     /var/log/nginx/theitapprentice.access.log | wc -l
```

---

## 🚨 Rollback Procedure

**If anything goes wrong**, follow these steps:

### Quick Rollback (5 minutes)

```bash
# 1. Stop SSR server
sudo systemctl stop fastreactcms-ssr
sudo systemctl disable fastreactcms-ssr

# 2. Restore old NGINX config
sudo cp /etc/nginx/sites-available/theitapprentice.com.backup-* \
        /etc/nginx/sites-available/theitapprentice.com
sudo nginx -t && sudo systemctl reload nginx

# 3. Rollback database migration
cd /var/www/FastReactCMS/Backend
source venv/bin/activate
python -m alembic downgrade 08038c92d6b9

# 4. Restart backend
sudo systemctl restart fastreactcms-backend

# 5. Verify site is working
curl https://theitapprentice.com/api/v1/health
```

### Verify Rollback
- [ ] Site accessible
- [ ] Backend API responding
- [ ] Frontend loading normally
- [ ] No errors in logs

---

## ✅ Deployment Complete Checklist

### Pre-Deployment
- [ ] Production server access verified
- [ ] Database backed up
- [ ] NGINX config backed up

### Deployment
- [ ] Latest code pulled from GitHub
- [ ] Database migration applied
- [ ] Backend restarted successfully
- [ ] SSR dependencies installed
- [ ] Frontend built successfully
- [ ] SSR server systemd service configured
- [ ] SSR server running
- [ ] NGINX config updated
- [ ] NGINX reloaded successfully

### Post-Deployment Testing
- [ ] Backend API health check passing
- [ ] SSR server health check passing
- [ ] Canonical URL API working
- [ ] Crawlers receive SSR HTML
- [ ] Regular users receive SPA
- [ ] Facebook Sharing Debugger shows correct preview
- [ ] LinkedIn Post Inspector shows correct preview
- [ ] Twitter Card Validator shows correct card
- [ ] Canonical URL redirects working
- [ ] No errors in any logs

### Monitoring (First 24 Hours)
- [ ] Backend logs checked (no errors)
- [ ] SSR server logs checked (no errors)
- [ ] NGINX error logs checked (no errors)
- [ ] Crawler requests being served by SSR
- [ ] Cache hit rate increasing
- [ ] Server resources within normal range

---

## 📞 Support & Troubleshooting

### Common Issues

**Issue 1: SSR Server Won't Start**
```bash
# Check logs
sudo journalctl -u fastreactcms-ssr -n 100 --no-pager

# Common causes:
# - Port 3001 already in use
# - Missing dependencies
# - Incorrect paths in service file
```

**Issue 2: Meta Tags Not Showing for Crawlers**
```bash
# Test SSR directly
curl -A "Googlebot/2.1" https://theitapprentice.com/blog/test-post | grep "og:title"

# Check if NGINX is proxying to SSR
sudo tail -f /var/log/nginx/theitapprentice.access.log | grep '127.0.0.1:3001'
```

**Issue 3: High Server Load**
```bash
# Check SSR server resource usage
top | grep node

# Reduce cache size if needed (edit server.js):
# max: 50,  # Instead of 100

# Restart SSR
sudo systemctl restart fastreactcms-ssr
```

---

## 🎯 Success Criteria

Deployment is considered successful when:

1. ✅ All services running without errors
2. ✅ Social media previews showing correct metadata
3. ✅ Canonical URLs redirecting correctly
4. ✅ Search engine crawlers receiving SSR HTML
5. ✅ Regular users receiving SPA (fast load times)
6. ✅ No increase in server errors
7. ✅ No increase in server resource usage (< 10% increase)

---

## 📚 Reference Documents

- **Implementation Details**: `docs/features/CANONICAL_URL_SSR_IMPLEMENTATION_COMPLETE.md`
- **Deployment Guide**: `docs/DEPLOYMENT_GUIDE_SSR.md`
- **Testing Results**: `docs/features/PHASE_6_TESTING_COMPLETE.md`
- **Systemd Service**: `deployment/fastreactcms-ssr.service`
- **NGINX Config**: `deployment/nginx.conf`

---

**Phase 7 Status**: 📋 **READY TO DEPLOY**
**Estimated Downtime**: <5 minutes (NGINX reload only)
**Risk Level**: 🟢 **LOW** (easy rollback, comprehensive testing)
