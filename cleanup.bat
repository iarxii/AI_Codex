@echo off
setlocal enabledelayedexpansion

echo AI Codex System Cleanup - Initializing Node/Python Purge...
echo ========================================================

:: 1. Client cleanup
echo [PROC] Purging Client artifacts...
if exist "client\dist" (
    echo - Removing dist...
    rd /s /q "client\dist"
)
if exist "client\.next" (
    echo - Removing .next...
    rd /s /q "client\.next"
)

:: 2. Python cleanup
echo [PROC] Scouring Python __pycache__...
for /d /r . %%d in (__pycache__) do (
    if exist "%%d" (
        echo - Deleting %%d
        rd /s /q "%%d"
    )
)

:: 3. Log cleanup
echo [PROC] Clearing system logs and debug traces...
if exist "logs" (
    echo - Wiping logs folder...
    del /q "logs\*.log"
)
if exist "debug.log" del /q "debug.log"
if exist "client\debug.txt" del /q "client\debug.txt"
if exist "client\npm-debug.log" del /q "client\npm-debug.log"

:: 4. Deployment staging cleanup
echo [PROC] Removing failed deployment staging folders...
if exist "backend\codex_spaces_local" (
    echo - Removing backend\codex_spaces_local...
    rd /s /q "backend\codex_spaces_local"
)
if exist "backend\skills_local" (
    echo - Removing backend\skills_local...
    rd /s /q "backend\skills_local"
)
if exist "client\codex_spaces_temp" (
    echo - Removing client\codex_spaces_temp...
    rd /s /q "client\codex_spaces_temp"
)

:: 5. Git Optimization
echo [PROC] Optimizing Git repository (GC)...
git gc --prune=now --aggressive

:: 6. Conditional Heavy Cleanup
if "%1"=="full" (
    echo [CRITICAL] Full Purge Mode: Removing node_modules...
    if exist "client\node_modules" (
        echo - Nuking client\node_modules...
        rd /s /q "client\node_modules"
    )
    if exist "mcp\node_modules" (
        echo - Nuking mcp\node_modules...
        rd /s /q "mcp\node_modules"
    )
    echo [INFO] Heavy cleanup finished. Run 'npm install' in respective directories to rebuild.
) else (
    echo [INFO] Skipping node_modules. Use 'cleanup.bat full' to purge dependencies.
)

echo ========================================================
echo [DONE] System cleanup completed. 
echo [INFO] Check disk space before attempting push/pull.
pause
