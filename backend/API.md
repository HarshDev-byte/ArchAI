# ArchAI FastAPI Backend Documentation

## Overview

The ArchAI FastAPI backend provides a comprehensive REST API for the AI-powered architectural design platform. It includes user management, project management, AI agent orchestration, and real-time WebSocket communication.

## Base URL

- **Development**: `http://localhost:8000`
- **Production**: `https://api.archai.com`

## Authentication

Currently using simple user ID-based authentication. In production, implement JWT tokens or OAuth2.

## API Endpoints

### Health & Status

#### `GET /health`
Check API health status
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "database": "connected",
  "agents": "ready"
}
```

#### `GET /`
API root information
```json
{
  "message": "ArchAI API is running",
  "version": "1.0.0",
  "docs": "/docs"
}
```

### User Management (`/api/users`)

#### `POST /api/users/`
Create a new user account
```json
// Request
{
  "email": "user@example.com",
  "name": "John Doe"
}

// Response
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "created_at": "2024-01-01T00:00:00Z"
}
```

#### `GET /api/users/{user_id}`
Get user by ID

#### `GET /api/users/email/{email}`
Get user by email address

#### `PUT /api/users/{user_id}`
Update user information

#### `DELETE /api/users/{user_id}`
Delete user account and all associated data

### Project Management (`/api/projects`)

#### `POST /api/projects/?user_id={user_id}`
Create a new architectural design project
```json
// Request
{
  "name": "Modern Villa Project",
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

// Response
{
  "id": "uuid",
  "user_id": "uuid",
  "name": "Modern Villa Project",
  "status": "pending",
  "latitude": 12.9716,
  "longitude": 77.5946,
  "plot_area_sqm": 500.0,
  "budget_inr": 5000000,
  "floors": 2,
  "style_preferences": [...],
  "design_seed": null,
  "design_dna": null,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### `GET /api/projects/?user_id={user_id}&page=1&per_page=10&status=pending`
List user's projects with pagination and filtering
```json
{
  "projects": [...],
  "total": 25,
  "page": 1,
  "per_page": 10
}
```

#### `GET /api/projects/{project_id}`
Get project with all related data (agent runs, variants, estimates, etc.)
```json
{
  "id": "uuid",
  "name": "Modern Villa Project",
  // ... project fields
  "agent_runs": [...],
  "design_variants": [...],
  "cost_estimates": [...],
  "geo_analysis": [...],
  "compliance_checks": [...]
}
```

#### `PUT /api/projects/{project_id}`
Update project details

#### `DELETE /api/projects/{project_id}`
Delete project and all related data

#### `GET /api/projects/{project_id}/status`
Get current project status and progress
```json
{
  "project_id": "uuid",
  "status": "processing",
  "progress": 65.5,
  "agents": {
    "geo": {"status": "complete", "started_at": "...", "completed_at": "..."},
    "cost": {"status": "running", "started_at": "...", "completed_at": null},
    "design": {"status": "pending", "started_at": null, "completed_at": null}
  },
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### `POST /api/projects/{project_id}/duplicate?new_name=New Project Name`
Duplicate an existing project

### Design Generation (`/api/generate`)

#### `POST /api/generate/start`
Start the complete AI design generation pipeline
```json
// Request
{
  "project_id": "uuid",
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

// Response
{
  "task_id": "gen_uuid_timestamp",
  "project_id": "uuid",
  "status": "started",
  "message": "Design generation pipeline started successfully"
}
```

#### `GET /api/generate/status/{project_id}`
Get current status of all agents for a project
```json
{
  "project_id": "uuid",
  "overall_status": "processing",
  "overall_progress": 45.5,
  "agents": [
    {
      "name": "geo",
      "status": "complete",
      "progress": 100.0,
      "output": {...},
      "error": null,
      "started_at": "2024-01-01T00:00:00Z",
      "completed_at": "2024-01-01T00:05:00Z"
    },
    {
      "name": "cost",
      "status": "running",
      "progress": 50.0,
      "output": null,
      "error": null,
      "started_at": "2024-01-01T00:05:00Z",
      "completed_at": null
    }
  ]
}
```

#### `POST /api/generate/customize/{project_id}`
Re-run specific agents when user modifies inputs
```json
// Request
{
  "changed_inputs": {
    "budget_inr": 6000000,
    "style_preferences": [{"style": "modern", "weight": 0.8}]
  },
  "agents_to_rerun": ["cost", "design", "threed"]
}

// Response
{
  "project_id": "uuid",
  "task_id": "custom_uuid_timestamp",
  "status": "restarted",
  "agents_rerun": ["cost", "design", "threed"],
  "message": "Restarted 3 agents with updated inputs"
}
```

#### `POST /api/generate/select-variant/{variant_id}`
User selects their preferred design variant
```json
{
  "variant_id": "uuid",
  "project_id": "uuid",
  "status": "selected",
  "message": "Design variant selected successfully"
}
```

#### `GET /api/generate/variants/{project_id}`
Get all design variants for a project
```json
{
  "project_id": "uuid",
  "variants": [
    {
      "id": "uuid",
      "variant_number": 1,
      "score": 85.5,
      "is_selected": true,
      "dna": {...},
      "model_url": "https://storage.url/model.glb",
      "thumbnail_url": "https://storage.url/thumb.jpg",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 5
}
```

#### `DELETE /api/generate/cancel/{project_id}`
Cancel ongoing generation for a project

### Agent Management (`/api/agents`)

#### `GET /api/agents/?project_id={uuid}&agent_name=geo&status=complete&limit=50`
List agent runs with optional filtering
```json
[
  {
    "id": "uuid",
    "project_id": "uuid",
    "agent_name": "geo",
    "status": "complete",
    "input_data": {...},
    "output_data": {...},
    "error_message": null,
    "started_at": "2024-01-01T00:00:00Z",
    "completed_at": "2024-01-01T00:05:00Z",
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

#### `GET /api/agents/{run_id}`
Get detailed information about a specific agent run

#### `POST /api/agents/`
Create a new agent run (typically called by the orchestrator)

#### `PUT /api/agents/{run_id}`
Update agent run status and results

#### `GET /api/agents/stats/summary?days=7`
Get agent performance statistics
```json
{
  "period_days": 7,
  "start_date": "2024-01-01T00:00:00Z",
  "end_date": "2024-01-08T00:00:00Z",
  "agent_stats": {
    "geo": {
      "total_runs": 25,
      "successful_runs": 23,
      "failed_runs": 2,
      "pending_runs": 0,
      "running_runs": 0,
      "avg_duration_seconds": 45.2,
      "success_rate": 92.0
    }
  }
}
```

#### `GET /api/agents/health/check`
Check the health status of all AI agents
```json
{
  "overall_status": "healthy",
  "healthy_agents": 8,
  "total_agents": 8,
  "agents": {
    "orchestrator": {"status": "healthy", "message": "Agent initialized successfully"},
    "geo": {"status": "healthy", "message": "Agent initialized successfully"}
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

#### `POST /api/agents/retry/{run_id}`
Retry a failed agent run

#### `DELETE /api/agents/{run_id}`
Delete an agent run (admin only)

## WebSocket Communication

### `WS /ws/{project_id}`
Real-time updates for project generation progress

**Connection**: Connect to receive real-time updates for a specific project
**Messages Received**:
```json
// Status update
{
  "type": "status_update",
  "status": "processing",
  "message": "Starting design generation pipeline"
}

// Agent progress
{
  "type": "agent_progress",
  "agent": "geo",
  "status": "running",
  "progress": 75.0,
  "message": "Analyzing site conditions"
}

// Generation complete
{
  "type": "generation_complete",
  "status": "complete",
  "result": {...},
  "message": "Design generation completed successfully"
}

// Error notification
{
  "type": "generation_error",
  "status": "error",
  "error": "Agent failed: connection timeout",
  "message": "Design generation failed: connection timeout"
}

// Heartbeat response
{
  "type": "heartbeat",
  "timestamp": "client_timestamp"
}
```

## Error Handling

### Standard Error Response
```json
{
  "error": "Error message",
  "detail": "Detailed error description",
  "code": "ERROR_CODE"
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `404` - Not Found
- `422` - Unprocessable Entity (validation error)
- `500` - Internal Server Error

### Validation Error Response
```json
{
  "error": "Validation Error",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format",
      "type": "value_error.email"
    }
  ]
}
```

## Rate Limiting

- **Generation endpoints**: 5 requests per minute per user
- **General endpoints**: 100 requests per minute per user
- **WebSocket connections**: 10 concurrent connections per user

## Data Models

### Project Status Values
- `pending` - Project created, not yet processed
- `processing` - AI agents are working on the project
- `complete` - All agents completed successfully
- `error` - One or more agents failed
- `cancelled` - Generation was cancelled by user

### Agent Names
- `geo` - Geographical analysis agent
- `cost` - Cost estimation agent
- `layout` - Layout planning agent
- `design` - Design generation agent
- `threed` - 3D model generation agent
- `compliance` - Building code compliance agent
- `sustainability` - Sustainability analysis agent

### Agent Status Values
- `pending` - Agent not yet started
- `running` - Agent currently executing
- `complete` - Agent completed successfully
- `error` - Agent failed with error
- `cancelled` - Agent execution was cancelled

## Testing

Run the comprehensive API test suite:
```bash
cd backend
python test_api.py
```

## Interactive Documentation

- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

## Development

Start the development server:
```bash
cd backend
python main.py
```

The API will be available at `http://localhost:8000` with automatic reload enabled.