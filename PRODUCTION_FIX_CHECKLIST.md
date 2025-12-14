# PRODUCTION FIX CHECKLIST - FastReactCMS
**Date:** 2025-12-14
**Status:** CRITICAL - Site Down
**Root Causes Identified:** Multiple configuration mismatches, duplicate directories, port conflicts

---

## ✅ VERIFIED WORKING LOCALLY
- [x] Zustand store files exist (`src/store/useSiteSettingsStore.ts`, `StoreInitializer.tsx`)
- [x] All 12 components updated to use Zustand store
- [x] App.tsx properly imports and renders `<StoreInitializer />`
- [x] Local build succeeds and includes store code in bundle
- [x] SSR server.js updated to use port 8100 and cache settings (5min TTL)
- [x] Backend admin.py fixed to use `by_alias=False` for saving settings

**Latest Commits:**
- `9c1350c` - Backend fix (site settings saving)
- `74dc0bf` - SSR port fix (8100)
- `3fd4ffd` - Zustand migration (eliminated 13+ API calls)

---

## 🔴 PRODUCTION ISSUES FOUND

### 1. **Duplicate Directory Structure**
**Problem:** Both `Frontend/` (capital F) and `frontend/` (lowercase) exist
**Impact:** Systemd services point to wrong paths
**Fix:**
```bash
cd /var/www/fastreactcms
sudo rm -rf Frontend Backend  # Remove old capital letter dirs
git status  # Clean untracked files
```

### 2. **Backend Service Path Mismatch**
**Problem:** Service file uses `/Backend/` (capital B), code is in `/backend/`
**Current State:**
```ini
WorkingDirectory=/var/www/fastreactcms/Backend  # WRONG
ExecStart=/var/www/fastreactcms/Backend/venv/bin/uvicorn  # WRONG
```
**Fix:**
```bash
sudo nano /etc/systemd/system/fastreactcms-backend.service
# Change ALL occurrences of Backend → backend
sudo systemctl daemon-reload
```

### 3. **SSR Service Path Mismatch**
**Problem:** WorkingDirectory points to `/Frontend/` (capital F)
**Current State:**
```ini
WorkingDirectory=/var/www/fastreactcms/Frontend  # WRONG
```
**Fix:**
```bash
sudo nano /etc/systemd/system/fastreactcms-ssr.service
# Change Frontend → frontend
sudo systemctl daemon-reload
```

### 4. **Port 8100 Conflict**
**Problem:** Something is already using port 8100, preventing backend from starting
**Error:** `address already in use`
**Fix:**
```bash
sudo netstat -tulpn | grep 8100  # Find what's using it
sudo kill -9 [PID]  # Kill the process
# OR kill all uvicorn processes:
sudo pkill -9 -f uvicorn
```

### 5. **Frontend Build Not Deployed**
**Problem:** Production has old build without Zustand fixes
**Evidence:** `grep -c "StoreInitializer" dist/assets/*.js` returns 0
**Fix:**
```bash
cd /var/www/fastreactcms/frontend
rm -rf dist node_modules/.vite
npm run build  # Takes ~2-3 minutes
# Verify: grep -l "siteSettings" dist/assets/index-*.js
```

### 6. **Database Credentials Mismatch**
**Production DB:** `fastreactcms` (not `blogcms_db`)
**User:** `fastreactcms_user` (not `itapp_user`)
**Password:** `m8UQQsJ0bLJhkL0RTu8cs9J37pW3Kda2bggBP6UrS4Y`

**Verify backend .env has correct credentials:**
```bash
cat /var/www/fastreactcms/backend/.env | grep DATABASE_URL
# Should be: postgresql://fastreactcms_user:PASSWORD@localhost/fastreactcms
```

---

## 📋 STEP-BY-STEP FIX PROCEDURE

### **Phase 1: Clean Up Directories** (5 min)
```bash
cd /var/www/fastreactcms
sudo rm -rf Frontend Backend  # Remove old dirs
git clean -fd  # Remove untracked files
git status  # Should be clean
```

### **Phase 2: Fix Systemd Services** (5 min)
```bash
# Fix backend service
sudo sed -i 's|/Backend/|/backend/|g' /etc/systemd/system/fastreactcms-backend.service

# Fix SSR service
sudo sed -i 's|/Frontend/|/frontend/|g' /etc/systemd/system/fastreactcms-ssr.service

# Reload systemd
sudo systemctl daemon-reload

# Verify changes
cat /etc/systemd/system/fastreactcms-backend.service | grep WorkingDirectory
cat /etc/systemd/system/fastreactcms-ssr.service | grep WorkingDirectory
```

### **Phase 3: Kill Port Conflicts** (2 min)
```bash
# Find and kill process using port 8100
sudo netstat -tulpn | grep 8100
sudo pkill -9 -f uvicorn

# Verify port is free
sudo netstat -tulpn | grep 8100  # Should return nothing
```

### **Phase 4: Update and Build Frontend** (5 min)
```bash
cd /var/www/fastreactcms/frontend
git pull origin master
git log -1 --oneline  # Should show 9c1350c or later

# Clean rebuild
rm -rf dist node_modules/.vite
npm run build  # Wait 2-3 minutes

# Verify build has Zustand code
ls -lh dist/index.html  # Should exist
grep -l "siteSettings" dist/assets/index-*.js  # Should find files
```

### **Phase 5: Update Backend** (2 min)
```bash
cd /var/www/fastreactcms/backend
git pull origin master
git log -1 --oneline  # Should show 9c1350c

# Verify .env has correct database
cat .env | grep DATABASE_URL
# Should be: postgresql://fastreactcms_user:PASSWORD@localhost/fastreactcms
```

