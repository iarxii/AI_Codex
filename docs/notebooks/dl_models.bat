@echo off
setlocal enabledelayedexpansion

echo ==================================================
echo Hugging Face GGUF Downloader for Google Drive
echo Target Directory: %~dp0
echo ==================================================

:: 1. Ensure huggingface_hub is installed
pip show huggingface_hub >nul 2>&1
if errorlevel 1 (
    echo Installing huggingface_hub CLI...
    pip install -U huggingface_hub
)

:: 2. Set local temporary download directory to bypass Google Drive virtual filesystem limitations
set "TEMP_DIR=%USERPROFILE%\huggingface_temp_downloads"
mkdir "%TEMP_DIR%\Qwen" 2>nul
mkdir "%TEMP_DIR%\Google" 2>nul

:: Create final directories on Google Drive
mkdir "%~dp0Qwen" 2>nul
mkdir "%~dp0Google" 2>nul

:: 3. Download Qwen 2.5 Coder 7B GGUF to local temp
echo.
echo [1/2] Downloading Qwen 2.5 Coder 7B GGUF to local disk...
hf download Qwen/Qwen2.5-Coder-7B-Instruct-GGUF qwen2.5-coder-7b-instruct-q4_k_m.gguf --local-dir "%TEMP_DIR%\Qwen"

:: Move Qwen model to Google Drive
echo Moving Qwen model to Google Drive...
move /y "%TEMP_DIR%\Qwen\qwen2.5-coder-7b-instruct-q4_k_m.gguf" "%~dp0Qwen\"

:: 4. Download Gemma 2 9B IT GGUF to local temp
echo.
echo [2/2] Downloading Gemma 2 9B IT GGUF to local disk...
hf download bartowski/gemma-2-9b-it-GGUF gemma-2-9b-it-Q4_K_M.gguf --local-dir "%TEMP_DIR%\Google"

:: Move Gemma model to Google Drive
echo Moving Gemma model to Google Drive...
move /y "%TEMP_DIR%\Google\gemma-2-9b-it-Q4_K_M.gguf" "%~dp0Google\"

:: Cleanup temp folder
rd /s /q "%TEMP_DIR%" 2>nul

echo.
echo ==================================================
echo Downloads completed and moved to Google Drive!
echo Files are stored in:
echo %~dp0
echo ==================================================
pause
