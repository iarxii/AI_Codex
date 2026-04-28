@echo off
SET GCLOUD="C:\Users\28523971\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
SET PROJECT_ID=aicodex-lab
SET REGION=us-central1
SET IMAGE_NAME=us-central1-docker.pkg.dev/aicodex-lab/aicodex-repo/backend

echo [1/2] Submitting Build to Google Cloud...
cd backend
%GCLOUD% builds submit --tag %IMAGE_NAME% --project %PROJECT_ID%
if %ERRORLEVEL% NEQ 0 (
    echo Build failed. Exiting.
    pause
    exit /b %ERRORLEVEL%
)

echo [2/2] Deploying to Cloud Run...
%GCLOUD% run deploy backend ^
    --image %IMAGE_NAME% ^
    --platform managed ^
    --region %REGION% ^
    --project %PROJECT_ID% ^
    --allow-unauthenticated

echo Deployment complete!
pause
