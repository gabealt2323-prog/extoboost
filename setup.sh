#!/bin/bash
# Extoboost Key System - Setup Script (Unix/macOS)
set -e

echo "=== Extoboost Key System Setup ==="
echo ""

if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org"
    exit 1
fi
echo "Node.js detected: $(node --version)"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Create PostgreSQL database
if command -v createdb &> /dev/null; then
    echo "Creating database 'extoboost'..."
    createdb extoboost 2>/dev/null || echo "Database may already exist"
fi

echo ""
echo "[1/3] Setting up Backend..."
cd "$SCRIPT_DIR/backend"
npm install
cp .env.example .env 2>/dev/null || true
echo "  Backend ready."

echo ""
echo "[2/3] Setting up Web Frontend..."
cd "$SCRIPT_DIR/web"
npm install
cp .env.example .env 2>/dev/null || true
echo "  Web frontend ready."

echo ""
echo "[3/3] Setting up Desktop App..."
cd "$SCRIPT_DIR/desktop"
npm install
echo "  Desktop app ready."

cd "$SCRIPT_DIR"
echo ""
echo "=== Setup Complete ==="
echo ""
echo "To start:"
echo "  Terminal 1: cd backend  && npm run dev"
echo "  Terminal 2: cd web     && npm run dev"
echo "  Terminal 3: cd desktop && npm run dev (optional)"
echo "  Open http://localhost:3000"
