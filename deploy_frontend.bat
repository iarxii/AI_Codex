@echo off
SET GCLOUD="C:\Users\28523971\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
SET PROJECT_ID=aicodex-lab
SET REGION=us-central1
SET IMAGE_NAME=us-central1-docker.pkg.dev/%PROJECT_ID%/aicodex-repo/frontend
SET BACKEND_URL=https://backend-1096425756328.us-central1.run.app

echo [1/2] Submitting Frontend Build to Google Cloud...
cd client
call %GCLOUD% builds submit --config cloudbuild.yaml --project %PROJECT_ID% --substitutions=_VITE_API_URL=%BACKEND_URL%
if %ERRORLEVEL% NEQ 0 (
    echo Build failed. Exiting.
    exit /b %ERRORLEVEL%
)

echo [2/2] Deploying Frontend to Cloud Run...
call %GCLOUD% run deploy frontend ^
    --image %IMAGE_NAME% ^
    --platform managed ^
    --region %REGION% ^
    --project %PROJECT_ID% ^
    --allow-unauthenticated

echo Frontend Deployment complete!
