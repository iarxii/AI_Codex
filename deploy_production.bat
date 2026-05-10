@echo off
SETLOCAL EnableDelayedExpansion
:: Change to the directory of this script to ensure relative paths work correctly
cd /d "%~dp0"
SET GCLOUD=gcloud
SET PROJECT_ID=aicodex-lab
SET REGION=us-central1
SET BACKEND_IMAGE=us-central1-docker.pkg.dev/%PROJECT_ID%/aicodex-repo/backend
SET FRONTEND_IMAGE=us-central1-docker.pkg.dev/%PROJECT_ID%/aicodex-repo/frontend

:: Default to deploying both
SET DEPLOY_BE=true
SET DEPLOY_FE=true
SET COLAB_URL=
SET COLAB_SECRET=

:: Parse arguments
:parse_args
if "%~1"=="" goto end_parse
if "%~1"=="--be" (
    echo Deployment Mode: Backend Only
    SET DEPLOY_FE=false
) else if "%~1"=="--fe" (
    echo Deployment Mode: Frontend Only
    SET DEPLOY_BE=false
) else if "%~1"=="--colab-url" (
    SET COLAB_URL=%~2
    shift
) else if "%~1"=="--colab-secret" (
    SET COLAB_SECRET=%~2
    shift
) else (
    echo Deployment Mode: Full Stack
)
shift
goto parse_args
:end_parse

if "!COLAB_URL!" NEQ "" echo [DUAL BACKEND] Detected Colab URL: !COLAB_URL!
if "!COLAB_SECRET!" NEQ "" echo [DUAL BACKEND] Detected Colab Handshake Secret.

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
        --memory 1Gi ^
        --timeout 600 ^
        --set-env-vars "SECRET_KEY=AICODEX_SUPER_SECRET_KEY_CHANGEME,DB_TYPE=sqlite,CORS_ORIGINS=*,GCS_BUCKET_NAME=aicodex-data-1096425756328"
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
    call %GCLOUD% builds submit --config cloudbuild.yaml ^
        --project %PROJECT_ID% ^
        --substitutions=_VITE_API_URL=!BACKEND_URL!,_VITE_COLAB_URL=!COLAB_URL!,_VITE_COLAB_SECRET=!COLAB_SECRET!
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
    
    SET ROUTE_MAP_PATH=..\..\adaptivconcept-npc\Adaptivconcept-FL\adaptivconcept-react\src\data\route_map.json
    (
        echo {
        echo   "project": "%PROJECT_ID%",
        echo   "region": "%REGION%",
        echo   "backend_url": "!BACKEND_URL!",
        echo   "frontend_url": "!FRONTEND_URL!",
        echo   "last_deployed": "%DATE% %TIME%"
        echo }
    ) > !ROUTE_MAP_PATH!
    (
        echo {
        echo   "project": "%PROJECT_ID%",
        echo   "region": "%REGION%",
        echo   "backend_url": "!BACKEND_URL!",
        echo   "frontend_url": "!FRONTEND_URL!",
        echo   "last_deployed": "%DATE% %TIME%"
        echo }
    ) > route_map.json
    echo Route map generated in website and local project.
) else (
    echo [SKIP] Skipping frontend deployment steps.
)

echo Deployment task complete!
