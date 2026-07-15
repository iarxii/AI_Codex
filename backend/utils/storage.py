import os
import shutil
from google.cloud import storage
from backend.config import settings, WORKSPACES_DIR

def download_db_from_gcs():
    """Downloads the SQLite database from GCS on startup."""
    if not settings.GCS_BUCKET_NAME:
        print("[STORAGE] GCS_BUCKET_NAME not set, skipping download.")
        return

    print(f"[STORAGE] Attempting to download database from gs://{settings.GCS_BUCKET_NAME}/{os.path.basename(settings.DATABASE_FILE)}")
    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket(settings.GCS_BUCKET_NAME)
        blob = bucket.blob(os.path.basename(settings.DATABASE_FILE))
        
        if blob.exists():
            # Ensure local directory exists
            os.makedirs(os.path.dirname(settings.DATABASE_FILE), exist_ok=True)
            print(f"[STORAGE] Downloading to {settings.DATABASE_FILE}...")
            blob.download_to_filename(settings.DATABASE_FILE)
            print(f"[STORAGE] Successfully downloaded {settings.DATABASE_FILE} from GCS.")
        else:
            print(f"[STORAGE] No existing database found in gs://{settings.GCS_BUCKET_NAME}/{os.path.basename(settings.DATABASE_FILE)}. Starting fresh.")
    except Exception as e:
        print(f"[STORAGE] ERROR: Failed to download database from GCS: {e}")

def upload_db_to_gcs():
    """Uploads the SQLite database to GCS on shutdown."""
    if not settings.GCS_BUCKET_NAME:
        print("GCS_BUCKET_NAME not set, skipping upload.")
        return

    if not os.path.exists(settings.DATABASE_FILE):
        print(f"Database file {settings.DATABASE_FILE} not found, skipping upload.")
        return

    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket(settings.GCS_BUCKET_NAME)
        blob = bucket.blob(os.path.basename(settings.DATABASE_FILE))
        
        blob.upload_from_filename(settings.DATABASE_FILE)
        print(f"Successfully uploaded {settings.DATABASE_FILE} to GCS bucket {settings.GCS_BUCKET_NAME}")
    except Exception as e:
        print(f"Failed to upload database to GCS: {e}")
def save_scratchpad_file(session_id: str, filename: str, content: str):
    """
    Saves content to a local workspace file and syncs to GCS if enabled.
    Path: data/workspaces/{session_id}/scratch/{filename}
    Supports relative subdirectories safely by preventing directory traversal.
    """
    # Resolve the absolute workspace directory
    workspace_dir = str((WORKSPACES_DIR / session_id / "scratch").resolve())
    
    # Resolve the target path absolutely
    target_path = os.path.abspath(os.path.join(workspace_dir, filename))
    
    # Verify target path is strictly within the workspace directory
    if not target_path.startswith(workspace_dir):
        raise ValueError("Security violation: Path must remain within the workspace scratchpad.")

    # 1. Local Write
    os.makedirs(os.path.dirname(target_path), exist_ok=True)
    
    with open(target_path, "w", encoding="utf-8") as f:
        f.write(content)
    
    print(f"[STORAGE] Saved scratchpad locally: {target_path}")

    # 2. GCS Sync (Production)
    if settings.GCS_BUCKET_NAME:
        try:
            storage_client = storage.Client()
            bucket = storage_client.bucket(settings.GCS_BUCKET_NAME)
            
            # GCS path must use forward slashes and be relative
            relative_path = os.path.relpath(target_path, workspace_dir).replace(os.path.sep, "/")
            gcs_path = f"workspaces/{session_id}/scratch/{relative_path}"
            blob = bucket.blob(gcs_path)
            blob.upload_from_string(content)
            print(f"[STORAGE] Synced scratchpad to GCS: gs://{settings.GCS_BUCKET_NAME}/{gcs_path}")
        except Exception as e:
            print(f"[STORAGE] Failed to sync scratchpad to GCS: {e}")
    
    return target_path
