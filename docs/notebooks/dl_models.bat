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

:: 2. Create subdirectories to keep models organized
mkdir "%~dp0Qwen" 2>nul
mkdir "%~dp0Google" 2>nul

:: 3. Download Qwen 2.5 Coder 7B GGUF (Open access, no token required)
echo.
echo [1/2] Downloading Qwen 2.5 Coder 7B GGUF...
hf download Qwen/Qwen2.5-Coder-7B-Instruct-GGUF qwen2.5-coder-7b-instruct-q4_k_m.gguf --local-dir "%~dp0Qwen" --local-dir-use-symlinks False

:: 4. Download Gemma 2 9B IT GGUF (Using a community repack to bypass gating token requirement)
echo.
echo [2/2] Downloading Gemma 2 9B IT GGUF...
hf download bartowski/gemma-2-9b-it-GGUF gemma-2-9b-it-Q4_K_M.gguf --local-dir "%~dp0Google" --local-dir-use-symlinks False

echo.
echo ==================================================
echo Downloads completed! Files are stored in:
echo %~dp0
echo ==================================================
pause
