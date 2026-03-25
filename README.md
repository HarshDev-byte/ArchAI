# Archai - AI-Powered Architectural Design Platform

Archai is an intelligent architectural design platform that uses AI agents to generate, optimize, and visualize building designs with real-time cost estimation and compliance checking.

## Features

- **AI-Driven Design Generation**: Multi-agent system for intelligent architectural design
- **3D Visualization**: Real-time 3D rendering with VR/WebXR support
- **Cost Estimation**: Real-time cost analysis and material optimization
- **Compliance Checking**: Automated zoning and building code validation
- **Evolutionary Design**: Design DNA system with style fusion capabilities
- **Geospatial Integration**: Mapbox integration for site analysis

## Quick Start

```bash
# Setup the entire development environment
./scripts/setup.sh

# Start development servers
docker-compose up -d
```

## Architecture

- **Frontend**: Next.js 14 with TypeScript, Tailwind CSS, Babylon.js
- **Backend**: FastAPI with LangGraph multi-agent system
- **Database**: Supabase (PostgreSQL) with real-time subscriptions
- **3D Generation**: Blender Python API integration
- **Deployment**: Docker containerization

## Development

See individual README files in `frontend/` and `backend/` directories for detailed setup instructions.