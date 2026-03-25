@echo off
echo 🐳 Starting PostgreSQL for ArchAI...

REM Check if Docker is available
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker not found. Please install Docker Desktop.
    pause
    exit /b 1
)

REM Check if container exists
docker ps -a --format "table {{.Names}}" | findstr "archai-postgres" >nul 2>&1
if %errorlevel% equ 0 (
    echo 📦 Container 'archai-postgres' already exists
    
    REM Check if it's running
    docker ps --format "table {{.Names}}" | findstr "archai-postgres" >nul 2>&1
    if %errorlevel% equ 0 (
        echo ✅ PostgreSQL is already running
    ) else (
        echo 🔄 Starting existing container...
        docker start archai-postgres
    )
) else (
    echo 🚀 Creating new PostgreSQL container...
    docker run --name archai-postgres -e POSTGRES_PASSWORD=archai_pass -e POSTGRES_USER=archai_user -e POSTGRES_DB=archai -p 5432:5432 -d postgres:15
)

echo ⏳ Waiting for PostgreSQL to be ready...
timeout /t 8 /nobreak >nul

echo ✅ PostgreSQL should be ready!
echo 📍 Connection: postgresql://archai_user:archai_pass@localhost:5432/archai