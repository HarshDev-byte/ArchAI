#!/usr/bin/env python3
"""
Startup script for ArchAI FastAPI backend
Handles database initialization and starts the server
"""

import asyncio
import uvicorn
from database import init_db
from config import settings


async def startup_checks():
    """Perform startup checks and initialization"""
    print("🚀 Starting ArchAI FastAPI Backend...")
    print("=" * 50)
    
    # Check database connection
    try:
        await init_db()
        print("✅ Database connection successful")
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        print("💡 Make sure PostgreSQL is running and configured correctly")
        return False
    
    # Check agent imports
    try:
        from agents.orchestrator import ArchitecturalOrchestrator
        orchestrator = ArchitecturalOrchestrator()
        print("✅ AI agents loaded successfully")
    except Exception as e:
        print(f"⚠️  Agent loading warning: {e}")
        print("💡 Some AI features may not work properly")
    
    print("=" * 50)
    print(f"🌐 API will be available at: http://localhost:8000")
    print(f"📚 API Documentation: http://localhost:8000/docs")
    print(f"🔧 Environment: {settings.ENVIRONMENT}")
    print("=" * 50)
    
    return True


def main():
    """Main startup function"""
    # Run startup checks
    startup_success = asyncio.run(startup_checks())
    
    if not startup_success:
        print("❌ Startup checks failed. Please fix the issues and try again.")
        exit(1)
    
    # Start the server
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True if settings.ENVIRONMENT == "development" else False,
        log_level="info",
        access_log=True
    )


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n⚠️  Server stopped by user")
    except Exception as e:
        print(f"\n❌ Server startup failed: {e}")
        exit(1)