# FastReactCMS - Quick Start Guide

> Get FastReactCMS up and running in under 5 minutes!

---

## Prerequisites

✅ Python 3.10+
✅ Node.js 18+
✅ PostgreSQL 14+ (can be installed automatically)
✅ Git

---

## 1. Clone Repository

```bash
git clone https://github.com/andynaisbitt/Fast-React-CMS.git
cd Fast-React-CMS
```

---

## 2. Automated Setup (Recommended)

```bash
# This script does EVERYTHING:
# ✅ Installs PostgreSQL
# ✅ Creates database and user
# ✅ Generates secure passwords and secrets
# ✅ Creates .env file
# ✅ Runs migrations

chmod +x setup-postgres.sh
./setup-postgres.sh
```

**Script Output:**
- Database credentials (saved to `Backend/.env`)
- Auto-generated secure passwords
- Ready-to-use configuration

---

## 3. Backend Setup

```bash
cd Backend

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (macOS/Linux)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Seed initial data
python scripts/create_admin.py
python scripts/seed_categories.py
python scripts/seed_navigation_theme.py
python scripts/seed_pages.py

# Start backend server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8100
```

**Backend running at:** http://localhost:8100
**API docs at:** http://localhost:8100/docs

---

## 4. Frontend Setup

```bash
# Open NEW terminal window
cd Frontend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev
```

**Frontend running at:** http://localhost:5173

---

## 5. First Login

1. Navigate to http://localhost:5173/admin
2. Login with credentials from `create_admin.py` script
3. Start creating content!

**Default Credentials:**
- Email: `admin@yourdomain.com` (or what you set in script)
- Password: (set during admin creation)

---

## Common Commands

### Backend

```bash
# Start server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8100

# Run migrations
alembic upgrade head

# Create migration
alembic revision --autogenerate -m "Description"

# View logs
tail -f Backend/logs/app.log  # (if logging enabled)
```

### Frontend

```bash
# Development server
npm run dev

# Production build
npm run build

# Lint code
npm run lint

# Preview production build
npm run preview
```

### Database

```bash
# Connect to database
psql -h localhost -U fastreactcms_user -d fastreactcms

# Backup database
pg_dump -h localhost -U fastreactcms_user fastreactcms > backup.sql

# Restore database
psql -h localhost -U fastreactcms_user fastreactcms < backup.sql
```

---

## Troubleshooting

### Backend won't start

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check database connection
psql -h localhost -U fastreactcms_user -d fastreactcms

# Check Python dependencies
pip install -r requirements.txt
```

### Frontend won't start

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check .env file exists
cat .env

# Check API URL is correct
echo $VITE_API_URL
```

### CORS errors

1. Ensure backend is running on port 8100
2. Check `CORS_ORIGINS` in Backend/.env includes `http://localhost:5173`
3. Ensure you're using `localhost`, NOT `127.0.0.1`

### Database connection errors

1. PostgreSQL must be running
2. Database credentials in `.env` must match PostgreSQL user/password
3. Database must exist (`CREATE DATABASE fastreactcms;`)

---

## Next Steps

### Create Your First Blog Post

1. Go to http://localhost:5173/admin
2. Click "Blog" in sidebar
3. Click "Create Post"
4. Fill in title, content, categories
5. Toggle "Published" and save!

### Customize Theme

1. Go to `/admin/settings/site`
2. Update site name, tagline, colors
3. Changes apply instantly!

### Build Custom Pages

1. Go to `/admin/pages`
2. Click "Create Page"
3. Use block editor to add content
4. Publish and view!

---

## Production Deployment

Ready to deploy? See [DEPLOYMENT.md](DEPLOYMENT.md) for:

- Google Cloud VM setup
- Domain & DNS configuration
- NGINX + SSL setup
- Cloudflare integration
- Performance optimization
- Monitoring & backups

---

## Need Help?

- **Documentation**: [README.md](README.md) (comprehensive guide)
- **API Docs**: http://localhost:8100/docs (interactive)
- **Issues**: https://github.com/andynaisbitt/Fast-React-CMS/issues
- **Discussions**: https://github.com/andynaisbitt/Fast-React-CMS/discussions

---

**That's it!** You're ready to start building with FastReactCMS! 🚀

For detailed documentation, see [README.md](README.md)
