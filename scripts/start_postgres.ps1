# PowerShell script to start PostgreSQL for ArchAI

Write-Host "🐳 Starting PostgreSQL for ArchAI..." -ForegroundColor Green

# Check if Docker is available
$dockerCheck = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerCheck) {
    Write-Host "❌ Docker not found. Please install Docker Desktop." -ForegroundColor Red
    exit 1
}

# Check if container already exists
$containerExists = docker ps -a --format "table {{.Names}}" | Select-String "archai-postgres"

if ($containerExists) {
    Write-Host "📦 Container 'archai-postgres' already exists" -ForegroundColor Yellow
    
    # Check if it's running
    $containerRunning = docker ps --format "table {{.Names}}" | Select-String "archai-postgres"
    
    if ($containerRunning) {
        Write-Host "✅ PostgreSQL is already running" -ForegroundColor Green
    } else {
        Write-Host "🔄 Starting existing container..." -ForegroundColor Yellow
        docker start archai-postgres
    }
} else {
    Write-Host "🚀 Creating new PostgreSQL container..." -ForegroundColor Green
    docker run --name archai-postgres -e POSTGRES_PASSWORD=archai_pass -e POSTGRES_USER=archai_user -e POSTGRES_DB=archai -p 5432:5432 -d postgres:15
}

Write-Host "⏳ Waiting for PostgreSQL to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

Write-Host "✅ PostgreSQL should be ready!" -ForegroundColor Green
Write-Host "📍 Connection: postgresql://archai_user:archai_pass@localhost:5432/archai" -ForegroundColor Cyan