### **Phase 6: Start Services** (3 min)
```bash
# Start backend first
sudo systemctl start fastreactcms-backend
sleep 3
sudo systemctl status fastreactcms-backend --no-pager

# Verify backend is running
curl http://localhost:8100/api/v1/site-settings | head -5
# Should show JSON with "The IT Apprentice"

# Start SSR
sudo systemctl start fastreactcms-ssr
sleep 3
sudo systemctl status fastreactcms-ssr --no-pager

# Verify SSR is running
curl http://localhost:3001/health
# Should show: {"status":"ok","settings_cached":false,...}
```

### **Phase 7: Test Site** (2 min)
```bash
# Test homepage
curl -s https://theitapprentice.com/ | head -30
# Should show HTML with proper title (not 301/500 error)

# Test if settings are loaded
curl -s https://theitapprentice.com/ | grep "The IT Apprentice"
# Should find the text

# Check SSR cache after a request
curl http://localhost:3001/health
# Should now show: "settings_cached":true
```

### **Phase 8: Monitor** (5 min)
```bash
# Watch SSR logs
sudo journalctl -u fastreactcms-ssr -f

# In another terminal, watch backend logs
sudo journalctl -u fastreactcms-backend -f

# In browser:
# 1. Open https://theitapprentice.com in INCOGNITO window
# 2. Open DevTools (F12) → Network tab
# 3. Hard refresh (Ctrl+Shift+R)
# 4. Check for:
#    - ONE call to /api/v1/site-settings (not 13+)
#    - Homepage shows "The IT Apprentice" title
#    - Hero text shows "Rebuilding, Reskilling, and Shipping for 2026"
```

---

## 🎯 EXPECTED RESULTS

### Before Fixes:
- ❌ 13+ API calls per page load
- ❌ SSR fetching settings on every request (no cache)
- ❌ Homepage shows "FastReactCMS" (defaults)
- ❌ CPU usage high from excessive API calls
- ❌ Services crash-looping

### After Fixes:
- ✅ **1 API call** on frontend startup
- ✅ SSR caches settings for **5 minutes**
- ✅ Homepage shows **"The IT Apprentice"** and correct hero text
- ✅ CPU usage normal (< 10%)
- ✅ All services running stable

---

## 🚨 TROUBLESHOOTING

### If backend won't start:
```bash
# Check error
sudo journalctl -u fastreactcms-backend -n 50 --no-pager | tail -20

# Try manual start to see error
cd /var/www/fastreactcms/backend
source venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8100
# Look for errors in output
```

### If SSR won't start:
```bash
# Check error
cat /var/log/fastreactcms-ssr-error.log | tail -30

# Try manual start
cd /var/www/fastreactcms/frontend
node server.js
# Look for errors in output
```

### If site still shows defaults:
```bash
# Check if API returns correct data
curl http://localhost:8100/api/v1/site-settings | grep siteTitle
# Should show: "siteTitle":"The IT Apprentice"

# Check if build has store code
cd /var/www/fastreactcms/frontend
grep -c "loadSettings" dist/assets/index-*.js
# Should be > 0

# Force browser cache clear
# Open in INCOGNITO or hard refresh (Ctrl+Shift+R)
```

---

## 📊 VERIFICATION CHECKLIST

- [ ] Frontend `/var/www/fastreactcms/frontend` exists (lowercase)
- [ ] Backend `/var/www/fastreactcms/backend` exists (lowercase)
- [ ] No `Frontend/` or `Backend/` directories exist
- [ ] Systemd services point to lowercase paths
- [ ] Port 8100 is free (nothing using it)
- [ ] Frontend build exists (`dist/index.html`)
- [ ] Backend .env has correct database credentials
- [ ] Backend responds on port 8100
- [ ] SSR responds on port 3001
- [ ] NGINX proxies to SSR correctly
- [ ] Site loads without 301/500 errors
- [ ] Homepage shows "The IT Apprentice" title
- [ ] Only 1 API call to `/site-settings` on page load
- [ ] CPU usage < 10%

---

## 🔧 QUICK COMMANDS REFERENCE

```bash
# Service management
sudo systemctl status fastreactcms-backend
sudo systemctl status fastreactcms-ssr
sudo systemctl restart fastreactcms-backend
sudo systemctl restart fastreactcms-ssr
sudo systemctl stop fastreactcms-backend fastreactcms-ssr

# Logs
sudo journalctl -u fastreactcms-backend -f
sudo journalctl -u fastreactcms-ssr -f
cat /var/log/fastreactcms-ssr-error.log

# Health checks
curl http://localhost:8100/api/v1/site-settings
curl http://localhost:3001/health
curl https://theitapprentice.com/ | head -20

# Port checking
sudo netstat -tulpn | grep 8100
sudo netstat -tulpn | grep 3001

# Process management
sudo pkill -9 -f uvicorn
sudo pkill -9 -f "node server.js"
```

---

## 💡 LESSONS LEARNED

1. **Case sensitivity matters:** Linux is case-sensitive, Windows is not. The `Frontend/` vs `frontend/` mismatch caused major issues.

2. **Always verify deployed code:** The build existed locally but wasn't deployed/rebuilt on production.

3. **Port conflicts are silent killers:** Backend failing with "address in use" prevented everything from working.

4. **Test full deployment flow:** Changes committed locally must be: pulled → built → services restarted.

5. **Systemd hides errors:** Manual testing (`node server.js`, `uvicorn app.main:app`) reveals errors that systemd logs don't show clearly.

---

**Next Session Plan:**
1. Run through checklist systematically
2. Verify each step before moving to next
3. Test thoroughly at the end
4. Monitor for 10 minutes to ensure stability

**Estimated Time:** 30 minutes total
