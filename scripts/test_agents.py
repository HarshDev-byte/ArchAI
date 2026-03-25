#!/usr/bin/env python3
"""
Test script for Archai AI agents
"""

import asyncio
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from agents.orchestrator import ArchitecturalOrchestrator

async def test_agents():
    """Test the AI agent system"""
    
    print("🤖 Testing Archai AI Agents...")
    
    # Sample design DNA for testing
    test_design_dna = {
        "style_mix": {
            "modern": 0.6,
            "sustainable": 0.3,
            "minimalist": 0.1
        },
        "rooms": [
            {"name": "living", "min_area": 40, "preferred_area": 50},
            {"name": "kitchen", "min_area": 15, "preferred_area": 20},
            {"name": "master_bedroom", "min_area": 20, "preferred_area": 25},
            {"name": "bedroom_2", "min_area": 15, "preferred_area": 18},
            {"name": "bathroom", "min_area": 8, "preferred_area": 12}
        ],
        "location": {
            "type": "Point",
            "coordinates": [144.9631, -37.8136]
        },
        "plot_area": 650.0,
        "budget_range": {"min": 400000, "max": 600000},
        "sustainability_features": ["solar_panels", "rainwater_harvesting"],
        "seed": 12345
    }
    
    try:
        # Initialize orchestrator
        orchestrator = ArchitecturalOrchestrator()
        
        print("🎯 Starting generation pipeline...")
        
        # Run generation
        result = await orchestrator.generate_design(
            project_id="test_001",
            design_dna=test_design_dna,
            generation_type="full",
            iterations=1
        )
        
        print("✅ Generation completed successfully!")
        print(f"   Generation ID: {result['generation_id']}")
        print(f"   Generation time: {result['generation_time']:.2f}s")
        print(f"   Floor plans: {len(result['layout_plan']['floor_plans'])}")
        print(f"   Design variations: {len(result['design_result']['variations'])}")
        print(f"   Cost estimate: ${result['cost_estimate']['totals']['total_project_cost']:,.0f}")
        print(f"   Compliance score: {result['compliance_report']['overall_compliance']['score']:.2f}")
        
        # Test individual agents
        print("\n🔍 Testing individual agents...")
        
        # Test geo agent
        geo_result = await orchestrator.geo_agent.analyze_site(
            location=test_design_dna["location"],
            plot_area=test_design_dna["plot_area"]
        )
        print(f"   🌍 Geo Agent: {geo_result['site_analysis']['topography']}")
        
        # Test layout agent  
        layout_result = await orchestrator.layout_agent.generate_layout(
            design_dna=test_design_dna,
            geo_context=geo_result
        )
        print(f"   📐 Layout Agent: {layout_result['optimization_metrics']['space_efficiency']:.2f} efficiency")
        
        print("\n🎉 All agent tests passed!")
        
    except Exception as e:
        print(f"❌ Agent test failed: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_agents())