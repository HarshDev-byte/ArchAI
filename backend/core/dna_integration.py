"""
Design DNA Integration with FastAPI Backend
Provides high-level functions for DNA generation and management
"""

from typing import List, Dict, Any, Optional
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from .design_dna import (
    DesignDNA, generate_seed, express_dna, generate_design_variants,
    score_dna, ensure_uniqueness, global_memory_store
)
from database import Project, DesignVariant


async def create_project_dna(
    project_id: str,
    latitude: float,
    longitude: float,
    plot_area: float,
    budget: int,
    floors: int,
    style_preferences: List[str],
    geo_data: Dict[str, Any],
    db: AsyncSession,
    num_variants: int = 5
) -> Dict[str, Any]:
    """
    Create Design DNA and variants for a new project.
    Integrates with database to store results.
    """
    
    # Generate base seed with guaranteed uniqueness
    base_seed = generate_seed(
        latitude=latitude,
        longitude=longitude,
        plot_area=plot_area,
        budget=budget,
        style_prefs=style_preferences,
        extra_entropy=project_id
    )
    
    # Get memory store signatures to avoid repetition
    memory_signatures = global_memory_store.get_signatures()
    
    # Generate design variants
    variants = generate_design_variants(
        base_seed=base_seed,
        plot_area=plot_area,
        floors=floors,
        budget=budget,
        style_prefs=style_preferences,
        geo_data=geo_data,
        num_variants=num_variants,
        memory_store=memory_signatures
    )
    
    # Ensure uniqueness against existing designs
    unique_variants = []
    for variant in variants:
        unique_variant = ensure_uniqueness(
            variant, 
            global_memory_store.full_dnas,
            similarity_threshold=0.7
        )
        unique_variants.append(unique_variant)
        global_memory_store.add_dna(unique_variant)
    
    # Score variants
    scored_variants = []
    for i, dna in enumerate(unique_variants):
        score = score_dna(dna, geo_data, budget)
        scored_variants.append({
            "variant_number": i + 1,
            "dna": dna,
            "score": score,
            "is_selected": i == 0  # Select highest scoring by default
        })
    
    # Sort by score
    scored_variants.sort(key=lambda x: x["score"], reverse=True)
    
    # Store variants in database
    db_variants = []
    for variant_data in scored_variants:
        dna = variant_data["dna"]
        
        db_variant = DesignVariant(
            project_id=project_id,
            variant_number=variant_data["variant_number"],
            dna=dna.to_dict(),
            score=variant_data["score"],
            is_selected=variant_data["is_selected"]
        )
        
        db.add(db_variant)
        db_variants.append(db_variant)
    
    await db.commit()
    
    # Update project with primary DNA
    primary_dna = scored_variants[0]["dna"]
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one()
    project.design_dna = primary_dna.to_dict()
    project.design_seed = primary_dna.seed
    
    await db.commit()
    
    return {
        "base_seed": base_seed,
        "primary_dna": primary_dna.to_dict(),
        "variants": [
            {
                "id": str(var.id),
                "variant_number": var.variant_number,
                "dna": var.dna,
                "score": var.score,
                "is_selected": var.is_selected
            }
            for var in db_variants
        ],
        "generation_stats": {
            "total_variants": len(scored_variants),
            "avg_score": sum(v["score"] for v in scored_variants) / len(scored_variants),
            "score_range": {
                "min": min(v["score"] for v in scored_variants),
                "max": max(v["score"] for v in scored_variants)
            }
        }
    }


