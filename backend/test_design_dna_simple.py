#!/usr/bin/env python3
"""
Simple test suite for the Design DNA system
"""

import time
from core.design_dna import (
    DesignDNA, generate_seed, express_dna, mutate_dna, crossover_dna,
    score_dna, generate_design_variants, dna_similarity, ensure_uniqueness,
    global_memory_store, DNAMemoryStore
)
from core.dna_analyzer import DNAAnalyzer


def test_seed_generation():
    """Test seed generation uniqueness"""
    print("🧪 Testing seed generation...")
    
    # Same inputs should produce different seeds due to entropy
    seed1 = generate_seed(12.9716, 77.5946, 500.0, 5000000, ["modern"])
    seed2 = generate_seed(12.9716, 77.5946, 500.0, 5000000, ["modern"])
    
    assert seed1 != seed2, "Seeds should be unique even with identical inputs"
    assert len(seed1) == 64, "Seed should be 64-character SHA256 hash"
    assert len(seed2) == 64, "Seed should be 64-character SHA256 hash"
    print("✅ Seed generation test passed")


def test_dna_expression():
    """Test DNA expression from seed"""
    print("🧪 Testing DNA expression...")
    
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
    print("✅ DNA expression test passed")


def test_dna_mutation():
    """Test DNA mutation"""
    print("🧪 Testing DNA mutation...")
    
    # Create base DNA
    seed = "base_seed_12345"
    geo_data = {"optimal_solar_orientation": 180.0}
    base_dna = express_dna(seed, 500.0, 2, 5000000, ["modern"], geo_data)
    
    # Mutate with high rate
    mutated_dna = mutate_dna(base_dna, mutation_rate=0.8)
    
    # Should have different ID and seed
    assert mutated_dna.dna_id != base_dna.dna_id
    assert mutated_dna.seed != base_dna.seed
    print("✅ DNA mutation test passed")


def test_dna_scoring():
    """Test DNA fitness scoring"""
    print("🧪 Testing DNA scoring...")
    
    seed = "scoring_test_seed"
    geo_data = {
        "optimal_solar_orientation": 180.0,
        "climate_zone": "tropical"
    }
    
    dna = express_dna(seed, 500.0, 2, 5000000, ["modern"], geo_data)
    score = score_dna(dna, geo_data, 5000000)
    
    assert isinstance(score, float)
    assert 0 <= score <= 100, "Score should be between 0 and 100"
    print("✅ DNA scoring test passed")


def test_design_variants():
    """Test generation of multiple design variants"""
    print("🧪 Testing design variants generation...")
    
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
    
    print("✅ Design variants test passed")


def test_dna_similarity():
    """Test DNA similarity calculation"""
    print("🧪 Testing DNA similarity...")
    
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
    print("✅ DNA similarity test passed")


def test_dna_analyzer():
    """Test DNA analyzer functionality"""
    print("🧪 Testing DNA analyzer...")
    
    analyzer = DNAAnalyzer()
    
    # Create test DNA
    seed = "analyzer_test_seed"
    geo_data = {"optimal_solar_orientation": 180.0, "climate_zone": "tropical"}
    dna = express_dna(seed, 500.0, 2, 5000000, ["contemporary_minimalist"], geo_data)
    
    # Test style compatibility analysis
    style_analysis = analyzer.analyze_style_compatibility(dna)
    assert "primary_style" in style_analysis
    assert "style_harmony" in style_analysis
    
    # Test spatial efficiency analysis
    spatial_analysis = analyzer.analyze_spatial_efficiency(dna)
    assert "fsi" in spatial_analysis
    assert "efficiency_grade" in spatial_analysis
    
    # Test environmental performance analysis
    env_analysis = analyzer.analyze_environmental_performance(dna, geo_data)
    assert "solar_efficiency" in env_analysis
    assert "overall_environmental_score" in env_analysis
    
    # Test comprehensive report
    report = analyzer.generate_comprehensive_report(dna, geo_data)
    assert "overall_score" in report
    assert "strengths" in report
    assert "weaknesses" in report
    
    print("✅ DNA analyzer test passed")


def run_performance_tests():
    """Run performance tests for DNA system"""
    print("🚀 Running Design DNA Performance Tests...")
    
    # Test seed generation speed
    start_time = time.time()
    for i in range(100):
        generate_seed(12.9716, 77.5946, 500.0, 5000000, ["modern"], f"extra_{i}")
    seed_time = time.time() - start_time
    print(f"✅ Generated 100 seeds in {seed_time:.3f}s ({100/seed_time:.0f} seeds/sec)")
    
    # Test DNA expression speed
    start_time = time.time()
    geo_data = {"optimal_solar_orientation": 180.0}
    for i in range(50):
        seed = f"perf_test_{i}"
        express_dna(seed, 500.0, 2, 5000000, ["modern"], geo_data)
    dna_time = time.time() - start_time
    print(f"✅ Generated 50 DNAs in {dna_time:.3f}s ({50/dna_time:.0f} DNAs/sec)")
    
    # Test variant generation speed
    start_time = time.time()
    variants = generate_design_variants(
        "perf_base_seed", 500.0, 2, 5000000, ["modern"], geo_data, 5
    )
    variant_time = time.time() - start_time
    print(f"✅ Generated 5 variants in {variant_time:.3f}s")
    
    print("🎉 Performance tests completed!")


def main():
    """Run all tests"""
    print("🧬 Design DNA Test Suite")
    print("=" * 50)
    
    try:
        # Run core functionality tests
        test_seed_generation()
        test_dna_expression()
        test_dna_mutation()
        test_dna_scoring()
        test_design_variants()
        test_dna_similarity()
        test_dna_analyzer()
        
        print("\n" + "=" * 50)
        
        # Run performance tests
        run_performance_tests()
        
        print("\n🎉 All Design DNA tests passed!")
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        raise e


if __name__ == "__main__":
    main()