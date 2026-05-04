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
echo "🌐 App will open at: http://localhost:5180/"
echo ""
echo "💡 To stop the server: Press Ctrl+C in this window"
echo "🔄 To restart: Just double-click this file again"
echo ""

# Start the development server in background
npm run dev &
DEV_PID=$!

# Optionally start the SillyTavern self-insert bridge if novel-analyzer is present.
# The bridge serves http://localhost:5001 and powers the portal/self-insert button.
# Without it the portal button is auto-hidden in the UI (issue #4).
BRIDGE_DIR="/Users/aditya/Documents/Ongoing Local/ST/novel-analyzer"
BRIDGE_PID=""
if [ -d "$BRIDGE_DIR" ] && [ -f "$BRIDGE_DIR/bridge.py" ]; then
    if command -v uvicorn >/dev/null 2>&1; then
        echo "🌀 Starting SillyTavern bridge at http://localhost:5001 ..."
        (cd "$BRIDGE_DIR" && uvicorn bridge:app --port 5001) &
        BRIDGE_PID=$!
    elif [ -d "$BRIDGE_DIR/.venv" ]; then
        echo "🌀 Starting SillyTavern bridge via venv at http://localhost:5001 ..."
        (cd "$BRIDGE_DIR" && .venv/bin/uvicorn bridge:app --port 5001) &
        BRIDGE_PID=$!
    else
        echo "⚠️  Bridge directory found but uvicorn isn't on PATH or in .venv — skipping."
        echo "   Run manually: cd \"$BRIDGE_DIR\" && uvicorn bridge:app --port 5001"
    fi
else
    echo "ℹ️  SillyTavern bridge not found at $BRIDGE_DIR — portal button will be hidden."
fi

# Cleanup both processes on Ctrl+C
cleanup() {
    echo ""
    echo "🛑 Shutting down..."
    [ -n "$BRIDGE_PID" ] && kill "$BRIDGE_PID" 2>/dev/null
    [ -n "$DEV_PID" ] && kill "$DEV_PID" 2>/dev/null
    exit 0
}
trap cleanup INT TERM

# Wait a moment for the server to start
echo "⏳ Waiting for server to start..."
sleep 4

# Open browser
echo "🌐 Opening browser..."
open http://localhost:5180/

# Keep the terminal window open
echo ""
echo "✨ LexiconForge is now running!"
echo "📱 Check your browser at http://localhost:5180/"
[ -n "$BRIDGE_PID" ] && echo "🌀 SillyTavern bridge running at http://localhost:5001/"
echo ""
echo "🛑 To stop everything, close this window or press Ctrl+C"

# Wait for the npm process (and any bridge) to finish
wait $DEV_PID
