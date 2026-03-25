# ArchAI Database Schema Documentation

## Overview

The ArchAI database is designed to support a comprehensive AI-powered architectural design platform. It uses PostgreSQL with JSONB for flexible data storage and UUID primary keys for scalability.

## Database Setup

### Quick Start with Docker

```bash
# Start PostgreSQL container
docker run --name archai-postgres \
  -e POSTGRES_PASSWORD=archai_pass \
  -e POSTGRES_USER=archai_user \
  -e POSTGRES_DB=archai \
  -p 5432:5432 \
  -d postgres:15

# Run migrations
cd backend
python migrate.py
```

### Manual Setup

1. Install PostgreSQL 15+
2. Create database and user:
   ```sql
   CREATE USER archai_user WITH PASSWORD 'archai_pass';
   CREATE DATABASE archai OWNER archai_user;
   GRANT ALL PRIVILEGES ON DATABASE archai TO archai_user;
   ```
3. Run migrations: `python migrate.py`

## Schema Overview

### Core Tables

#### `users`
User accounts and authentication
- `id` (UUID) - Primary key
- `email` (TEXT) - Unique email address
- `name` (TEXT) - User display name
- `created_at` (TIMESTAMPTZ) - Account creation time

#### `projects`
Design projects created by users
- `id` (UUID) - Primary key
- `user_id` (UUID) - Foreign key to users
- `name` (TEXT) - Project name
- `status` (TEXT) - Project status: pending|processing|complete|error
- **Input Data:**
  - `latitude`, `longitude` (DOUBLE PRECISION) - Site location
  - `plot_area_sqm` (DOUBLE PRECISION) - Plot area in square meters
  - `budget_inr` (BIGINT) - Budget in Indian Rupees
  - `floors` (INTEGER) - Number of floors (default: 2)
  - `style_preferences` (JSONB) - Array of preferred architectural styles
- **Design DNA:**
  - `design_seed` (TEXT) - Random seed for reproducible generation
  - `design_dna` (JSONB) - Complete design DNA parameters
- `created_at`, `updated_at` (TIMESTAMPTZ) - Timestamps

#### `agent_runs`
Execution logs for AI agents
- `id` (UUID) - Primary key
- `project_id` (UUID) - Foreign key to projects
- `agent_name` (TEXT) - Agent type: geo|cost|layout|design|threed|vr|compliance|sustainability
- `status` (TEXT) - Execution status: pending|running|complete|error
- `input_data` (JSONB) - Agent input parameters
- `output_data` (JSONB) - Agent output results
- `error_message` (TEXT) - Error details if failed
- `started_at`, `completed_at` (TIMESTAMPTZ) - Execution timing
- `created_at` (TIMESTAMPTZ) - Record creation time

### Design Output Tables

#### `design_variants`
Generated design variations
- `id` (UUID) - Primary key
- `project_id` (UUID) - Foreign key to projects
- `variant_number` (INTEGER) - Variant sequence number
- `dna` (JSONB) - Design DNA for this specific variant
- `score` (DOUBLE PRECISION) - Evolutionary fitness score
- `is_selected` (BOOLEAN) - Whether user selected this variant
- `floor_plan_svg` (TEXT) - SVG floor plan data
- `model_url` (TEXT) - URL to 3D model file (.glb) in Supabase Storage
- `thumbnail_url` (TEXT) - URL to preview thumbnail
- `created_at` (TIMESTAMPTZ) - Generation time

#### `cost_estimates`
Cost analysis results
- `id` (UUID) - Primary key
- `project_id` (UUID) - Foreign key to projects
- `breakdown` (JSONB) - Detailed cost breakdown by category
- `total_cost_inr` (BIGINT) - Total estimated cost in INR
- `cost_per_sqft` (DOUBLE PRECISION) - Cost per square foot
- `roi_estimate` (JSONB) - Return on investment analysis
- `land_value_estimate` (BIGINT) - Estimated land value
- `created_at` (TIMESTAMPTZ) - Analysis time

