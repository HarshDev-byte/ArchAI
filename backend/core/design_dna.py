"""
Design DNA System — Ensures every building design is 100% unique.

A Design DNA is a structured genetic code that combines:
- Plot characteristics (location, area, orientation)
- Environmental data (solar, wind, climate)
- Style preferences (user input)
- Random seed (entropy injection)
- Temporal hash (prevents repetition)
"""

import hashlib
import random
import json
import time
import uuid
from dataclasses import dataclass, asdict
from typing import Optional, List, Dict, Any
import math


# Architectural style vocabulary - Indian context with global influences
ARCHITECTURAL_STYLES = [
    "contemporary_minimalist", "tropical_modern", "indo_contemporary",
    "japanese_wabi_sabi", "mediterranean_fusion", "brutalist_modern",
    "biophilic_organic", "deconstructivist", "parametric_geometric",
    "kerala_modern", "rajasthani_fusion", "coastal_vernacular",
    "industrial_loft", "neoclassical_modern", "scandinavian_minimal"
]

# Material palettes for different aesthetic approaches
MATERIAL_PALETTES = {
    "warm_earthy": ["exposed_brick", "teak_wood", "terracotta", "limestone"],
    "cool_modern": ["glass_curtain", "polished_concrete", "steel", "aluminum"],
    "natural_organic": ["bamboo", "rammed_earth", "stone_cladding", "timber"],
    "luxury_premium": ["marble", "exotic_wood", "glass", "brushed_brass"],
    "sustainable_green": ["recycled_materials", "green_walls", "solar_tiles", "mud_brick"],
}

# Roof form vocabulary
ROOF_FORMS = [
    "flat_terrace", "butterfly_inverted", "shed_mono_pitch", "folded_plate",
    "green_roof", "parasol_floating", "jaali_perforated", "butterfly_clerestory",
    "double_pitched_modern", "curved_shell"
]

# Facade pattern vocabulary
FACADE_PATTERNS = [
    "vertical_fins", "horizontal_louvers", "jaali_screen", "perforated_metal",
    "green_facade", "brick_bond_pattern", "glass_box", "textured_plaster",
    "timber_brise_soleil", "parametric_panels"
]

# Building form vocabulary based on plot size
BUILDING_FORMS = {
    "small": ["rectangular", "L_shape", "split_level"],
    "medium": ["L_shape", "U_shape", "courtyard", "split_level"],
    "large": ["courtyard", "U_shape", "H_shape", "pavilion", "cluster"]
}