async def regenerate_variants(
    project_id: str,
    changed_inputs: Dict[str, Any],
    db: AsyncSession,
    num_new_variants: int = 3
) -> Dict[str, Any]:
    """
    Regenerate design variants when user changes inputs.
    """
    
    # Get existing project
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise ValueError(f"Project {project_id} not found")
    
    # Extract current parameters
    current_params = {
        "latitude": project.latitude,
        "longitude": project.longitude,
        "plot_area": project.plot_area_sqm,
        "budget": project.budget_inr,
        "floors": project.floors,
        "style_preferences": [pref.get("style", "") for pref in project.style_preferences]
    }
    
    # Apply changes
    current_params.update(changed_inputs)
    
    # Generate new seed with changes
    new_seed = generate_seed(
        latitude=current_params["latitude"],
        longitude=current_params["longitude"],
        plot_area=current_params["plot_area"],
        budget=current_params["budget"],
        style_prefs=current_params["style_preferences"],
        extra_entropy=f"{project_id}_regenerated_{len(changed_inputs)}"
    )
    
    # Get geo data (simplified for now)
    geo_data = {
        "optimal_solar_orientation": 180.0,
        "climate_zone": "tropical"
    }
    
    # Generate new variants
    new_variants = generate_design_variants(
        base_seed=new_seed,
        plot_area=current_params["plot_area"],
        floors=current_params["floors"],
        budget=current_params["budget"],
        style_prefs=current_params["style_preferences"],
        geo_data=geo_data,
        num_variants=num_new_variants,
        memory_store=global_memory_store.get_signatures()
    )
    
    # Store new variants
    db_variants = []
    for i, dna in enumerate(new_variants):
        score = score_dna(dna, geo_data, current_params["budget"])
        
        db_variant = DesignVariant(
            project_id=project_id,
            variant_number=i + 100,  # Offset to distinguish from original variants
            dna=dna.to_dict(),
            score=score,
            is_selected=False
        )
        
        db.add(db_variant)
        db_variants.append(db_variant)
        global_memory_store.add_dna(dna)
    
    await db.commit()
    
    return {
        "new_variants": [
            {
                "id": str(var.id),
                "variant_number": var.variant_number,
                "dna": var.dna,
                "score": var.score,
                "is_selected": var.is_selected
            }
            for var in db_variants
        ],
        "changed_inputs": changed_inputs,
        "regeneration_seed": new_seed
    }


def analyze_dna_characteristics(dna_dict: Dict[str, Any]) -> Dict[str, Any]:
    """
    Analyze DNA characteristics for frontend display.
    """
    
    # Style analysis
    style_analysis = {
        "primary_style": dna_dict.get("primary_style", "").replace("_", " ").title(),
        "secondary_style": dna_dict.get("secondary_style", "").replace("_", " ").title(),
        "style_blend": f"{int((1 - dna_dict.get('style_blend_ratio', 0.5)) * 100)}% / {int(dna_dict.get('style_blend_ratio', 0.5) * 100)}%",
        "fusion_type": "Balanced Fusion" if 0.3 <= dna_dict.get('style_blend_ratio', 0.5) <= 0.7 else "Dominant Style"
    }
    
    # Spatial analysis
    spatial_analysis = {
        "building_form": dna_dict.get("building_form", "").replace("_", " ").title(),
        "floor_height": f"{dna_dict.get('floor_height', 3.0):.1f}m",
        "built_up_area": f"{dna_dict.get('built_up_area', 0):.0f} sqm",
        "open_plan_ratio": f"{dna_dict.get('open_plan_ratio', 0.5) * 100:.0f}%",
        "courtyard": "Yes" if dna_dict.get("courtyard_presence", False) else "No",
        "double_height": "Yes" if dna_dict.get("double_height_presence", False) else "No"
    }
    
    # Material analysis
    material_analysis = {
        "facade_palette": dna_dict.get("facade_material_palette", "").replace("_", " ").title(),
        "interior_material": dna_dict.get("interior_material", "").replace("_", " ").title(),
        "roof_material": dna_dict.get("roof_material", "").replace("_", " ").title(),
        "facade_pattern": dna_dict.get("facade_pattern", "").replace("_", " ").title()
    }
    
    # Environmental analysis
    environmental_analysis = {
        "solar_orientation": f"{dna_dict.get('solar_orientation', 180):.0f}°",
        "ventilation_strategy": dna_dict.get("natural_ventilation_strategy", "").replace("_", " ").title(),
        "shading_coefficient": f"{dna_dict.get('shading_coefficient', 0.5) * 100:.0f}%",
        "window_wall_ratio": f"{dna_dict.get('window_wall_ratio', 0.4) * 100:.0f}%"
    }
    
    # Aesthetic analysis
    aesthetic_analysis = {
        "color_temperature": dna_dict.get("color_temperature", "").replace("_", " ").title(),
        "texture_variety": f"{dna_dict.get('texture_variety', 0.5) * 100:.0f}%",
        "roof_form": dna_dict.get("roof_form", "").replace("_", " ").title(),
        "rooftop_utility": dna_dict.get("rooftop_utility", "").replace("_", " ").title()
    }
    
    # Uniqueness metrics
    uniqueness_analysis = {
        "dna_signature": dna_dict.get("seed", "")[:12],
        "mutation_factor": f"{dna_dict.get('mutation_factor', 0.0) * 100:.0f}%",
        "generation_timestamp": dna_dict.get("generation_timestamp", 0),
        "uniqueness_score": calculate_uniqueness_score(dna_dict)
    }
    
    return {
        "style": style_analysis,
        "spatial": spatial_analysis,
        "materials": material_analysis,
        "environmental": environmental_analysis,
        "aesthetic": aesthetic_analysis,
        "uniqueness": uniqueness_analysis
    }


