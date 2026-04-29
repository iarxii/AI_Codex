import os
import shutil
from google.cloud import storage
from backend.config import settings

def download_db_from_gcs():
    """Downloads the SQLite database from GCS on startup."""
    if not settings.GCS_BUCKET_NAME:
        print("GCS_BUCKET_NAME not set, skipping download.")
        return

    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket(settings.GCS_BUCKET_NAME)
        blob = bucket.blob(os.path.basename(settings.DATABASE_FILE))
        
        if blob.exists():
            # Ensure local directory exists
            os.makedirs(os.path.dirname(settings.DATABASE_FILE), exist_ok=True)
            blob.download_to_filename(settings.DATABASE_FILE)
            print(f"Successfully downloaded {settings.DATABASE_FILE} from GCS bucket {settings.GCS_BUCKET_NAME}")
        else:
            print(f"No existing database found in gs://{settings.GCS_BUCKET_NAME}/{os.path.basename(settings.DATABASE_FILE)}")
    except Exception as e:
        print(f"Failed to download database from GCS: {e}")

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
    """
    # 1. Local Write
    workspace_dir = os.path.join("data", "workspaces", session_id, "scratch")
    os.makedirs(workspace_dir, exist_ok=True)
    
    local_path = os.path.join(workspace_dir, filename)
    with open(local_path, "w", encoding="utf-8") as f:
        f.write(content)
    
    print(f"Saved scratchpad locally: {local_path}")

    # 2. GCS Sync (Production)
    if settings.GCS_BUCKET_NAME:
        try:
            storage_client = storage.Client()
            bucket = storage_client.bucket(settings.GCS_BUCKET_NAME)
            
            # GCS path: workspaces/{session_id}/scratch/{filename}
            gcs_path = f"workspaces/{session_id}/scratch/{filename}"
            blob = bucket.blob(gcs_path)
            blob.upload_from_string(content)
            print(f"Synced scratchpad to GCS: gs://{settings.GCS_BUCKET_NAME}/{gcs_path}")
        except Exception as e:
            print(f"Failed to sync scratchpad to GCS: {e}")
    
    return local_path
