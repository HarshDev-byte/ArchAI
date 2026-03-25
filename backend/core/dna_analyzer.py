"""
Design DNA Analyzer
Advanced analysis and visualization of Design DNA characteristics
"""

from typing import Dict, Any, List, Tuple
import math
from dataclasses import asdict

from .design_dna import DesignDNA, ARCHITECTURAL_STYLES, MATERIAL_PALETTES


class DNAAnalyzer:
    """
    Advanced analyzer for Design DNA characteristics and relationships.
    """
    
    @staticmethod
    def analyze_style_compatibility(dna: DesignDNA) -> Dict[str, Any]:
        """
        Analyze the compatibility between primary and secondary styles.
        """
        
        # Style compatibility matrix (simplified)
        compatibility_matrix = {
            "contemporary_minimalist": {
                "japanese_wabi_sabi": 0.9,
                "scandinavian_minimal": 0.95,
                "industrial_loft": 0.7,
                "parametric_geometric": 0.6
            },
            "tropical_modern": {
                "biophilic_organic": 0.9,
                "kerala_modern": 0.85,
                "coastal_vernacular": 0.8,
                "sustainable_green": 0.75
            },
            "indo_contemporary": {
                "rajasthani_fusion": 0.8,
                "kerala_modern": 0.75,
                "tropical_modern": 0.7,
                "neoclassical_modern": 0.6
            }
        }
        
        primary = dna.primary_style
        secondary = dna.secondary_style
        
        # Get compatibility score
        compatibility_score = 0.5  # Default neutral compatibility
        if primary in compatibility_matrix:
            if secondary in compatibility_matrix[primary]:
                compatibility_score = compatibility_matrix[primary][secondary]
        
        # Analyze blend ratio effectiveness
        blend_effectiveness = 1.0 - abs(dna.style_blend_ratio - 0.5) * 2
        
        # Overall style harmony
        style_harmony = (compatibility_score + blend_effectiveness) / 2
        
        return {
            "primary_style": primary.replace("_", " ").title(),
            "secondary_style": secondary.replace("_", " ").title(),
            "compatibility_score": round(compatibility_score, 2),
            "blend_ratio": round(dna.style_blend_ratio, 2),
            "blend_effectiveness": round(blend_effectiveness, 2),
            "style_harmony": round(style_harmony, 2),
            "harmony_level": DNAAnalyzer._get_harmony_level(style_harmony),
            "recommendations": DNAAnalyzer._get_style_recommendations(
                primary, secondary, dna.style_blend_ratio, compatibility_score
            )
        }
    
    @staticmethod
    def analyze_spatial_efficiency(dna: DesignDNA) -> Dict[str, Any]:
        """
        Analyze spatial efficiency and utilization.
        """
        
        # Calculate Floor Space Index (FSI)
        fsi = (dna.built_up_area * dna.floors) / dna.plot_area
        
        # Calculate efficiency metrics
        ground_coverage = dna.built_up_area / dna.plot_area
        vertical_efficiency = dna.floors * dna.floor_height
        
        # Open space ratio
        open_space_ratio = 1.0 - ground_coverage
        
        # Circulation efficiency (estimated)
        circulation_efficiency = 0.85 - (dna.open_plan_ratio * 0.1)  # More open = less circulation
        
        # Volume efficiency
        total_volume = dna.built_up_area * dna.floors * dna.floor_height
        volume_per_sqm_plot = total_volume / dna.plot_area
        
        return {
            "fsi": round(fsi, 2),
            "ground_coverage": round(ground_coverage * 100, 1),
            "open_space_ratio": round(open_space_ratio * 100, 1),
            "vertical_efficiency": round(vertical_efficiency, 1),
            "circulation_efficiency": round(circulation_efficiency * 100, 1),
            "volume_per_sqm_plot": round(volume_per_sqm_plot, 1),
            "efficiency_grade": DNAAnalyzer._get_efficiency_grade(fsi, ground_coverage),
            "spatial_recommendations": DNAAnalyzer._get_spatial_recommendations(dna)
        }
    
    @staticmethod
    def analyze_environmental_performance(dna: DesignDNA, geo_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze environmental performance and sustainability.
        """
        
        # Solar performance
        optimal_orientation = geo_data.get("optimal_solar_orientation", 180.0)
        orientation_deviation = abs(dna.solar_orientation - optimal_orientation)
        if orientation_deviation > 180:
            orientation_deviation = 360 - orientation_deviation
        
        solar_efficiency = max(0, 1 - (orientation_deviation / 90))
        
        # Natural ventilation potential
        ventilation_scores = {
            "cross_ventilation": 0.9,
            "stack_effect": 0.8,
            "courtyard_draft": 0.85,
            "wind_catcher": 0.7
        }
        ventilation_efficiency = ventilation_scores.get(dna.natural_ventilation_strategy, 0.6)
        
        # Daylighting potential
        daylight_factor = dna.window_wall_ratio * (1 - dna.shading_coefficient * 0.5)
        
        # Thermal performance
        thermal_mass_factor = DNAAnalyzer._get_thermal_mass_factor(dna.facade_material_palette)
        thermal_performance = (thermal_mass_factor + dna.shading_coefficient) / 2
        
        # Overall environmental score
        env_score = (solar_efficiency + ventilation_efficiency + daylight_factor + thermal_performance) / 4
        
        return {
            "solar_efficiency": round(solar_efficiency * 100, 1),
            "orientation_deviation": round(orientation_deviation, 1),
            "ventilation_efficiency": round(ventilation_efficiency * 100, 1),
            "daylight_factor": round(daylight_factor * 100, 1),
            "thermal_performance": round(thermal_performance * 100, 1),
            "overall_environmental_score": round(env_score * 100, 1),
            "environmental_grade": DNAAnalyzer._get_environmental_grade(env_score),
            "green_features": DNAAnalyzer._identify_green_features(dna),
            "environmental_recommendations": DNAAnalyzer._get_environmental_recommendations(dna, geo_data)
        }
    
    @staticmethod
    def analyze_aesthetic_coherence(dna: DesignDNA) -> Dict[str, Any]:
        """
        Analyze aesthetic coherence and visual appeal.
        """
        
        # Material coherence
        material_palette = MATERIAL_PALETTES.get(dna.facade_material_palette, [])
        material_coherence = len(set(material_palette)) / 4.0  # Normalized
        
        # Form coherence
        form_complexity = DNAAnalyzer._calculate_form_complexity(dna)
        
        # Color harmony
        color_harmony = DNAAnalyzer._analyze_color_harmony(dna.color_temperature)
        
        # Texture balance
        texture_balance = 1.0 - abs(dna.texture_variety - 0.6)  # Optimal around 0.6
        
        # Proportional harmony
        proportional_harmony = DNAAnalyzer._analyze_proportions(dna)
        
        # Overall aesthetic score
        aesthetic_score = (material_coherence + form_complexity + color_harmony + 
                          texture_balance + proportional_harmony) / 5
        
        return {
            "material_coherence": round(material_coherence * 100, 1),
            "form_complexity": round(form_complexity * 100, 1),
            "color_harmony": round(color_harmony * 100, 1),
            "texture_balance": round(texture_balance * 100, 1),
            "proportional_harmony": round(proportional_harmony * 100, 1),
            "overall_aesthetic_score": round(aesthetic_score * 100, 1),
            "aesthetic_grade": DNAAnalyzer._get_aesthetic_grade(aesthetic_score),
            "visual_character": DNAAnalyzer._determine_visual_character(dna),
            "aesthetic_recommendations": DNAAnalyzer._get_aesthetic_recommendations(dna)
        }
    
    @staticmethod
    def generate_comprehensive_report(dna: DesignDNA, geo_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate a comprehensive analysis report for the DNA.
        """
        
        style_analysis = DNAAnalyzer.analyze_style_compatibility(dna)
        spatial_analysis = DNAAnalyzer.analyze_spatial_efficiency(dna)
        environmental_analysis = DNAAnalyzer.analyze_environmental_performance(dna, geo_data)
        aesthetic_analysis = DNAAnalyzer.analyze_aesthetic_coherence(dna)
        
        # Calculate overall design score
        scores = [
            style_analysis["style_harmony"],
            spatial_analysis["efficiency_grade"]["score"] / 100,
            environmental_analysis["overall_environmental_score"] / 100,
            aesthetic_analysis["overall_aesthetic_score"] / 100
        ]
        overall_score = sum(scores) / len(scores) * 100
        
        # Identify strengths and weaknesses
        strengths = []
        weaknesses = []
        
        if style_analysis["style_harmony"] > 0.7:
            strengths.append("Excellent style fusion")
        elif style_analysis["style_harmony"] < 0.5:
            weaknesses.append("Style compatibility issues")
        
        if environmental_analysis["overall_environmental_score"] > 75:
            strengths.append("Strong environmental performance")
        elif environmental_analysis["overall_environmental_score"] < 60:
            weaknesses.append("Environmental performance needs improvement")
        
        if aesthetic_analysis["overall_aesthetic_score"] > 80:
            strengths.append("High aesthetic appeal")
        elif aesthetic_analysis["overall_aesthetic_score"] < 65:
            weaknesses.append("Aesthetic coherence could be improved")
        
        return {
            "dna_id": dna.dna_id,
            "overall_score": round(overall_score, 1),
            "overall_grade": DNAAnalyzer._get_overall_grade(overall_score),
            "style_analysis": style_analysis,
            "spatial_analysis": spatial_analysis,
            "environmental_analysis": environmental_analysis,
            "aesthetic_analysis": aesthetic_analysis,
            "strengths": strengths,
            "weaknesses": weaknesses,
            "key_characteristics": DNAAnalyzer._extract_key_characteristics(dna),
            "uniqueness_factors": DNAAnalyzer._identify_uniqueness_factors(dna)
        }
    
    # Helper methods
    
    @staticmethod
    def _get_harmony_level(score: float) -> str:
        if score > 0.8:
            return "Excellent"
        elif score > 0.6:
            return "Good"
        elif score > 0.4:
            return "Fair"
        else:
            return "Poor"
    
    @staticmethod
    def _get_style_recommendations(primary: str, secondary: str, blend_ratio: float, compatibility: float) -> List[str]:
        recommendations = []
        
        if compatibility < 0.6:
            recommendations.append("Consider choosing more compatible secondary style")
        
        if blend_ratio < 0.2 or blend_ratio > 0.8:
            recommendations.append("Balance the style blend ratio for better harmony")
        
        if "minimalist" in primary and blend_ratio > 0.6:
            recommendations.append("Minimalist styles work best as dominant themes")
        
        return recommendations
    
    @staticmethod
    def _get_efficiency_grade(fsi: float, ground_coverage: float) -> Dict[str, Any]:
        if fsi > 2.0 and ground_coverage < 0.6:
            return {"grade": "A+", "score": 95, "description": "Excellent space utilization"}
        elif fsi > 1.5 and ground_coverage < 0.7:
            return {"grade": "A", "score": 85, "description": "Very good space utilization"}
        elif fsi > 1.0 and ground_coverage < 0.8:
            return {"grade": "B", "score": 75, "description": "Good space utilization"}
        else:
            return {"grade": "C", "score": 60, "description": "Adequate space utilization"}
    
    @staticmethod
    def _get_spatial_recommendations(dna: DesignDNA) -> List[str]:
        recommendations = []
        
        fsi = (dna.built_up_area * dna.floors) / dna.plot_area
        if fsi < 1.0:
            recommendations.append("Consider increasing built-up area for better land utilization")
        
        if dna.open_plan_ratio < 0.3:
            recommendations.append("More open planning could improve space flexibility")
        
        if not dna.courtyard_presence and dna.plot_area > 1500:
            recommendations.append("A central courtyard could enhance natural lighting and ventilation")
        
        return recommendations
    
    @staticmethod
    def _get_thermal_mass_factor(material_palette: str) -> float:
        thermal_factors = {
            "warm_earthy": 0.8,
            "cool_modern": 0.6,
            "natural_organic": 0.7,
            "luxury_premium": 0.5,
            "sustainable_green": 0.9
        }
        return thermal_factors.get(material_palette, 0.6)
    
    @staticmethod
    def _get_environmental_grade(score: float) -> str:
        if score > 0.85:
            return "A+"
        elif score > 0.75:
            return "A"
        elif score > 0.65:
            return "B"
        elif score > 0.55:
            return "C"
        else:
            return "D"
    
    @staticmethod
    def _identify_green_features(dna: DesignDNA) -> List[str]:
        features = []
        
        if dna.courtyard_presence:
            features.append("Central courtyard for natural cooling")
        
        if dna.rooftop_utility in ["garden", "solar_farm"]:
            features.append(f"Rooftop {dna.rooftop_utility.replace('_', ' ')}")
        
        if "green" in dna.facade_material_palette:
            features.append("Sustainable material palette")
        
        if dna.natural_ventilation_strategy == "cross_ventilation":
            features.append("Cross ventilation for natural cooling")
        
        if dna.shading_coefficient > 0.6:
            features.append("Good solar shading design")
        
        return features
    
    @staticmethod
    def _get_environmental_recommendations(dna: DesignDNA, geo_data: Dict[str, Any]) -> List[str]:
        recommendations = []
        
        if dna.window_wall_ratio > 0.6 and dna.shading_coefficient < 0.5:
            recommendations.append("Increase shading for large window areas")
        
        if not dna.courtyard_presence and dna.plot_area > 2000:
            recommendations.append("Consider adding courtyards for natural cooling")
        
        if dna.rooftop_utility != "solar_farm":
            recommendations.append("Rooftop solar installation could reduce energy costs")
        
        return recommendations
    
    @staticmethod
    def _calculate_form_complexity(dna: DesignDNA) -> float:
        complexity_scores = {
            "rectangular": 0.3,
            "L_shape": 0.6,
            "U_shape": 0.7,
            "courtyard": 0.8,
            "H_shape": 0.9,
            "cluster": 1.0
        }
        return complexity_scores.get(dna.building_form, 0.5)
    
    @staticmethod
    def _analyze_color_harmony(color_temp: str) -> float:
        harmony_scores = {
            "warm": 0.8,
            "cool": 0.7,
            "neutral": 0.9,
            "high_contrast": 0.6
        }
        return harmony_scores.get(color_temp, 0.7)
    
    @staticmethod
    def _analyze_proportions(dna: DesignDNA) -> float:
        # Golden ratio analysis
        aspect_ratio = math.sqrt(dna.built_up_area)
        golden_ratio = 1.618
        
        # Check if proportions are close to golden ratio
        proportion_score = 1.0 - abs(aspect_ratio - golden_ratio) / golden_ratio
        proportion_score = max(0.3, min(1.0, proportion_score))
        
        # Floor height proportion
        height_score = 1.0 - abs(dna.floor_height - 3.2) / 1.8  # Optimal around 3.2m
        height_score = max(0.5, min(1.0, height_score))
        
        return (proportion_score + height_score) / 2
    
    @staticmethod
    def _get_aesthetic_grade(score: float) -> str:
        if score > 0.9:
            return "Exceptional"
        elif score > 0.8:
            return "Excellent"
        elif score > 0.7:
            return "Very Good"
        elif score > 0.6:
            return "Good"
        else:
            return "Fair"
    
    @staticmethod
    def _determine_visual_character(dna: DesignDNA) -> str:
        if dna.texture_variety > 0.8:
            return "Rich and Textured"
        elif dna.texture_variety < 0.3:
            return "Clean and Minimal"
        elif "modern" in dna.primary_style:
            return "Contemporary"
        elif "traditional" in dna.primary_style:
            return "Heritage Inspired"
        else:
            return "Balanced Contemporary"
    
    @staticmethod
    def _get_aesthetic_recommendations(dna: DesignDNA) -> List[str]:
        recommendations = []
        
        if dna.texture_variety > 0.9:
            recommendations.append("Consider reducing texture variety for visual coherence")
        elif dna.texture_variety < 0.2:
            recommendations.append("Add more texture variety for visual interest")
        
        if dna.window_wall_ratio < 0.3:
            recommendations.append("Increase window area for better daylighting")
        
        return recommendations
    
    @staticmethod
    def _get_overall_grade(score: float) -> Dict[str, Any]:
        if score > 90:
            return {"grade": "A+", "description": "Outstanding design"}
        elif score > 80:
            return {"grade": "A", "description": "Excellent design"}
        elif score > 70:
            return {"grade": "B", "description": "Very good design"}
        elif score > 60:
            return {"grade": "C", "description": "Good design"}
        else:
            return {"grade": "D", "description": "Needs improvement"}
    
    @staticmethod
    def _extract_key_characteristics(dna: DesignDNA) -> List[str]:
        characteristics = []
        
        characteristics.append(f"{dna.primary_style.replace('_', ' ').title()} style")
        characteristics.append(f"{dna.building_form.replace('_', ' ').title()} form")
        characteristics.append(f"{dna.floors}-story building")
        
        if dna.courtyard_presence:
            characteristics.append("Central courtyard")
        
        if dna.double_height_presence:
            characteristics.append("Double-height spaces")
        
        characteristics.append(f"{dna.facade_material_palette.replace('_', ' ').title()} materials")
        
        return characteristics
    
    @staticmethod
    def _identify_uniqueness_factors(dna: DesignDNA) -> List[str]:
        factors = []
        
        if dna.mutation_factor > 0.2:
            factors.append("High design mutation factor")
        
        if dna.style_blend_ratio not in [0.0, 1.0]:
            factors.append("Unique style fusion")
        
        if dna.building_form in ["H_shape", "cluster", "pavilion"]:
            factors.append("Distinctive building form")
        
        if dna.texture_variety > 0.8:
            factors.append("Rich material texture")
        
        return factors