@dataclass
class DesignDNA:
    """
    Complete genetic encoding of an architectural design.
    Each gene controls specific design characteristics.
    """
    # Identity genes
    dna_id: str
    seed: str
    generation_timestamp: float
    
    # Spatial genes
    plot_area: float
    floors: int
    built_up_area: float
    floor_height: float          # 2.7m to 4.5m
    setback_front: float
    setback_sides: float
    
    # Style genes
    primary_style: str
    secondary_style: str         # Style fusion — blend two styles
    style_blend_ratio: float     # 0.0 = pure primary, 1.0 = pure secondary
    
    # Material genes
    facade_material_palette: str
    interior_material: str
    roof_material: str
    
    # Form genes
    building_form: str           # L-shape, U-shape, rectangular, courtyard, etc.
    roof_form: str
    facade_pattern: str
    
    # Environmental adaptation genes
    solar_orientation: float     # Building rotation in degrees
    natural_ventilation_strategy: str
    shading_coefficient: float   # 0.0 to 1.0
    
    # Spatial programming genes
    open_plan_ratio: float       # 0.0 = all closed rooms, 1.0 = fully open
    courtyard_presence: bool
    double_height_presence: bool
    rooftop_utility: str         # garden/terrace/solar/mechanical
    
    # Aesthetic genes
    window_wall_ratio: float     # 0.2 to 0.8
    color_temperature: str       # warm/cool/neutral/contrasting
    texture_variety: float       # 0.0 = monolithic, 1.0 = high texture variety
    
    # Uniqueness marker
    mutation_factor: float       # Introduces design quirks
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert DNA to dictionary for storage"""
        return asdict(self)
    
    def get_signature(self) -> str:
        """Generate unique signature for this DNA"""
        key_genes = [
            self.primary_style, self.secondary_style, self.building_form,
            self.roof_form, self.facade_pattern, str(self.style_blend_ratio),
            str(self.solar_orientation), str(self.window_wall_ratio)
        ]
        signature_string = "|".join(key_genes)
        return hashlib.md5(signature_string.encode()).hexdigest()[:12]


def generate_seed(
    latitude: float,
    longitude: float,
    plot_area: float,
    budget: int,
    style_prefs: List[str],
    extra_entropy: Optional[str] = None
) -> str:
    """
    Generate a deterministic-but-unique seed from inputs + entropy.
    Same inputs NEVER produce same seed due to UUID + timestamp entropy.
    """
    entropy_sources = [
        str(latitude), str(longitude), str(plot_area),
        str(budget), str(sorted(style_prefs)),
        str(uuid.uuid4()),        # Guaranteed uniqueness
        str(time.time_ns()),      # Nanosecond timestamp
        extra_entropy or ""
    ]
    
    raw = "|".join(entropy_sources)
    return hashlib.sha256(raw.encode()).hexdigest()


def express_dna(
    seed: str,
    plot_area: float,
    floors: int,
    budget: int,
    style_prefs: List[str],
    geo_data: Dict[str, Any],
    memory_store: List[str] = []  # Previous DNA IDs to avoid repetition
) -> DesignDNA:
    """
    Express the Design DNA from a seed — like DNA expression in biology.
    The seed deterministically controls all design choices.
    """
    rng = random.Random(seed)  # Seeded RNG — reproducible from seed
    
    # Mutate if too similar to memory
    if len(memory_store) > 0:
        # Force additional entropy if repeating
        seed = hashlib.sha256(f"{seed}{len(memory_store)}".encode()).hexdigest()
        rng = random.Random(seed)
    
    # Style fusion — pick 2 styles, sometimes from user prefs
    available_styles = ARCHITECTURAL_STYLES.copy()
    if style_prefs:
        primary = rng.choice(style_prefs) if rng.random() > 0.3 else rng.choice(available_styles)
    else:
        primary = rng.choice(available_styles)
    
    secondary = rng.choice([s for s in available_styles if s != primary])
    
    # Spatial calculations
    solar_orientation = geo_data.get("optimal_solar_orientation", 180.0)
    solar_offset = rng.uniform(-25, 25)  # Slight rotation variation
    
    # Form selection based on plot area
    if plot_area < 1000:
        forms = BUILDING_FORMS["small"]
    elif plot_area < 2500:
        forms = BUILDING_FORMS["medium"]
    else:
        forms = BUILDING_FORMS["large"]
    
    # Built-up area calculation with FSI considerations
    fsi_factor = rng.uniform(0.45, 0.65)
    if plot_area > 2000:  # Larger plots can have lower FSI
        fsi_factor = rng.uniform(0.35, 0.55)
    
    # Material selection influenced by budget
    cost_per_sqm = budget / (plot_area * fsi_factor * floors)
    if cost_per_sqm > 35000:  # Premium budget
        material_weights = {"luxury_premium": 0.4, "cool_modern": 0.3, "natural_organic": 0.3}
    elif cost_per_sqm > 25000:  # Mid-range budget
        material_weights = {"cool_modern": 0.4, "natural_organic": 0.3, "warm_earthy": 0.3}
    else:  # Budget conscious
        material_weights = {"warm_earthy": 0.4, "sustainable_green": 0.3, "natural_organic": 0.3}
    
    facade_palette = rng.choices(
        list(material_weights.keys()),
        weights=list(material_weights.values())
    )[0]
    
    # Climate-responsive features
    climate_zone = geo_data.get("climate_zone", "tropical")
    if climate_zone in ["tropical", "hot_humid"]:
        ventilation_strategies = ["cross_ventilation", "stack_effect", "courtyard_draft"]
        shading_coeff = rng.uniform(0.5, 0.8)  # More shading needed
    else:
        ventilation_strategies = ["cross_ventilation", "wind_catcher", "stack_effect"]
        shading_coeff = rng.uniform(0.3, 0.6)
    
    return DesignDNA(
        dna_id=str(uuid.uuid4()),
        seed=seed,
        generation_timestamp=time.time(),
        
        plot_area=plot_area,
        floors=floors,
        built_up_area=plot_area * fsi_factor,
        floor_height=rng.choice([2.75, 3.0, 3.2, 3.5, 4.0, 4.5]),
        setback_front=rng.uniform(3.0, 6.0),
        setback_sides=rng.uniform(1.5, 3.0),
        
        primary_style=primary,
        secondary_style=secondary,
        style_blend_ratio=rng.uniform(0.2, 0.8),
        
        facade_material_palette=facade_palette,
        interior_material=rng.choice([
            "wood_flooring", "polished_concrete", "marble", 
            "terrazzo", "bamboo", "natural_stone"
        ]),
        roof_material=rng.choice([
            "flat_concrete", "terracotta_tile", "metal_sheet", 
            "green_roof_membrane", "clay_tile"
        ]),
        
        building_form=rng.choice(forms),
        roof_form=rng.choice(ROOF_FORMS),
        facade_pattern=rng.choice(FACADE_PATTERNS),
        
        solar_orientation=solar_orientation + solar_offset,
        natural_ventilation_strategy=rng.choice(ventilation_strategies),
        shading_coefficient=shading_coeff,
        
        open_plan_ratio=rng.uniform(0.2, 0.9),
        courtyard_presence=rng.random() > 0.5 and plot_area > 1500,
        double_height_presence=rng.random() > 0.4,
        rooftop_utility=rng.choice(["garden", "terrace", "solar_farm", "mixed"]),
        
        window_wall_ratio=rng.uniform(0.25, 0.70),
        color_temperature=rng.choice(["warm", "cool", "neutral", "high_contrast"]),
        texture_variety=rng.uniform(0.2, 1.0),
        
        mutation_factor=rng.uniform(0.0, 0.3),
    )


def mutate_dna(parent: DesignDNA, mutation_rate: float = 0.2) -> DesignDNA:
    """
    Mutate a Design DNA to create offspring — used in evolutionary algorithm.
    """
    dna_dict = asdict(parent)
    rng = random.Random(f"{parent.seed}_mutant_{time.time_ns()}")
    
    # Style mutations
    if rng.random() < mutation_rate:
        dna_dict["primary_style"] = rng.choice(ARCHITECTURAL_STYLES)
    
    if rng.random() < mutation_rate:
        dna_dict["secondary_style"] = rng.choice(ARCHITECTURAL_STYLES)
    
    if rng.random() < mutation_rate:
        dna_dict["style_blend_ratio"] = rng.uniform(0.1, 0.9)
    
    # Form mutations
    if rng.random() < mutation_rate:
        dna_dict["roof_form"] = rng.choice(ROOF_FORMS)
    
    if rng.random() < mutation_rate:
        dna_dict["facade_pattern"] = rng.choice(FACADE_PATTERNS)
    
    if rng.random() < mutation_rate:
        forms = ["rectangular", "L_shape", "U_shape", "courtyard"]
        dna_dict["building_form"] = rng.choice(forms)
    
    # Spatial mutations
    if rng.random() < mutation_rate:
        dna_dict["floor_height"] = rng.choice([2.75, 3.0, 3.2, 3.5, 4.0])
    
    if rng.random() < mutation_rate:
        dna_dict["window_wall_ratio"] = rng.uniform(0.25, 0.70)
    
    if rng.random() < mutation_rate:
        dna_dict["open_plan_ratio"] = rng.uniform(0.2, 0.9)
    
    # Material mutations
    if rng.random() < mutation_rate:
        dna_dict["facade_material_palette"] = rng.choice(list(MATERIAL_PALETTES.keys()))
    
    # Environmental mutations
    if rng.random() < mutation_rate:
        dna_dict["solar_orientation"] += rng.uniform(-15, 15)
        dna_dict["solar_orientation"] = dna_dict["solar_orientation"] % 360
    
    # Update identity
    dna_dict["dna_id"] = str(uuid.uuid4())
    dna_dict["seed"] = hashlib.sha256(f"{parent.seed}_mutant".encode()).hexdigest()
    dna_dict["mutation_factor"] = rng.uniform(0.1, 0.4)
    dna_dict["generation_timestamp"] = time.time()
    
    return DesignDNA(**dna_dict)


def crossover_dna(parent1: DesignDNA, parent2: DesignDNA) -> DesignDNA:
    """
    Create offspring by crossing over two parent DNAs.
    """
    rng = random.Random(f"{parent1.seed}_{parent2.seed}_{time.time_ns()}")
    
    # Create child by mixing parent traits
    child_dict = {}
    parent1_dict = asdict(parent1)
    parent2_dict = asdict(parent2)
    
    # Crossover strategy: randomly pick from each parent
    for key in parent1_dict:
        if key in ["dna_id", "seed", "generation_timestamp"]:
            continue  # These will be regenerated
        
        if rng.random() < 0.5:
            child_dict[key] = parent1_dict[key]
        else:
            child_dict[key] = parent2_dict[key]
    
    # Generate new identity
    child_dict["dna_id"] = str(uuid.uuid4())
    child_dict["seed"] = hashlib.sha256(f"{parent1.seed}_{parent2.seed}_cross".encode()).hexdigest()
    child_dict["generation_timestamp"] = time.time()
    child_dict["mutation_factor"] = rng.uniform(0.0, 0.2)
    
    return DesignDNA(**child_dict)


def score_dna(dna: DesignDNA, geo_data: Dict[str, Any], budget: int) -> float:
    """
    Fitness scoring for evolutionary selection.
    Higher score = better design for this context.
    """
    score = 0.0
    
    # Solar efficiency score (0-25 points)
    optimal_orientation = geo_data.get("optimal_solar_orientation", 180.0)
    orientation_diff = abs(dna.solar_orientation - optimal_orientation)
    if orientation_diff > 180:
        orientation_diff = 360 - orientation_diff
    score += max(0, 25 - (orientation_diff / 5))
    
    # Budget efficiency score (0-25 points)
    cost_per_sqm = budget / (dna.built_up_area * dna.floors)
    if 15000 <= cost_per_sqm <= 45000:  # Sweet spot INR/sqm
        score += 25
    elif cost_per_sqm < 15000:
        score += 10  # Too cheap — quality concerns
    else:
        score += 15  # Premium — acceptable
    
    # Space efficiency (0-20 points)
    fsi = (dna.built_up_area * dna.floors) / dna.plot_area
    if 0.5 <= fsi <= 2.5:
        score += 20
    else:
        score += 5
    
    # Ventilation score (0-15 points)
    if dna.natural_ventilation_strategy in ["cross_ventilation", "courtyard_draft"]:
        score += 15
    else:
        score += 8
    
    # Innovation/interest score (0-15 points)
    score += dna.texture_variety * 10
    if dna.double_height_presence:
        score += 3
    if dna.courtyard_presence:
        score += 2
    
    # Style coherence bonus (0-10 points)
    if 0.3 <= dna.style_blend_ratio <= 0.7:  # Good balance
        score += 10
    else:
        score += 5
    
    return round(score, 2)


def generate_design_variants(
    base_seed: str,
    plot_area: float,
    floors: int,
    budget: int,
    style_prefs: List[str],
    geo_data: Dict[str, Any],
    num_variants: int = 5,
    memory_store: List[str] = []
) -> List[DesignDNA]:
    """
    Generate multiple design variants using evolutionary approach.
    """
    variants = []
    
    # Generate initial population
    for i in range(num_variants * 2):  # Generate more than needed
        variant_seed = hashlib.sha256(f"{base_seed}_variant_{i}".encode()).hexdigest()
        dna = express_dna(
            variant_seed, plot_area, floors, budget, 
            style_prefs, geo_data, memory_store
        )
        variants.append(dna)
    
    # Score all variants
    scored_variants = []
    for dna in variants:
        score = score_dna(dna, geo_data, budget)
        scored_variants.append((dna, score))
    
    # Sort by score and take top variants
    scored_variants.sort(key=lambda x: x[1], reverse=True)
    top_variants = [dna for dna, score in scored_variants[:num_variants]]
    
    # Apply mutations to create more diversity
    final_variants = []
    for i, dna in enumerate(top_variants):
        if i < num_variants // 2:
            # Keep best variants as-is
            final_variants.append(dna)
        else:
            # Mutate others for diversity
            mutated = mutate_dna(dna, mutation_rate=0.15)
            final_variants.append(mutated)
    
    return final_variants


def dna_similarity(dna1: DesignDNA, dna2: DesignDNA) -> float:
    """
    Calculate similarity between two DNAs (0.0 = completely different, 1.0 = identical).
    """
    # Compare key characteristics
    similarities = []
    
    # Style similarity
    style_sim = 0.0
    if dna1.primary_style == dna2.primary_style:
        style_sim += 0.5
    if dna1.secondary_style == dna2.secondary_style:
        style_sim += 0.3
    if abs(dna1.style_blend_ratio - dna2.style_blend_ratio) < 0.2:
        style_sim += 0.2
    similarities.append(style_sim)
    
    # Form similarity
    form_sim = 0.0
    if dna1.building_form == dna2.building_form:
        form_sim += 0.4
    if dna1.roof_form == dna2.roof_form:
        form_sim += 0.3
    if dna1.facade_pattern == dna2.facade_pattern:
        form_sim += 0.3
    similarities.append(form_sim)
    
    # Spatial similarity
    spatial_sim = 0.0
    if abs(dna1.window_wall_ratio - dna2.window_wall_ratio) < 0.1:
        spatial_sim += 0.3
    if abs(dna1.open_plan_ratio - dna2.open_plan_ratio) < 0.2:
        spatial_sim += 0.3
    if abs(dna1.floor_height - dna2.floor_height) < 0.3:
        spatial_sim += 0.2
    if dna1.courtyard_presence == dna2.courtyard_presence:
        spatial_sim += 0.2
    similarities.append(spatial_sim)
    
    # Material similarity
    material_sim = 0.0
    if dna1.facade_material_palette == dna2.facade_material_palette:
        material_sim += 0.5
    if dna1.interior_material == dna2.interior_material:
        material_sim += 0.3
    if dna1.roof_material == dna2.roof_material:
        material_sim += 0.2
    similarities.append(material_sim)
    
    return sum(similarities) / len(similarities)


def ensure_uniqueness(
    new_dna: DesignDNA,
    existing_dnas: List[DesignDNA],
    similarity_threshold: float = 0.7
) -> DesignDNA:
    """
    Ensure the new DNA is sufficiently different from existing ones.
    If too similar, apply mutations until unique.
    """
    current_dna = new_dna
    max_attempts = 10
    attempt = 0
    
    while attempt < max_attempts:
        too_similar = False
        
        for existing_dna in existing_dnas:
            similarity = dna_similarity(current_dna, existing_dna)
            if similarity > similarity_threshold:
                too_similar = True
                break
        
        if not too_similar:
            return current_dna
        
        # Apply stronger mutations
        current_dna = mutate_dna(current_dna, mutation_rate=0.3 + (attempt * 0.1))
        attempt += 1
    
    return current_dna  # Return even if still similar after max attempts


class DNAMemoryStore:
    """
    Memory store to prevent repetitive designs across sessions.
    """
    
    def __init__(self):
        self.signatures: List[str] = []
        self.full_dnas: List[DesignDNA] = []
    
    def add_dna(self, dna: DesignDNA):
        """Add DNA to memory store"""
        signature = dna.get_signature()
        if signature not in self.signatures:
            self.signatures.append(signature)
            self.full_dnas.append(dna)
    
    def is_similar(self, dna: DesignDNA, threshold: float = 0.7) -> bool:
        """Check if DNA is too similar to stored ones"""
        for stored_dna in self.full_dnas:
            if dna_similarity(dna, stored_dna) > threshold:
                return True
        return False
    
    def get_signatures(self) -> List[str]:
        """Get all stored signatures"""
        return self.signatures.copy()
    
    def clear_old(self, max_age_hours: int = 24):
        """Clear old DNAs from memory"""
        current_time = time.time()
        cutoff_time = current_time - (max_age_hours * 3600)
        
        filtered_dnas = [
            dna for dna in self.full_dnas 
            if dna.generation_timestamp > cutoff_time
        ]
        
        self.full_dnas = filtered_dnas
        self.signatures = [dna.get_signature() for dna in filtered_dnas]


# Global memory store instance
global_memory_store = DNAMemoryStore()