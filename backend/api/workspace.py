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
        # Security: Ensure filename is just a filename, no path traversal
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
