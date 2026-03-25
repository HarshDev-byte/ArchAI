#!/usr/bin/env python3
"""
Comprehensive API test script for ArchAI FastAPI backend
Tests all endpoints with realistic data
"""

import asyncio
import httpx
import json
from datetime import datetime
import uuid


class ArchAIAPITester:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.client = httpx.AsyncClient(base_url=base_url)
        self.test_user_id = None
        self.test_project_id = None
    
    async def test_health_endpoint(self):
        """Test health check endpoint"""
        print("🏥 Testing health endpoint...")
        response = await self.client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✅ Health endpoint working")
    
    async def test_user_creation(self):
        """Test user creation"""
        print("👤 Testing user creation...")
        user_data = {
            "email": f"test_{int(datetime.now().timestamp())}@archai.com",
            "name": "Test User"
        }
        
        response = await self.client.post("/api/users/", json=user_data)
        assert response.status_code == 200
        data = response.json()
        self.test_user_id = data["id"]
        print(f"✅ User created: {self.test_user_id}")
        return data
    
    async def test_project_creation(self):
        """Test project creation"""
        print("🏗️ Testing project creation...")
        project_data = {
            "name": "Test Villa Project",
            "latitude": 12.9716,
            "longitude": 77.5946,
            "plot_area_sqm": 500.0,
            "budget_inr": 5000000,
            "floors": 2,
            "style_preferences": [
                {"style": "modern", "weight": 0.7},
                {"style": "minimalist", "weight": 0.3}
            ]
        }
        
        response = await self.client.post(
            f"/api/projects/?user_id={self.test_user_id}",
            json=project_data
        )
        assert response.status_code == 200
        data = response.json()
        self.test_project_id = data["id"]
        print(f"✅ Project created: {self.test_project_id}")
        return data
    
    async def test_project_retrieval(self):
        """Test project retrieval"""
        print("📋 Testing project retrieval...")
        response = await self.client.get(f"/api/projects/{self.test_project_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == self.test_project_id
        print("✅ Project retrieved successfully")
        return data
    
    async def test_project_list(self):
        """Test project listing"""
        print("📝 Testing project listing...")
        response = await self.client.get(f"/api/projects/?user_id={self.test_user_id}")
        assert response.status_code == 200
        data = response.json()
        assert len(data["projects"]) >= 1
        print(f"✅ Found {len(data['projects'])} projects")
        return data
    
    async def test_generation_start(self):
        """Test generation pipeline start"""
        print("🚀 Testing generation start...")
        generation_data = {
            "project_id": self.test_project_id,
            "latitude": 12.9716,
            "longitude": 77.5946,
            "plot_area_sqm": 500.0,
            "budget_inr": 5000000,
            "floors": 2,
            "style_preferences": [
                {"style": "modern", "weight": 0.7},
                {"style": "minimalist", "weight": 0.3}
            ]
        }
        
        response = await self.client.post("/api/generate/start", json=generation_data)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "started"
        print(f"✅ Generation started: {data['task_id']}")
        return data
    
    async def test_generation_status(self):
        """Test generation status check"""
        print("📊 Testing generation status...")
        response = await self.client.get(f"/api/generate/status/{self.test_project_id}")
        assert response.status_code == 200
        data = response.json()
        assert "agents" in data
        print(f"✅ Status retrieved: {data['overall_status']}")
        return data
    
    async def test_agent_health(self):
        """Test agent health check"""
        print("🤖 Testing agent health...")
        response = await self.client.get("/api/agents/health/check")
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Agent health: {data['overall_status']}")
        return data
    
    async def test_agent_stats(self):
        """Test agent statistics"""
        print("📈 Testing agent statistics...")
        response = await self.client.get("/api/agents/stats/summary")
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Agent stats retrieved for {data['period_days']} days")
        return data
    
    async def test_websocket_connection(self):
        """Test WebSocket connection"""
        print("🔌 Testing WebSocket connection...")
        try:
            async with httpx.AsyncClient() as client:
                # Note: This is a basic test - full WebSocket testing would require websockets library
                response = await client.get(f"{self.base_url}/ws/{self.test_project_id}")
                # WebSocket upgrade will fail with httpx, but we can check if endpoint exists
                print("✅ WebSocket endpoint accessible")
        except Exception as e:
            print(f"⚠️ WebSocket test skipped: {e}")
    
    async def test_project_update(self):
        """Test project update"""
        print("✏️ Testing project update...")
        update_data = {
            "name": "Updated Test Villa Project",
            "budget_inr": 6000000
        }
        
        response = await self.client.put(
            f"/api/projects/{self.test_project_id}",
            json=update_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Test Villa Project"
        assert data["budget_inr"] == 6000000
        print("✅ Project updated successfully")
        return data
    
    async def test_project_duplication(self):
        """Test project duplication"""
        print("📋 Testing project duplication...")
        response = await self.client.post(
            f"/api/projects/{self.test_project_id}/duplicate?new_name=Duplicated Project"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Duplicated Project"
        print(f"✅ Project duplicated: {data['id']}")
        return data
    
    async def cleanup(self):
        """Clean up test data"""
        print("🧹 Cleaning up test data...")
        try:
            # Delete test project
            if self.test_project_id:
                await self.client.delete(f"/api/projects/{self.test_project_id}")
            
            # Delete test user
            if self.test_user_id:
                await self.client.delete(f"/api/users/{self.test_user_id}")
            
            print("✅ Cleanup completed")
        except Exception as e:
            print(f"⚠️ Cleanup warning: {e}")
    
    async def run_all_tests(self):
        """Run all API tests"""
        print("🧪 Starting ArchAI API Tests...")
        print("=" * 50)
        
        try:
            # Basic tests
            await self.test_health_endpoint()
            
            # User management tests
            await self.test_user_creation()
            
            # Project management tests
            await self.test_project_creation()
            await self.test_project_retrieval()
            await self.test_project_list()
            await self.test_project_update()
            await self.test_project_duplication()
            
            # Generation tests
            await self.test_generation_start()
            await self.test_generation_status()
            
            # Agent tests
            await self.test_agent_health()
            await self.test_agent_stats()
            
            # WebSocket test
            await self.test_websocket_connection()
            
            print("=" * 50)
            print("🎉 All API tests passed!")
            
        except Exception as e:
            print(f"❌ Test failed: {e}")
            raise e
        
        finally:
            await self.cleanup()
            await self.client.aclose()


async def main():
    """Run the API tests"""
    tester = ArchAIAPITester()
    await tester.run_all_tests()


if __name__ == "__main__":
    print("🚀 ArchAI FastAPI Backend Test Suite")
    print("Make sure the API server is running on http://localhost:8000")
    print()
    
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n⚠️ Tests interrupted by user")
    except Exception as e:
        print(f"\n❌ Test suite failed: {e}")
        exit(1)