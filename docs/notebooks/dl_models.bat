@echo off
setlocal enabledelayedexpansion

echo ==================================================
echo Hugging Face GGUF Downloader for Google Drive
echo Target Directory: %~dp0
echo ==================================================

:: 1. Ensure huggingface_hub and hf_transfer are installed
pip show huggingface_hub >nul 2>&1
if errorlevel 1 (
    echo Installing huggingface_hub CLI...
    pip install -U huggingface_hub
)
pip show hf_transfer >nul 2>&1
if errorlevel 1 (
    echo Installing hf_transfer for optimized high-speed downloads...
    pip install -U hf_transfer
)

:: Configure environment variables for high-speed download optimizations
:: Enable Rust-based hf_transfer (un-capped download speeds)
set HF_HUB_ENABLE_HF_TRANSFER=1
:: Enable high performance transfer with Xet for newer huggingface_hub versions
set HF_XET_HIGH_PERFORMANCE=1

:: Optional troubleshooting variables (uncomment if needed):
:: Set mirror endpoint if Hugging Face is blocked/throttled in your region:
:: set HF_ENDPOINT=https://hf-mirror.com
:: Disable git-xet integration if large file downloads hang:
:: set HF_HUB_DISABLE_XET=1

:: 2. Set local temporary download directory to bypass Google Drive virtual filesystem limitations
set "TEMP_DIR=%USERPROFILE%\huggingface_temp_downloads"
mkdir "%TEMP_DIR%\Qwen" 2>nul
mkdir "%TEMP_DIR%\Google" 2>nul
mkdir "%TEMP_DIR%\DeepSeek" 2>nul

:: Create final directories on Google Drive
mkdir "%~dp0Qwen" 2>nul
mkdir "%~dp0Google" 2>nul
mkdir "%~dp0DeepSeek" 2>nul

:: 3. Download Qwen 2.5 Coder 7B GGUF to local temp
echo.
if exist "%~dp0Qwen\qwen2.5-coder-7b-instruct-q4_k_m.gguf" (
    echo Qwen 2.5 Coder 7B GGUF already exists in Google Drive. Skipping.
) else (
    echo [1/3] Downloading Qwen 2.5 Coder 7B GGUF to local disk...
    hf download Qwen/Qwen2.5-Coder-7B-Instruct-GGUF qwen2.5-coder-7b-instruct-q4_k_m.gguf --local-dir "%TEMP_DIR%\Qwen"
    
    :: Move Qwen model to Google Drive
    echo Moving Qwen model to Google Drive...
    move /y "%TEMP_DIR%\Qwen\qwen2.5-coder-7b-instruct-q4_k_m.gguf" "%~dp0Qwen\"
)

:: 4. Download Gemma 4 E4B IT QAT GGUF to local temp
echo.
if exist "%~dp0Google\gemma-4-E4B_q4_0-it.gguf" (
    echo Gemma 4 E4B IT QAT GGUF already exists in Google Drive. Skipping.
) else (
    echo [2/3] Downloading Gemma 4 E4B IT QAT GGUF to local disk...
    hf download google/gemma-4-E4B-it-qat-q4_0-gguf gemma-4-E4B_q4_0-it.gguf --local-dir "%TEMP_DIR%\Google"
    
    :: Move Gemma model to Google Drive
    echo Moving Gemma model to Google Drive...
    move /y "%TEMP_DIR%\Google\gemma-4-E4B_q4_0-it.gguf" "%~dp0Google\"
)

:: 5. Download DeepSeek R1 Distill Llama 8B GGUF to local temp
echo.
if exist "%~dp0DeepSeek\DeepSeek-R1-Distill-Llama-8B-Q4_K_M.gguf" (
    echo DeepSeek R1 Distill Llama 8B GGUF already exists in Google Drive. Skipping.
) else (
    echo [3/3] Downloading DeepSeek R1 Distill Llama 8B GGUF to local disk...
    hf download unsloth/DeepSeek-R1-Distill-Llama-8B-GGUF DeepSeek-R1-Distill-Llama-8B-Q4_K_M.gguf --local-dir "%TEMP_DIR%\DeepSeek"
    
    :: Move DeepSeek model to Google Drive
    echo Moving DeepSeek model to Google Drive...
    move /y "%TEMP_DIR%\DeepSeek\DeepSeek-R1-Distill-Llama-8B-Q4_K_M.gguf" "%~dp0DeepSeek\"
)

:: Cleanup temp folder
rd /s /q "%TEMP_DIR%" 2>nul

echo.
echo ==================================================
echo Downloads completed and moved to Google Drive!
echo Files are stored in:
echo %~dp0
echo ==================================================
pause
