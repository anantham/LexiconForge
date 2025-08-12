#!/bin/bash

# LexiconForge Startup Script
# Double-click this file to start the development server

echo "🚀 Starting LexiconForge..."
echo "📍 Project location: $(pwd)"

# Change to the project directory
cd "/Users/aditya/Documents/Ongoing Local/LexiconForge"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Could not find package.json in current directory"
    echo "📂 Current directory: $(pwd)"
    echo "⏸️  Press any key to exit..."
    read -n 1
    exit 1
fi

echo "✅ Found project files"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo "🔥 Starting development server..."
echo "🌐 App will open at: http://localhost:5173/"
echo ""
echo "💡 To stop the server: Press Ctrl+C in this window"
echo "🔄 To restart: Just double-click this file again"
echo ""

# Start the development server and open browser after a short delay
npm run dev &
DEV_PID=$!

# Wait a moment for the server to start
echo "⏳ Waiting for server to start..."
sleep 4

# Open browser
echo "🌐 Opening browser..."
open http://localhost:5173/

# Keep the terminal window open
echo ""
echo "✨ LexiconForge is now running!"
echo "📱 Check your browser at http://localhost:5173/"
echo ""
echo "🛑 To stop the server, close this window or press Ctrl+C"

# Wait for the npm process to finish (when user stops the server)
wait $DEV_PID