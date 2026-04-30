@echo off
SETLOCAL EnableDelayedExpansion
SET GCLOUD=gcloud
SET PROJECT_ID=aicodex-lab
SET REGION=us-central1
SET BACKEND_IMAGE=us-central1-docker.pkg.dev/%PROJECT_ID%/aicodex-repo/backend
SET FRONTEND_IMAGE=us-central1-docker.pkg.dev/%PROJECT_ID%/aicodex-repo/frontend

:: Default to deploying both
SET DEPLOY_BE=true
SET DEPLOY_FE=true

:: Parse arguments
if "%~1"=="--be" (
    echo Deployment Mode: Backend Only
    SET DEPLOY_FE=false
) else if "%~1"=="--fe" (
    echo Deployment Mode: Frontend Only
    SET DEPLOY_BE=false
) else (
    echo Deployment Mode: Full Stack
)

if "%DEPLOY_BE%"=="true" (
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
) else (
    echo [SKIP] Skipping backend deployment steps.
)

if "%DEPLOY_FE%"=="true" (
    echo Retrieving Backend URL for Frontend build...
    for /f "usebackq tokens=*" %%i in (`powershell -Command "gcloud run services describe aicodex-be --platform managed --region %REGION% --project %PROJECT_ID% --format='value(status.url)'"`) do set BACKEND_URL=%%i
    
    if "!BACKEND_URL!"=="" (
        echo ERROR: Could not retrieve Backend URL. Is 'aicodex-be' deployed?
        echo Check manual: %GCLOUD% run services describe aicodex-be --project %PROJECT_ID%
        exit /b 1
    )
    echo Backend URL detected: !BACKEND_URL!

    echo [3/4] Submitting Frontend Build to Google Cloud...
    pushd client
    call %GCLOUD% builds submit --config cloudbuild.yaml --project %PROJECT_ID% --substitutions=_VITE_API_URL=!BACKEND_URL!
    popd
    if %ERRORLEVEL% NEQ 0 (
        echo Frontend build failed. Exiting.
        exit /b %ERRORLEVEL%
    )

    echo [4/4] Deploying Frontend to Cloud Run as 'aicodex-lab'...
    call %GCLOUD% run deploy aicodex-lab ^
        --image %FRONTEND_IMAGE% ^
        --platform managed ^
        --region %REGION% ^
        --project %PROJECT_ID% ^
        --allow-unauthenticated
    if %ERRORLEVEL% NEQ 0 (
        echo Frontend deployment failed. Exiting.
        exit /b %ERRORLEVEL%
    )

    echo [5/5] Generating Route Map JSON...
    for /f "usebackq tokens=*" %%i in (`powershell -Command "gcloud run services describe aicodex-lab --platform managed --region %REGION% --project %PROJECT_ID% --format='value(status.url)'"`) do set FRONTEND_URL=%%i
    
    SET ROUTE_MAP_PATH=..\..\..\adaptivconcept-npc\Adaptivconcept-FL\adaptivconcept-react\src\data\route_map.json
    (
        echo {
        echo   "project": "%PROJECT_ID%",
        echo   "region": "%REGION%",
        echo   "backend_url": "!BACKEND_URL!",
        echo   "frontend_url": "!FRONTEND_URL!",
        echo   "last_deployed": "%DATE% %TIME%"
        echo }
    ) > !ROUTE_MAP_PATH!
    echo Route map generated: !ROUTE_MAP_PATH!
) else (
    echo [SKIP] Skipping frontend deployment steps.
)

echo Deployment task complete!
