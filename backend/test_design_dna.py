#!/usr/bin/env python3
"""
Comprehensive test suite for the Design DNA system
"""

import asyncio
import pytest
import json
from typing import List
import time

from core.design_dna import (
    DesignDNA, generate_seed, express_dna, mutate_dna, crossover_dna,
    score_dna, generate_design_variants, dna_similarity, ensure_uniqueness,
    global_memory_store, DNAMemoryStore
)
from core.dna_analyzer import DNAAnalyzer, DNAComparator
from core.dna_integration import DNAIntegrationService


class TestDesignDNA:
    """Test core Design DNA functionality"""
    
    def test_seed_generation_uniqueness(self):
        """Test that seeds are always unique even with same inputs"""
        
        # Same inputs should produce different seeds due to entropy
        seed1 = generate_seed(12.9716, 77.5946, 500.0, 5000000, ["modern"])
        seed2 = generate_seed(12.9716, 77.5946, 500.0, 5000000, ["modern"])
        
        assert seed1 != seed2, "Seeds should be unique even with identical inputs"
        assert len(seed1) == 64, "Seed should be 64-character SHA256 hash"
        assert len(seed2) == 64, "Seed should be 64-character SHA256 hash"
    
    def test_dna_expression_deterministic(self):
        """Test that same seed produces identical DNA"""
        
        seed = "test_seed_12345"
        geo_data = {
            "optimal_solar_orientation": 180.0,
            "climate_zone": "tropical"
        }
        
        dna1 = express_dna(seed, 500.0, 2, 5000000, ["modern"], geo_data)
        dna2 = express_dna(seed, 500.0, 2, 5000000, ["modern"], geo_data)
        
        # Should be identical except for timestamps and IDs
        assert dna1.primary_style == dna2.primary_style
        assert dna1.secondary_style == dna2.secondary_style
        assert dna1.building_form == dna2.building_form
        assert dna1.roof_form == dna2.roof_form
        assert dna1.facade_pattern == dna2.facade_pattern
        assert dna1.window_wall_ratio == dna2.window_wall_ratio
    
    def test_dna_mutation(self):
        """Test DNA mutation functionality"""
        
        # Create base DNA
        seed = "base_seed_12345"
        geo_data = {"optimal_solar_orientation": 180.0}
        base_dna = express_dna(seed, 500.0, 2, 5000000, ["modern"], geo_data)
        
        # Mutate with high rate
        mutated_dna = mutate_dna(base_dna, mutation_rate=0.8)
        
        # Should have different ID and seed
        assert mutated_dna.dna_id != base_dna.dna_id
        assert mutated_dna.seed != base_dna.seed
        
        # Should have some differences due to high mutation rate
        differences = 0
        if mutated_dna.primary_style != base_dna.primary_style:
            differences += 1
        if mutated_dna.roof_form != base_dna.roof_form:
            differences += 1
        if mutated_dna.building_form != base_dna.building_form:
            differences += 1
        
        assert differences > 0, "High mutation rate should cause some changes"
    
    def test_dna_crossover(self):
        """Test DNA crossover functionality"""
        
        # Create two parent DNAs
        seed1 = "parent1_seed"
        seed2 = "parent2_seed"
        geo_data = {"optimal_solar_orientation": 180.0}
        
        parent1 = express_dna(seed1, 500.0, 2, 5000000, ["modern"], geo_data)
        parent2 = express_dna(seed2, 500.0, 2, 5000000, ["traditional"], geo_data)
        
        # Create offspring
        child = crossover_dna(parent1, parent2)
        
        # Child should have unique identity
        assert child.dna_id != parent1.dna_id
        assert child.dna_id != parent2.dna_id
        assert child.seed != parent1.seed
        assert child.seed != parent2.seed
        
        # Child should have traits from both parents
        # (This is probabilistic, so we just check it's valid)
        assert child.primary_style in [parent1.primary_style, parent2.primary_style]
    
    def test_dna_scoring(self):
        """Test DNA fitness scoring"""
        
        seed = "scoring_test_seed"
        geo_data = {
            "optimal_solar_orientation": 180.0,
            "climate_zone": "tropical"
        }
        
        dna = express_dna(seed, 500.0, 2, 5000000, ["modern"], geo_data)
        score = score_dna(dna, geo_data, 5000000)
        
        assert isinstance(score, float)
        assert 0 <= score <= 100, "Score should be between 0 and 100"
    
    def test_design_variants_generation(self):
        """Test generation of multiple design variants"""
        
        base_seed = "variants_test_seed"
        geo_data = {
            "optimal_solar_orientation": 180.0,
            "climate_zone": "tropical"
        }
        
        variants = generate_design_variants(
            base_seed=base_seed,
            plot_area=500.0,
            floors=2,
            budget=5000000,
            style_prefs=["modern", "minimalist"],
            geo_data=geo_data,
            num_variants=5
        )
        
        assert len(variants) == 5, "Should generate requested number of variants"
        
        # All variants should be unique
        signatures = [variant.get_signature() for variant in variants]
        assert len(set(signatures)) == len(signatures), "All variants should be unique"
        
        # All variants should be valid DNAs
        for variant in variants:
            assert isinstance(variant, DesignDNA)
            assert variant.dna_id is not None
            assert variant.seed is not None
    
    def test_dna_similarity_calculation(self):
        """Test DNA similarity calculation"""
        
        # Create two similar DNAs
        seed = "similarity_test_seed"
        geo_data = {"optimal_solar_orientation": 180.0}
        
        dna1 = express_dna(seed, 500.0, 2, 5000000, ["modern"], geo_data)
        dna2 = express_dna(seed, 500.0, 2, 5000000, ["modern"], geo_data)
        
        # Should be very similar (same seed)
        similarity = dna_similarity(dna1, dna2)
        assert 0.8 <= similarity <= 1.0, "Same seed should produce high similarity"
        
        # Create very different DNA
        different_seed = "very_different_seed"
        dna3 = express_dna(different_seed, 1000.0, 3, 10000000, ["traditional"], geo_data)
        
        similarity_different = dna_similarity(dna1, dna3)
        assert similarity_different < similarity, "Different DNAs should be less similar"
    
    def test_uniqueness_enforcement(self):
        """Test uniqueness enforcement mechanism"""
        
        # Create base DNA
        seed = "uniqueness_test_seed"
        geo_data = {"optimal_solar_orientation": 180.0}
        base_dna = express_dna(seed, 500.0, 2, 5000000, ["modern"], geo_data)
        
        # Create similar DNA
        similar_dna = express_dna(seed, 500.0, 2, 5000000, ["modern"], geo_data)
        
        # Enforce uniqueness
        unique_dna = ensure_uniqueness(similar_dna, [base_dna], similarity_threshold=0.7)
        
        # Should be different from base
        final_similarity = dna_similarity(unique_dna, base_dna)
        assert final_similarity < 0.7, "Uniqueness enforcement should reduce similarity"
    
    def test_memory_store(self):
        """Test DNA memory store functionality"""
        
        memory_store = DNAMemoryStore()
        
        # Create test DNAs
        seed1 = "memory_test_1"
        seed2 = "memory_test_2"
        geo_data = {"optimal_solar_orientation": 180.0}
        
        dna1 = express_dna(seed1, 500.0, 2, 5000000, ["modern"], geo_data)
        dna2 = express_dna(seed2, 500.0, 2, 5000000, ["traditional"], geo_data)
        
        # Add to memory
        memory_store.add_dna(dna1)
        memory_store.add_dna(dna2)
        
        assert len(memory_store.signatures) == 2
        assert len(memory_store.full_dnas) == 2
        
        # Test similarity check
        similar_dna = express_dna(seed1, 500.0, 2, 5000000, ["modern"], geo_data)
        assert memory_store.is_similar(similar_dna, threshold=0.8)
        
        # Test clearing old entries
        memory_store.clear_old(max_age_hours=0)  # Clear all
        assert len(memory_store.signatures) == 0


