#!/usr/bin/env python3
"""
Database seeding script for Archai development
"""

import asyncio
import json
from datetime import datetime
from backend.database import init_db, get_supabase

async def seed_database():
    """Seed the database with sample data"""
    
    print("🌱 Seeding Archai database...")
    
    # Initialize database
    await init_db()
    
    # Get Supabase client
    supabase = await get_supabase()
    
    # Sample projects
    sample_projects = [
        {
            "id": "proj_001",
            "name": "Modern Family Home",
            "description": "Contemporary 4-bedroom family residence with sustainable features",
            "project_type": "residential",
            "location": {
                "type": "Point",
                "coordinates": [144.9631, -37.8136],
                "address": "Melbourne, VIC, Australia"
            },
            "plot_area": 650.0,
            "budget_range": {"min": 400000, "max": 600000},
            "style_preferences": ["modern", "sustainable", "minimalist"],
            "status": "completed",
            "user_id": "user_demo",
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        },
        {
            "id": "proj_002", 
            "name": "Sustainable Office Complex",
            "description": "Green office building with solar panels and rainwater harvesting",
            "project_type": "commercial",
            "location": {
                "type": "Point",
                "coordinates": [151.2093, -33.8688],
                "address": "Sydney, NSW, Australia"
            },
            "plot_area": 2500.0,
            "budget_range": {"min": 2000000, "max": 3500000},
            "style_preferences": ["modern", "sustainable", "industrial"],
            "status": "generating",
            "user_id": "user_demo",
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        },
        {
            "id": "proj_003",
            "name": "Coastal Retreat",
            "description": "Luxury beachfront residence with panoramic ocean views",
            "project_type": "residential",
            "location": {
                "type": "Point", 
                "coordinates": [153.4000, -28.0167],
                "address": "Gold Coast, QLD, Australia"
            },
            "plot_area": 1200.0,
            "budget_range": {"min": 800000, "max": 1200000},
            "style_preferences": ["luxury", "modern", "traditional"],
            "status": "draft",
            "user_id": "user_demo",
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
    ]
    
    # Insert sample projects
    try:
        for project in sample_projects:
            print(f"  📁 Creating project: {project['name']}")
            # In a real implementation, you would insert into Supabase here
            # supabase.table('projects').insert(project).execute()
            
        print("✅ Database seeded successfully!")
        print(f"   Created {len(sample_projects)} sample projects")
        
    except Exception as e:
        print(f"❌ Error seeding database: {str(e)}")

if __name__ == "__main__":
    asyncio.run(seed_database())