# ArchAI - AI-Powered Architectural Design Platform

ArchAI is an intelligent architectural design platform that uses AI agents to generate, optimize, and visualize building designs with real-time cost estimation and compliance checking.

## 🏗️ Architecture

- **Frontend**: Next.js 14 with TypeScript, Tailwind CSS, Babylon.js
- **Backend**: FastAPI with LangChain multi-agent system
- **Database**: PostgreSQL with Supabase integration
- **Cache**: Redis for agent coordination
- **3D Generation**: Blender Python API integration

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+
- Docker & Docker Compose

### Setup

1. **Clone and setup environment**:
   ```bash
   git clone <repository-url>
   cd archai
   
   # Copy environment variables
   cp .env.example .env
   # Edit .env with your API keys
   ```

2. **Install all dependencies**:
   ```bash
   npm run setup
   ```

3. **Start infrastructure services**:
   ```bash
   npm run docker:up
   ```

4. **Start development servers**:
   ```bash
   npm run dev
   ```

5. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs
   - PgAdmin: http://localhost:5050 (admin@archai.com / admin123)

## 📁 Project Structure

```
archai/
├── frontend/                    # Next.js 14 application
│   ├── app/                    # App router pages
│   ├── components/             # Reusable UI components
│   └── lib/                    # Utilities and API client
├── backend/                    # FastAPI application
│   ├── agents/                 # AI agent implementations
│   ├── core/                   # Core systems (DNA, evolution)
│   ├── routes/                 # API endpoints
│   ├── schemas/                # Pydantic models
│   └── blender/                # 3D generation templates
├── docker-compose.yml          # Development services
└── package.json                # Monorepo scripts
```

## 🤖 AI Agent System

- **Orchestrator**: Coordinates all agents for complete design generation
- **Geo Agent**: Site analysis, climate data, zoning information
- **Layout Agent**: Floor plan optimization and space planning
- **Design Agent**: Style fusion and evolutionary design algorithms
- **3D Agent**: Blender-based model generation and rendering
- **Cost Agent**: Construction cost estimation and optimization
- **Compliance Agent**: Building code and zoning compliance checking
- **Sustainability Agent**: NREL solar analysis, energy efficiency, green certifications

## 🔧 Development Scripts

```bash
# Development
npm run dev                 # Start both frontend and backend
npm run dev:frontend        # Start only frontend
npm run dev:backend         # Start only backend

# Build
npm run build              # Build both applications
npm run build:frontend     # Build frontend only
npm run build:backend      # Install backend dependencies

# Docker
npm run docker:up          # Start PostgreSQL, Redis, PgAdmin
npm run docker:down        # Stop all services
npm run docker:logs        # View service logs

# Setup
npm run setup              # Install all dependencies
```

## 🌐 API Keys Required

Get free API keys from:

- **Anthropic**: console.anthropic.com (AI reasoning)
- **Groq**: console.groq.com (fast AI processing)
- **Mapbox**: mapbox.com (interactive maps)
- **Supabase**: supabase.com (database & auth)
- **Upstash**: upstash.com (Redis cache)
- **NREL**: developer.nrel.gov (solar data)

## 🎯 Key Features

- **AI-Driven Design Generation**: Multi-agent system for intelligent architectural design
- **3D Visualization**: Real-time 3D rendering with VR/WebXR support
- **Cost Estimation**: Real-time cost analysis and material optimization
- **Compliance Checking**: Automated building code and zoning validation
- **Sustainability Analysis**: Solar potential, energy efficiency, green certifications
- **Geospatial Integration**: Mapbox integration for site analysis

## 📖 Documentation

- API Documentation: http://localhost:8000/docs (when running)
- Frontend Components: `/frontend/components/`
- Backend Agents: `/backend/agents/`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

---

Built with ❤️ by the ArchAI team