def calculate_uniqueness_score(dna_dict: Dict[str, Any]) -> float:
    """
    Calculate a uniqueness score based on DNA characteristics.
    """
    score = 0.0
    
    # Style fusion uniqueness
    blend_ratio = dna_dict.get('style_blend_ratio', 0.5)
    if 0.2 <= blend_ratio <= 0.8:  # Good fusion
        score += 20
    
    # Form uniqueness
    unique_forms = ["courtyard", "H_shape", "pavilion", "cluster"]
    if dna_dict.get("building_form") in unique_forms:
        score += 15
    
    # Material uniqueness
    unique_palettes = ["luxury_premium", "sustainable_green", "natural_organic"]
    if dna_dict.get("facade_material_palette") in unique_palettes:
        score += 10
    
    # Spatial uniqueness
    if dna_dict.get("double_height_presence", False):
        score += 10
    if dna_dict.get("courtyard_presence", False):
        score += 10
    
    # Texture variety
    texture_var = dna_dict.get('texture_variety', 0.5)
    score += texture_var * 15
    
    # Mutation factor
    mutation = dna_dict.get('mutation_factor', 0.0)
    score += mutation * 20
    
    return min(100.0, score)


def get_dna_recommendations(dna_dict: Dict[str, Any], geo_data: Dict[str, Any]) -> List[str]:
    """
    Generate recommendations based on DNA analysis.
    """
    recommendations = []
    
    # Solar orientation recommendations
    optimal_orientation = geo_data.get("optimal_solar_orientation", 180.0)
    current_orientation = dna_dict.get("solar_orientation", 180.0)
    orientation_diff = abs(current_orientation - optimal_orientation)
    
    if orientation_diff > 30:
        recommendations.append(
            f"Consider rotating the building by {optimal_orientation - current_orientation:.0f}° for better solar efficiency"
        )
    
    # Ventilation recommendations
    if dna_dict.get("natural_ventilation_strategy") == "stack_effect":
        recommendations.append("Stack effect ventilation works well with double-height spaces")
    
    # Material recommendations
    climate_zone = geo_data.get("climate_zone", "tropical")
    facade_palette = dna_dict.get("facade_material_palette", "")
    
    if climate_zone == "tropical" and facade_palette == "cool_modern":
        recommendations.append("Cool modern materials help reduce heat gain in tropical climates")
    
    # Space efficiency recommendations
    open_plan_ratio = dna_dict.get("open_plan_ratio", 0.5)
    if open_plan_ratio > 0.7:
        recommendations.append("High open plan ratio promotes natural ventilation and flexibility")
    
    # Sustainability recommendations
    if dna_dict.get("courtyard_presence", False):
        recommendations.append("Central courtyard provides natural cooling and daylighting")
    
    if dna_dict.get("rooftop_utility") == "solar_farm":
        recommendations.append("Rooftop solar installation can significantly reduce energy costs")
    
    # Window recommendations
    wwr = dna_dict.get("window_wall_ratio", 0.4)
    if wwr > 0.6:
        recommendations.append("High window-to-wall ratio requires good shading design")
    
    return recommendations[:6]  # Limit to 6 recommendations


async def cleanup_old_dna_memory():
    """
    Cleanup old DNA entries from memory store.
    Should be called periodically.
    """
    global_memory_store.clear_old(max_age_hours=24)
    
    return {
        "cleaned": True,
        "remaining_entries": len(global_memory_store.full_dnas),
        "signatures_count": len(global_memory_store.signatures)
    }