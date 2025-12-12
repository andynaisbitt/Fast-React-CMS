#!/bin/bash
# Script to rename Backend → backend, Frontend → frontend on Windows
# Must be run when no processes have files open in these directories

set -e

echo "🔄 Phase 3: Renaming directories to lowercase..."
echo ""

cd "$(dirname "$0")"

# Check if directories exist
if [ ! -d "Backend" ]; then
    echo "❌ Backend directory not found!"
    exit 1
fi

if [ ! -d "Frontend" ]; then
    echo "❌ Frontend directory not found!"
    exit 1
fi

# Configure git for case-sensitive operations
echo "⚙️  Configuring git..."
git config core.ignorecase false

# Two-step rename for Backend
echo "📁 Renaming Backend → backend..."
if git mv Backend backend_temp 2>/dev/null; then
    git mv backend_temp backend
    echo "✅ Backend renamed successfully"
else
    echo "⚠️  Direct rename failed, trying alternative method..."

    # Alternative: Remove from index and re-add with new name
    git rm -r --cached Backend
    git add backend

    echo "✅ Backend renamed using index manipulation"
fi

# Two-step rename for Frontend
echo "📁 Renaming Frontend → frontend..."
if git mv Frontend frontend_temp 2>/dev/null; then
    git mv frontend_temp frontend
    echo "✅ Frontend renamed successfully"
else
    echo "⚠️  Direct rename failed, trying alternative method..."

    # Alternative: Remove from index and re-add with new name
    git rm -r --cached Frontend
    git add frontend

    echo "✅ Frontend renamed using index manipulation"
fi

echo ""
echo "📊 Git status:"
git status --short | head -10

echo ""
echo "✅ Phase 3 complete! Ready to commit."
echo ""
echo "Next steps:"
echo "  git commit -m \"refactor(phase3): Rename directories to lowercase\""
echo "  git push origin master"