#### `geo_analysis`
Site analysis and geographical data
- `id` (UUID) - Primary key
- `project_id` (UUID) - Foreign key to projects
- `plot_data` (JSONB) - Detected plot boundaries and geometry
- `zoning_type` (TEXT) - Zoning classification
- `fsi_allowed` (DOUBLE PRECISION) - Floor Space Index allowed
- `road_access` (JSONB) - Road connectivity analysis
- `nearby_amenities` (JSONB) - Nearby facilities and services
- `elevation_profile` (JSONB) - Topographical data
- `solar_irradiance` (DOUBLE PRECISION) - Solar potential (kWh/m²/year)
- `wind_data` (JSONB) - Wind patterns and speeds
- `created_at` (TIMESTAMPTZ) - Analysis time

#### `compliance_checks`
Building code and zoning compliance
- `id` (UUID) - Primary key
- `project_id` (UUID) - Foreign key to projects
- `fsi_used` (DOUBLE PRECISION) - Floor Space Index used
- `fsi_allowed` (DOUBLE PRECISION) - Floor Space Index allowed
- `setback_compliance` (JSONB) - Setback requirements check
- `height_compliance` (BOOLEAN) - Height restriction compliance
- `parking_required` (INTEGER) - Required parking spaces
- `green_area_required` (DOUBLE PRECISION) - Required green area percentage
- `issues` (JSONB) - Array of compliance issues found
- `passed` (BOOLEAN) - Overall compliance status
- `created_at` (TIMESTAMPTZ) - Check time

## JSONB Data Structures

### `style_preferences` Example
```json
[
  {"style": "modern", "weight": 0.6},
  {"style": "minimalist", "weight": 0.3},
  {"style": "sustainable", "weight": 0.1}
]
```

### `design_dna` Example
```json
{
  "signature": "abc123def456",
  "style_mix": {
    "modern": 0.6,
    "minimalist": 0.4
  },
  "constraints": {
    "height": {"max": 15, "min": 8},
    "setbacks": {"front": 3, "side": 1.5, "rear": 2},
    "rooms": [
      {"name": "living", "min_area": 20, "max_area": 40},
      {"name": "kitchen", "min_area": 10, "max_area": 20}
    ]
  },
  "generation_seed": 12345,
  "variation_strength": 0.5
}
```

### `cost_breakdown` Example
```json
{
  "structure": 2500000,
  "finishing": 1800000,
  "electrical": 400000,
  "plumbing": 300000,
  "hvac": 500000,
  "landscaping": 200000,
  "permits": 100000,
  "labor": 1500000,
  "contingency": 330000
}
```

## Indexes

Performance indexes are created on:
- `projects.user_id` - User's projects lookup
- `projects.status` - Project status filtering
- `agent_runs.project_id` - Agent runs per project
- `agent_runs.agent_name` - Agent type filtering
- All foreign key relationships

## Storage Integration

### Supabase Storage
- **Bucket**: `archai-models`
- **File Types**: .glb, .gltf, .obj (3D models)
- **Access**: Public read, authenticated write
- **Size Limit**: 50MB per file

### File URL Structure
```
https://[supabase-url]/storage/v1/object/public/archai-models/
├── projects/[project-id]/
│   ├── variants/[variant-id]/
│   │   ├── model.glb
│   │   └── thumbnail.jpg
│   └── floor-plans/[variant-id].svg
```

## Migration Commands

```bash
# Create database and tables
python migrate.py

# Reset database (development only)
python -c "
import asyncio
from database import engine, Base
async def reset():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
asyncio.run(reset())
"
```

## Environment Variables

Required in `.env`:
```env
DATABASE_URL=postgresql://archai_user:archai_pass@localhost:5432/archai
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
```

## Security Considerations

1. **UUID Primary Keys**: Prevent enumeration attacks
2. **Foreign Key Constraints**: Ensure data integrity
3. **JSONB Validation**: Validate JSON structure in application layer
4. **Row Level Security**: Implement in Supabase for multi-tenant access
5. **Connection Pooling**: Use pgbouncer in production

## Performance Tips

1. **JSONB Indexing**: Create GIN indexes on frequently queried JSONB fields
2. **Partitioning**: Consider partitioning large tables by date
3. **Connection Pooling**: Use async connection pooling
4. **Query Optimization**: Use EXPLAIN ANALYZE for slow queries

## Backup Strategy

1. **Daily Backups**: Automated PostgreSQL dumps
2. **Point-in-Time Recovery**: WAL archiving enabled
3. **Storage Backups**: Supabase storage replication
4. **Testing**: Regular backup restoration tests