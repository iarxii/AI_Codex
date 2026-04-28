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
