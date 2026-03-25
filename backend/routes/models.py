from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
import os

router = APIRouter()


@router.get("/{project_id}/files")
async def list_model_files(project_id: str):
    """List all 3D model files for a project"""
    # TODO: Implement file listing from storage
    return {
        "project_id": project_id,
        "files": [
            {"format": "glb", "size": "2.4MB", "url": f"/api/models/{project_id}/download/model.glb"},
            {"format": "fbx", "size": "3.1MB", "url": f"/api/models/{project_id}/download/model.fbx"},
            {"format": "obj", "size": "1.8MB", "url": f"/api/models/{project_id}/download/model.obj"}
        ]
    }


@router.get("/{project_id}/download/{filename}")
async def download_model_file(project_id: str, filename: str):
    """Download a specific 3D model file"""
    # TODO: Implement secure file download
    file_path = f"./models/{project_id}/{filename}"
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(file_path)


@router.get("/{project_id}/preview")
async def get_model_preview(project_id: str):
    """Get 3D model preview data for web viewer"""
    return {
        "project_id": project_id,
        "preview_url": f"/api/models/{project_id}/download/model.glb",
        "thumbnail": f"/api/models/{project_id}/thumbnail.jpg",
        "metadata": {
            "polygons": 45000,
            "materials": 12,
            "textures": 8,
            "file_size": "2.4MB"
        }
    }