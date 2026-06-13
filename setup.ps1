# Extoboost Key System - Setup Script (Windows)
param(
    [switch]$SkipPostgres
)

Write-Host "=== Extoboost Key System Setup ===" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Host "Node.js detected: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org" -ForegroundColor Red
    exit 1
}

# Check/Create PostgreSQL database
if (-not $SkipPostgres) {
    try {
        $psqlPath = Get-Command psql -ErrorAction SilentlyContinue
        if (-not $psqlPath) {
            $psqlPath = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
        }
        if ($psqlPath) {
            $psqlExe = $psqlPath.FullName
            Write-Host "PostgreSQL detected, creating database..." -ForegroundColor Yellow
            & $psqlExe -U postgres -c "CREATE DATABASE extoboost;" 2>$null
            if ($?) {
                Write-Host "Database 'extoboost' created." -ForegroundColor Green
            } else {
                Write-Host "Database may already exist, continuing..." -ForegroundColor Gray
            }
        } else {
            Write-Host "PostgreSQL CLI not found. Install PostgreSQL or use -SkipPostgres" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "Could not create database. Use -SkipPostgres if already configured." -ForegroundColor Yellow
    }
}

$root = $PSScriptRoot

# Backend
Write-Host "`n[1/3] Setting up Backend..." -ForegroundColor Yellow
Set-Location -LiteralPath "$root\backend"
npm install
Copy-Item ".env.example" ".env" -Force
Write-Host "  Backend ready." -ForegroundColor Green

# Web
Write-Host "`n[2/3] Setting up Web Frontend..." -ForegroundColor Yellow
Set-Location -LiteralPath "$root\web"
npm install
Copy-Item ".env.example" ".env" -Force
Write-Host "  Web frontend ready." -ForegroundColor Green

# Desktop
Write-Host "`n[3/3] Setting up Desktop App..." -ForegroundColor Yellow
Set-Location -LiteralPath "$root\desktop"
npm install
Write-Host "  Desktop app ready." -ForegroundColor Green

Set-Location -LiteralPath "$root"

Write-Host "`n=== Setup Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "To start the system:" -ForegroundColor White
Write-Host "  1. Edit backend\.env with your Google OAuth credentials" -ForegroundColor Gray
Write-Host "  2. Terminal 1: cd backend  && npm run dev" -ForegroundColor Gray
Write-Host "  3. Terminal 2: cd web     && npm run dev" -ForegroundColor Gray
Write-Host "  4. Terminal 3: cd desktop && npm run dev  (optional)" -ForegroundColor Gray
Write-Host "  5. Open http://localhost:3000 in your browser" -ForegroundColor Gray
