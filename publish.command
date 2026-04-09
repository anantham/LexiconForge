#!/bin/bash
# LexiconForge Publish Bridge
# This script automates the git workflow after publishing from the web app.

# Get the directory where the script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "--------------------------------------------------"
echo "🚀 LexiconForge Git Publisher"
echo "--------------------------------------------------"

# Check if it's a git repo
if [ ! -d .git ]; then
    echo "❌ Error: This directory is not a git repository."
    echo "Please move this script to your novel library folder."
    read -p "Press enter to exit..."
    exit 1
fi

# Show status
echo "📦 Checking for changes..."
git status -s

# Ask for confirmation
echo ""
read -p "Do you want to commit and push these changes? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📝 Adding files..."
    git add .
    
    echo "💾 Committing..."
    git commit -m "Update novel translation and metadata"
    
    echo "☁️  Pushing to remote..."
    git push
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Successfully published to your repository!"
    else
        echo ""
        echo "❌ Error: Push failed. Check your internet connection or git permissions."
    fi
else
    echo "🚫 Operation cancelled."
fi

echo "--------------------------------------------------"
read -p "Press enter to close this window..."
