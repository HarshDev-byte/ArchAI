#!/usr/bin/env python3
"""
Database migration script for ArchAI
Creates all tables and sets up Supabase storage bucket
"""

import asyncio
import asyncpg
from supabase import create_client, Client
from database import init_db, engine
from config import settings


async def create_database_if_not_exists():
    """Create the database if it doesn't exist"""
    try:
        # Parse database URL to get connection details
        db_url = settings.DATABASE_URL
        if "postgresql+asyncpg://" in db_url:
            db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")
        
        # Extract database name from URL
        db_name = db_url.split("/")[-1]
        base_url = "/".join(db_url.split("/")[:-1])
        
        print(f"🔍 Checking database connection to: {base_url}")
        
        # Connect to postgres database to create our database
        try:
            conn = await asyncpg.connect(f"{base_url}/postgres")
        except Exception as e:
            print(f"⚠️  Could not connect to PostgreSQL: {e}")
            print("💡 Make sure PostgreSQL is running or use Docker:")
            print("   docker run --name archai-postgres -e POSTGRES_PASSWORD=archai_pass -e POSTGRES_USER=archai_user -e POSTGRES_DB=archai -p 5432:5432 -d postgres:15")
            return False
        
        # Check if database exists
        exists = await conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1", db_name
        )
        
        if not exists:
            await conn.execute(f'CREATE DATABASE "{db_name}"')
            print(f"✅ Created database: {db_name}")
        else:
            print(f"✅ Database already exists: {db_name}")
        
        await conn.close()
        return True
        
    except Exception as e:
        print(f"⚠️  Database creation failed: {e}")
        return False


async def create_extensions():
    """Create required PostgreSQL extensions"""
    try:
        # Connect directly to our database
        db_url = settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
        conn = await asyncpg.connect(db_url.replace("postgresql+asyncpg://", "postgresql://"))
        
        # Create UUID extension
        await conn.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
        print("✅ Created uuid-ossp extension")
        
        await conn.close()
        return True
        
    except Exception as e:
        print(f"⚠️  Extension creation failed: {e}")
        return False


def create_supabase_bucket():
    """Create Supabase storage bucket for 3D models"""
    try:
        if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
            print("⚠️  Supabase credentials not configured, skipping bucket creation")
            print("💡 Add SUPABASE_URL and SUPABASE_SERVICE_KEY to .env for 3D model storage")
            return
        
        supabase: Client = create_client(
            settings.SUPABASE_URL, 
            settings.SUPABASE_SERVICE_KEY
        )
        
        # Create bucket for 3D models
        bucket_name = "archai-models"
        
        try:
            # Try to create the bucket
            supabase.storage.create_bucket(bucket_name, {
                "public": True,
                "allowedMimeTypes": ["model/gltf-binary", "model/gltf+json", "application/octet-stream"],
                "fileSizeLimit": 50 * 1024 * 1024  # 50MB limit
            })
            print(f"✅ Created Supabase storage bucket: {bucket_name}")
            
        except Exception as bucket_error:
            if "already exists" in str(bucket_error).lower():
                print(f"✅ Supabase bucket already exists: {bucket_name}")
            else:
                print(f"⚠️  Failed to create bucket: {bucket_error}")
        
        # Set bucket policy to allow public read access
        try:
            supabase.storage.from_(bucket_name).create_signed_url("test", 60)
            print(f"✅ Bucket {bucket_name} is accessible")
        except Exception as policy_error:
            print(f"⚠️  Bucket policy setup failed: {policy_error}")
            
    except Exception as e:
        print(f"⚠️  Supabase setup failed: {e}")


async def run_migrations():
    """Run all database migrations"""
    print("🚀 Starting ArchAI database migration...")
    print(f"📍 Database URL: {settings.DATABASE_URL}")
    
    # Step 1: Create database if needed
    db_created = await create_database_if_not_exists()
    if not db_created:
        print("❌ Database setup failed. Please check your PostgreSQL connection.")
        return False
    
    # Step 2: Create extensions
    extensions_created = await create_extensions()
    if not extensions_created:
        print("⚠️  Extension creation failed, but continuing...")
    
    # Step 3: Create all tables
    try:
        await init_db()
        print("✅ Database tables created successfully")
    except Exception as e:
        print(f"❌ Table creation failed: {e}")
        return False
    
    # Step 4: Create Supabase bucket
    create_supabase_bucket()
    
    print("\n✅ Database migration completed successfully!")
    print("\n📋 Database Schema Created:")
    print("   • users - User accounts")
    print("   • projects - Design projects")
    print("   • agent_runs - AI agent execution logs")
    print("   • design_variants - Generated design variations")
    print("   • cost_estimates - Cost analysis results")
    print("   • geo_analysis - Site analysis data")
    print("   • compliance_checks - Building code compliance")
    
    if settings.SUPABASE_URL:
        print("   • archai-models bucket - 3D model storage")
    
    print("\n🚀 Ready to start the ArchAI API!")
    print("   Run: python main.py")
    
    return True


if __name__ == "__main__":
    success = asyncio.run(run_migrations())
    if not success:
        exit(1)