class TestDNAAnalyzer:
    """Test DNA analysis functionality"""
    
    def test_population_analysis(self):
        """Test analysis of DNA population"""
        
        analyzer = DNAAnalyzer()
        
        # Create test population
        dnas = []
        geo_data = {"optimal_solar_orientation": 180.0}
        
        for i in range(10):
            seed = f"analysis_test_{i}"
            dna = express_dna(seed, 500.0, 2, 5000000, ["modern", "traditional"], geo_data)
            dnas.append(dna)
        
        # Analyze population
        analysis = analyzer.analyze_population(dnas)
        
        assert "population_size" in analysis
        assert analysis["population_size"] == 10
        
        assert "diversity_metrics" in analysis
        assert "style_distribution" in analysis
        assert "form_patterns" in analysis
        assert "material_trends" in analysis
        assert "spatial_characteristics" in analysis
        assert "environmental_adaptation" in analysis
        assert "uniqueness_score" in analysis
        assert "quality_metrics" in analysis
        
        # Check diversity metrics
        diversity = analysis["diversity_metrics"]
        assert "overall_diversity" in diversity
        assert 0 <= diversity["overall_diversity"] <= 10  # Max entropy for 10 items
    
    def test_insights_generation(self):
        """Test generation of human-readable insights"""
        
        analyzer = DNAAnalyzer()
        
        # Create mock analysis
        analysis = {
            "diversity_metrics": {"overall_diversity": 0.9},
            "style_distribution": {"fusion_preference": "high"},
            "spatial_characteristics": {"courtyard_frequency": 0.7, "spatial_openness": "high"},
            "environmental_adaptation": {"climate_responsiveness": "high"},
            "quality_metrics": {"overall_quality": "excellent"},
            "uniqueness_score": 0.85
        }
        
        insights = analyzer.generate_insights(analysis)
        
        assert isinstance(insights, list)
        assert len(insights) > 0
        assert all(isinstance(insight, str) for insight in insights)
    
    def test_visualization_data_preparation(self):
        """Test preparation of data for visualization"""
        
        analyzer = DNAAnalyzer()
        
        # Create test DNAs
        dnas = []
        geo_data = {"optimal_solar_orientation": 180.0}
        
        for i in range(5):
            seed = f"viz_test_{i}"
            dna = express_dna(seed, 500.0, 2, 5000000, ["modern"], geo_data)
            dnas.append(dna)
        
        viz_data = analyzer.create_visualization_data(dnas)
        
        assert "style_distribution" in viz_data
        assert "spatial_metrics" in viz_data
        assert "form_distribution" in viz_data
        assert "environmental_data" in viz_data
        assert "timeline_data" in viz_data
        
        # Check timeline data structure
        timeline = viz_data["timeline_data"]
        assert len(timeline) == 5
        assert all("timestamp" in item for item in timeline)
        assert all("dna_id" in item for item in timeline)


