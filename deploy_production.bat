@echo off
SET GCLOUD="C:\Users\28523971\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
SET PROJECT_ID=aicodex-lab
SET REGION=us-central1
SET BACKEND_IMAGE=us-central1-docker.pkg.dev/%PROJECT_ID%/aicodex-repo/backend
SET FRONTEND_IMAGE=us-central1-docker.pkg.dev/%PROJECT_ID%/aicodex-repo/frontend

echo [1/4] Submitting Backend Build to Google Cloud...
pushd backend
call %GCLOUD% builds submit --tag %BACKEND_IMAGE% --project %PROJECT_ID%
popd
if %ERRORLEVEL% NEQ 0 (
    echo Backend build failed. Exiting.
    exit /b %ERRORLEVEL%
)

echo [2/4] Deploying Backend to Cloud Run as 'aicodex-be'...
call %GCLOUD% run deploy aicodex-be ^
    --image %BACKEND_IMAGE% ^
    --platform managed ^
    --region %REGION% ^
    --project %PROJECT_ID% ^
    --allow-unauthenticated ^
    --set-env-vars "SECRET_KEY=AICODEX_SUPER_SECRET_KEY_CHANGEME,DB_TYPE=sqlite,CORS_ORIGINS=*"
if %ERRORLEVEL% NEQ 0 (
    echo Backend deployment failed. Exiting.
    exit /b %ERRORLEVEL%
)

echo Retrieving Backend URL...
for /f "tokens=*" %%i in ('call %GCLOUD% run services describe aicodex-be --platform managed --region %REGION% --project %PROJECT_ID% --format="value(status.url)"') do set BACKEND_URL=%%i
echo Backend URL detected: %BACKEND_URL%

echo [3/4] Submitting Frontend Build to Google Cloud...
pushd client
call %GCLOUD% builds submit --config cloudbuild.yaml --project %PROJECT_ID% --substitutions=_VITE_API_URL=%BACKEND_URL%
popd
if %ERRORLEVEL% NEQ 0 (
    echo Frontend build failed. Exiting.
    exit /b %ERRORLEVEL%
)

echo [4/4] Deploying Frontend to Cloud Run as 'aicodex-fe'...
call %GCLOUD% run deploy aicodex-fe ^
    --image %FRONTEND_IMAGE% ^
    --platform managed ^
    --region %REGION% ^
    --project %PROJECT_ID% ^
    --allow-unauthenticated
if %ERRORLEVEL% NEQ 0 (
    echo Frontend deployment failed. Exiting.
    exit /b %ERRORLEVEL%
)

echo Full Stack Deployment complete!
