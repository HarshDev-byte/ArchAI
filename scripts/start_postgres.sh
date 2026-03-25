#!/bin/bash

echo "🐳 Starting PostgreSQL for ArchAI..."

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker or use a local PostgreSQL installation."
    exit 1
fi

# Check if container already exists
if docker ps -a --format 'table {{.Names}}' | grep -q "archai-postgres"; then
    echo "📦 Container 'archai-postgres' already exists"
    
    # Check if it's running
    if docker ps --format 'table {{.Names}}' | grep -q "archai-postgres"; then
        echo "✅ PostgreSQL is already running"
    else
        echo "🔄 Starting existing container..."
        docker start archai-postgres
    fi
else
    echo "🚀 Creating new PostgreSQL container..."
    docker run --name archai-postgres \
        -e POSTGRES_PASSWORD=archai_pass \
        -e POSTGRES_USER=archai_user \
        -e POSTGRES_DB=archai \
        -p 5432:5432 \
        -d postgres:15
fi

echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 5

# Test connection
if docker exec archai-postgres pg_isready -U archai_user -d archai > /dev/null 2>&1; then
    echo "✅ PostgreSQL is ready!"
    echo "📍 Connection: postgresql://archai_user:archai_pass@localhost:5432/archai"
else
    echo "⚠️  PostgreSQL might still be starting up. Please wait a moment and try again."
fi