class TestDNAComparator:
    """Test DNA comparison functionality"""
    
    def test_dna_comparison(self):
        """Test detailed DNA comparison"""
        
        comparator = DNAComparator()
        
        # Create two different DNAs
        seed1 = "compare_test_1"
        seed2 = "compare_test_2"
        geo_data = {"optimal_solar_orientation": 180.0}
        
        dna1 = express_dna(seed1, 500.0, 2, 5000000, ["modern"], geo_data)
        dna2 = express_dna(seed2, 500.0, 2, 5000000, ["traditional"], geo_data)
        
        comparison = comparator.compare_dnas(dna1, dna2)
        
        assert "overall_similarity" in comparison
        assert "differences" in comparison
        assert "similarities" in comparison
        assert "style_comparison" in comparison
        assert "spatial_comparison" in comparison
        assert "material_comparison" in comparison
        assert "environmental_comparison" in comparison
        
        # Check differences structure
        differences = comparison["differences"]
        assert isinstance(differences, list)
        if differences:  # May be empty if DNAs are very similar
            assert all("attribute" in diff for diff in differences)
            assert all("dna1_value" in diff for diff in differences)
            assert all("dna2_value" in diff for diff in differences)


class TestDNAIntegration:
    """Test DNA integration with database and agents"""
    
    @pytest.mark.asyncio
    async def test_dna_service_initialization(self):
        """Test DNA integration service initialization"""
        
        service = DNAIntegrationService()
        assert service.analyzer is not None
        assert isinstance(service.generation_cache, dict)
    
    def test_dna_recommendations(self):
        """Test DNA improvement recommendations"""
        
        # This would require database setup, so we'll test the logic
        service = DNAIntegrationService()
        
        # Create test DNA with suboptimal characteristics
        seed = "recommendations_test"
        geo_data = {
            "optimal_solar_orientation": 180.0,
            "climate_zone": "tropical"
        }
        
        dna = express_dna(seed, 500.0, 2, 5000000, ["modern"], geo_data)
        
        # Manually set suboptimal orientation for testing
        dna.solar_orientation = 90.0  # 90 degrees off optimal
        
        # This would normally be async with database
        # recommendations = await service.get_dna_recommendations(dna, geo_data, 5000000, db)
        
        # For now, just test that the method exists and can be called
        assert hasattr(service, 'get_dna_recommendations')


