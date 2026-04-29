@echo off
SET GCLOUD="C:\Users\28523971\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
SET PROJECT_ID=aicodex-lab
SET REGION=us-central1
SET IMAGE_NAME=us-central1-docker.pkg.dev/aicodex-lab/aicodex-repo/backend

echo [1/2] Submitting Build to Google Cloud...
cd backend
call %GCLOUD% builds submit --tag %IMAGE_NAME% --project %PROJECT_ID%
if %ERRORLEVEL% NEQ 0 (
    echo Build failed. Exiting.
    exit /b %ERRORLEVEL%
)

echo [2/2] Deploying to Cloud Run...
call %GCLOUD% run deploy backend ^
    --image %IMAGE_NAME% ^
    --platform managed ^
    --region %REGION% ^
    --project %PROJECT_ID% ^
    --allow-unauthenticated ^
    --set-env-vars "SECRET_KEY=AICODEX_SUPER_SECRET_KEY_CHANGEME,DB_TYPE=sqlite,CORS_ORIGINS=*"

echo Deployment complete!
