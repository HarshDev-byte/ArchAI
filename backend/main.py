from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.websockets import WebSocket
import asyncio
from contextlib import asynccontextmanager
from database import init_db, close_db
from routes import projects, generate, agents
from config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("🚀 Starting ArchAI API...")
    try:
        await init_db()
        print("✅ Database initialized successfully")
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        raise e
    
    yield
    
    # Shutdown
    print("🔄 Shutting down ArchAI API...")
    await close_db()
    print("✅ Database connections closed")


app = FastAPI(
    title="ArchAI API", 
    description="AI-Powered Architectural Design Platform",
    version="1.0.0", 
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(generate.router, prefix="/api/generate", tags=["generate"])
app.include_router(agents.router, prefix="/api/agents", tags=["agents"])

# Import and include users router
from routes import users
app.include_router(users.router, prefix="/api/users", tags=["users"])


# WebSocket manager for real-time agent progress
class ConnectionManager:
    def __init__(self):
        self.active: dict[str, WebSocket] = {}
    
    async def connect(self, project_id: str, ws: WebSocket):
        await ws.accept()
        self.active[project_id] = ws
        print(f"🔌 WebSocket connected for project: {project_id}")
    
    async def send_update(self, project_id: str, data: dict):
        if project_id in self.active:
            try:
                await self.active[project_id].send_json(data)
                print(f"📡 Sent update to project {project_id}: {data.get('type', 'unknown')}")
            except Exception as e:
                print(f"❌ Failed to send WebSocket update: {e}")
                del self.active[project_id]
    
    def disconnect(self, project_id: str):
        self.active.pop(project_id, None)
        print(f"🔌 WebSocket disconnected for project: {project_id}")


manager = ConnectionManager()
app.state.manager = manager


@app.websocket("/ws/{project_id}")
async def websocket_endpoint(websocket: WebSocket, project_id: str):
    await manager.connect(project_id, websocket)
    try:
        while True:
            # Keep connection alive and listen for client messages
            data = await websocket.receive_text()
            # Echo back for heartbeat
            await websocket.send_json({"type": "heartbeat", "timestamp": data})
    except Exception as e:
        print(f"WebSocket error for project {project_id}: {e}")
    finally:
        manager.disconnect(project_id)


@app.get("/")
async def root():
    return {
        "message": "ArchAI API is running",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "version": "1.0.0",
        "database": "connected",
        "agents": "ready"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True if settings.ENVIRONMENT == "development" else False
    )