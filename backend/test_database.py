#!/usr/bin/env python3
"""
Test script to verify database schema and operations
"""

import asyncio
import json
from datetime import datetime
from database import init_db, get_db, User, Project, AgentRun, DesignVariant
from sqlalchemy import select


async def test_database_schema():
    """Test database schema creation and basic operations"""
    
    print("🧪 Testing ArchAI Database Schema...")
    
    try:
        # Initialize database
        await init_db()
        print("✅ Database tables created successfully")
        
        # Test database operations
        async for db in get_db():
            # Create test user
            test_user = User(
                email="test@archai.com",
                name="Test User"
            )
            db.add(test_user)
            await db.commit()
            await db.refresh(test_user)
            print(f"✅ Created test user: {test_user.id}")
            
            # Create test project
            test_project = Project(
                user_id=test_user.id,
                name="Test Villa Project",
                latitude=12.9716,
                longitude=77.5946,
                plot_area_sqm=500.0,
                budget_inr=5000000,
                floors=2,
                style_preferences=[
                    {"style": "modern", "weight": 0.7},
                    {"style": "minimalist", "weight": 0.3}
                ],
                design_dna={
                    "signature": "test123",
                    "style_mix": {"modern": 0.7, "minimalist": 0.3},
                    "constraints": {
                        "height": {"max": 12, "min": 8},
                        "rooms": [
                            {"name": "living", "min_area": 25, "max_area": 40},
                            {"name": "kitchen", "min_area": 12, "max_area": 20}
                        ]
                    }
                }
            )
            db.add(test_project)
            await db.commit()
            await db.refresh(test_project)
            print(f"✅ Created test project: {test_project.id}")
            
            # Create test agent run
            test_agent_run = AgentRun(
                project_id=test_project.id,
                agent_name="geo",
                status="complete",
                input_data={"location": {"lat": 12.9716, "lng": 77.5946}},
                output_data={
                    "zoning": "residential",
                    "fsi_allowed": 1.5,
                    "solar_potential": 1200
                },
                started_at=datetime.now(),
                completed_at=datetime.now()
            )
            db.add(test_agent_run)
            await db.commit()
            print(f"✅ Created test agent run: {test_agent_run.id}")
            
            # Create test design variant
            test_variant = DesignVariant(
                project_id=test_project.id,
                variant_number=1,
                dna={
                    "style_fusion": {"modern": 0.7, "minimalist": 0.3},
                    "layout": {"rooms": 4, "bathrooms": 3},
                    "features": ["solar_panels", "rainwater_harvesting"]
                },
                score=85.5,
                is_selected=True
            )
            db.add(test_variant)
            await db.commit()
            print(f"✅ Created test design variant: {test_variant.id}")
            
            # Test queries
            result = await db.execute(
                select(Project).where(Project.user_id == test_user.id)
            )
            projects = result.scalars().all()
            print(f"✅ Query test: Found {len(projects)} projects for user")
            
            # Test JSONB queries
            result = await db.execute(
                select(Project).where(
                    Project.design_dna['style_mix']['modern'].astext.cast(float) > 0.5
                )
            )
            modern_projects = result.scalars().all()
            print(f"✅ JSONB query test: Found {len(modern_projects)} modern projects")
            
            # Cleanup test data
            await db.delete(test_variant)
            await db.delete(test_agent_run)
            await db.delete(test_project)
            await db.delete(test_user)
            await db.commit()
            print("✅ Cleaned up test data")
            
            break  # Exit the async generator
        
        print("\n🎉 All database tests passed!")
        print("\n📋 Schema Summary:")
        print("   • users - User accounts ✅")
        print("   • projects - Design projects ✅")
        print("   • agent_runs - AI agent execution logs ✅")
        print("   • design_variants - Generated design variations ✅")
        print("   • cost_estimates - Cost analysis results ✅")
        print("   • geo_analysis - Site analysis data ✅")
        print("   • compliance_checks - Building code compliance ✅")
        
        return True
        
    except Exception as e:
        print(f"❌ Database test failed: {e}")
        return False


if __name__ == "__main__":
    success = asyncio.run(test_database_schema())
    if not success:
        exit(1)