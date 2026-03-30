#!/bin/bash
echo "🚀 Starting DiscArchive — Discord Group DM Search"
echo ""

# 1. Ask for JSON path if not provided
read -p "📁 Paste the full path to your Discord export JSON or ZIP (or press Enter): " JSON_PATH

if [ -z "$JSON_PATH" ]; then
    echo "⚠️  No path provided. You can paste it in the browser later."
else
    export AUTO_IMPORT_PATH="$JSON_PATH"
    echo "✅ Path set to: $JSON_PATH"
fi

echo ""
# Start Meilisearch
echo "📦 Starting Meilisearch..."
docker-compose up -d

# Install backend deps & start
echo "🐍 Setting up backend..."
cd backend
if [ ! -d "venv" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt -q
uvicorn main:app --port 8000 &
BACKEND_PID=$!
cd ..

# Install frontend deps & start
echo "⚛️  Setting up frontend..."
cd frontend
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    pnpm install --silent
fi
pnpm dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ DiscArchive is starting!"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:8000"
echo "   Meili:    http://localhost:7700"
echo ""
echo "🕒 Opening your browser in 5 seconds..."
sleep 5
open http://localhost:5173 2>/dev/null || xdg-open http://localhost:5173 2>/dev/null || echo "Please go to http://localhost:5173 in your browser."

echo "Press Ctrl+C to stop all services."

trap "kill $BACKEND_PID $FRONTEND_PID; docker-compose down; exit" SIGINT SIGTERM
wait
