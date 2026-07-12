from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from backend.api.auth import get_current_user
from backend.utils.storage import save_scratchpad_file
import os

router = APIRouter()

class ScratchpadUpdate(BaseModel):
    conversation_id: str
    filename: str
    content: str

@router.post("/scratchpad")
async def update_scratchpad(
    data: ScratchpadUpdate,
    current_user: dict = Depends(get_current_user)
):
    """
    Updates the code scratchpad for a specific workspace/conversation.
    The file is saved to the local filesystem and synced to GCS if configured.
    """
    try:
        safe_filename = os.path.basename(data.filename)
        if not safe_filename:
            safe_filename = "scratchpad.py"
            
        local_path = save_scratchpad_file(
            session_id=data.conversation_id,
            filename=safe_filename,
            content=data.content
        )
        
        return {
            "status": "success",
            "path": local_path,
            "filename": safe_filename
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

import shutil
from pathlib import Path

def _get_workspace_root(conversation_id: str) -> Path:
    root = Path(__file__).resolve().parents[2]
    return (root / "data" / "workspaces" / str(conversation_id) / "scratch").resolve()

def _safe_resolve(base_dir: Path, rel_path: str) -> Path:
    # Ensure path contains no traversal outside the base_dir
    abs_path = (base_dir / rel_path).resolve()
    if not str(abs_path).startswith(str(base_dir)):
        raise ValueError("Security violation: Path must remain within the workspace scratchpad.")
    return abs_path

@router.get("/{conversation_id}/files")
async def get_workspace_files(conversation_id: str, current_user: dict = Depends(get_current_user)):
    try:
        base_dir = _get_workspace_root(conversation_id)
        if not base_dir.exists():
            return []
            
        files_data = []
        for p in base_dir.rglob("*"):
            if p.is_file():
                rel_path = p.relative_to(base_dir).as_posix()
                content = p.read_text(errors="replace")
                
                # Determine basic language/type
                ext = p.suffix.lower()
                lang = "text"
                artifact_type = "code"
                
                if ext in [".py"]: lang = "python"
                elif ext in [".js"]: lang = "javascript"
                elif ext in [".ts"]: lang = "typescript"
                elif ext in [".tsx"]: lang = "tsx"
                elif ext in [".jsx"]: lang = "jsx"
                elif ext in [".sh", ".bat"]: lang = "bash"
                elif ext in [".json"]: lang = "json"
                elif ext in [".html"]: lang = "html"
                elif ext in [".css"]: lang = "css"
                elif ext in [".md"]: 
                    lang = "markdown"
                    artifact_type = "docs"
                elif ext in [".txt"]:
                    lang = "text"
                    artifact_type = "docs"
                    
                files_data.append({
                    "path": rel_path,
                    "name": p.name,
                    "size": p.stat().st_size,
                    "type": artifact_type,
                    "language": lang,
                    "content": content,
                    "timestamp": p.stat().st_mtime * 1000
                })
        return files_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class FileCreateRequest(BaseModel):
    path: str
    content: str = ""

@router.post("/{conversation_id}/file")
async def create_workspace_file(conversation_id: str, req: FileCreateRequest, current_user: dict = Depends(get_current_user)):
    try:
        base_dir = _get_workspace_root(conversation_id)
        base_dir.mkdir(parents=True, exist_ok=True)
        target_path = _safe_resolve(base_dir, req.path)
        
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_text(req.content, encoding="utf-8")
        
        return {"status": "success", "path": req.path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class PathRequest(BaseModel):
    path: str

@router.post("/{conversation_id}/folder")
async def create_workspace_folder(conversation_id: str, req: PathRequest, current_user: dict = Depends(get_current_user)):
    try:
        base_dir = _get_workspace_root(conversation_id)
        base_dir.mkdir(parents=True, exist_ok=True)
        target_path = _safe_resolve(base_dir, req.path)
        
        target_path.mkdir(parents=True, exist_ok=True)
        return {"status": "success", "path": req.path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{conversation_id}/delete")
async def delete_workspace_item(conversation_id: str, req: PathRequest, current_user: dict = Depends(get_current_user)):
    try:
        base_dir = _get_workspace_root(conversation_id)
        target_path = _safe_resolve(base_dir, req.path)
        
        if not target_path.exists():
            raise HTTPException(status_code=404, detail="File or folder not found")
            
        if target_path.is_dir():
            shutil.rmtree(target_path)
        else:
            target_path.unlink()
            
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{conversation_id}/stop-process")
async def stop_workspace_process(conversation_id: str, current_user: dict = Depends(get_current_user)):
    try:
        from backend.skills.sandbox import kill_active_process
        success = await kill_active_process(conversation_id)
        if success:
            return {"status": "success", "message": "Process terminated successfully"}
        else:
            return {"status": "info", "message": "No active process found"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
@router.post("/rebuild-global-graph")
async def rebuild_global_graph(
    current_user: dict = Depends(get_current_user)
):
    """
    Triggers a rebuild of the global knowledge map.
    """
    from backend.utils.admin_ops import generate_global_knowledge_map
    success = generate_global_knowledge_map()
    if success:
        return {"status": "success", "message": "Global graph rebuilt successfully."}
    else:
        raise HTTPException(status_code=500, detail="Failed to rebuild global graph.")