def run_performance_tests():
    """Run performance tests for DNA system"""
    
    print("🚀 Running Design DNA Performance Tests...")
    
    # Test seed generation speed
    start_time = time.time()
    for i in range(1000):
        generate_seed(12.9716, 77.5946, 500.0, 5000000, ["modern"], f"extra_{i}")
    seed_time = time.time() - start_time
    print(f"✅ Generated 1000 seeds in {seed_time:.3f}s ({1000/seed_time:.0f} seeds/sec)")
    
    # Test DNA expression speed
    start_time = time.time()
    geo_data = {"optimal_solar_orientation": 180.0}
    for i in range(100):
        seed = f"perf_test_{i}"
        express_dna(seed, 500.0, 2, 5000000, ["modern"], geo_data)
    dna_time = time.time() - start_time
    print(f"✅ Generated 100 DNAs in {dna_time:.3f}s ({100/dna_time:.0f} DNAs/sec)")
    
    # Test variant generation speed
    start_time = time.time()
    variants = generate_design_variants(
        "perf_base_seed", 500.0, 2, 5000000, ["modern"], geo_data, 10
    )
    variant_time = time.time() - start_time
    print(f"✅ Generated 10 variants in {variant_time:.3f}s")
    
    # Test similarity calculation speed
    start_time = time.time()
    for i in range(len(variants)):
        for j in range(i + 1, len(variants)):
            dna_similarity(variants[i], variants[j])
    similarity_time = time.time() - start_time
    comparisons = len(variants) * (len(variants) - 1) // 2
    print(f"✅ Calculated {comparisons} similarities in {similarity_time:.3f}s")
    
    print("🎉 Performance tests completed!")


def run_uniqueness_stress_test():
    """Stress test the uniqueness guarantee"""
    
    print("🧪 Running Uniqueness Stress Test...")
    
    # Generate many DNAs and check for duplicates
    signatures = set()
    geo_data = {"optimal_solar_orientation": 180.0}
    
    for i in range(1000):
        seed = generate_seed(12.9716, 77.5946, 500.0, 5000000, ["modern"], f"stress_{i}")
        dna = express_dna(seed, 500.0, 2, 5000000, ["modern"], geo_data)
        signature = dna.get_signature()
        
        if signature in signatures:
            print(f"❌ Duplicate signature found at iteration {i}: {signature}")
            return False
        
        signatures.add(signature)
    
    print(f"✅ Generated 1000 unique DNAs with 0 duplicates")
    
    # Test similarity distribution
    dnas = []
    for i in range(100):
        seed = generate_seed(12.9716, 77.5946, 500.0, 5000000, ["modern"], f"sim_test_{i}")
        dna = express_dna(seed, 500.0, 2, 5000000, ["modern"], geo_data)
        dnas.append(dna)
    
    similarities = []
    for i in range(len(dnas)):
        for j in range(i + 1, len(dnas)):
            similarity = dna_similarity(dnas[i], dnas[j])
            similarities.append(similarity)
    
    avg_similarity = sum(similarities) / len(similarities)
    max_similarity = max(similarities)
    
    print(f"✅ Average similarity: {avg_similarity:.3f}")
    print(f"✅ Maximum similarity: {max_similarity:.3f}")
    
    if max_similarity > 0.8:
        print("⚠️ Some DNAs are quite similar - consider adjusting parameters")
    else:
        print("🎉 Excellent uniqueness distribution!")
    
    return True


if __name__ == "__main__":
    print("🧬 Design DNA Test Suite")
    print("=" * 50)
    
    # Run unit tests
    print("Running unit tests...")
    pytest.main([__file__, "-v"])
    
    print("\n" + "=" * 50)
    
    # Run performance tests
    run_performance_tests()
    
    print("\n" + "=" * 50)
    
    # Run uniqueness stress test
    run_uniqueness_stress_test()
    
    print("\n🎉 All Design DNA tests completed!")