@echo off
setlocal enabledelayedexpansion

:: Define the root directory relative to the script
set "ROOT_DIR=.\root\icons"

echo Creating directory: %ROOT_DIR%
if not exist "%ROOT_DIR%" mkdir "%ROOT_DIR%"

echo Generating 10 icons...

:: 1. Home
echo ^<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"^>^<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"^>^<polyline points="9 22 9 12 15 12 15 22"^>/^<svg^> > "%ROOT_DIR%\home.svg"

:: 2. Settings
echo ^<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"^>^<circle cx="12" cy="12" r="3"^>^<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H21a2 2 0 0 1 2-2 2 2 0 0 1-2-2h-.09a1.65 1.65 0 0 0-1.51-1z"^>/^<svg^> > "%ROOT_DIR%\settings.svg"

:: 3. User
echo ^<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"^>^<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"^>^<circle cx="12" cy="7" r="4"^>/^<svg^> > "%ROOT_DIR%\user.svg"

:: 4. Search
echo ^<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"^>^<circle cx="11" cy="11" r="8"^>^<line x1="21" y1="21" x2="16.65" y2="16.65"^>/^<svg^> > "%ROOT_DIR%\search.svg"

:: 5. Bell
echo ^<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"^>^<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"^>^<path d="M13.73 21a2 2 0 0 1-3.46 0"^>/^<svg^> > "%ROOT_DIR%\bell.svg"

:: 6. Mail
echo ^<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"^>^<rect width="20" height="16" x="2" y="4" rx="2"^>^<path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"^>/^<svg^> > "%ROOT_DIR%\mail.svg"

:: 7. Lock
echo ^<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"^>^<rect width="18" height="11" x="3" y="11" rx="2" ry="5"^>^<path d="M7 11V7a5 5 0 0 1 10 0v4"^>/^<svg^> > "%ROOT_DIR%\lock.svg"

:: 8. Trash
echo ^<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"^>^<path d="M3 6h18"^>^<path d="M19 6v14c0 1-1 2-2 2H7a2 2 0 0 1-2-2V6"^>^<path d="M8 6v14"^>^<path d="M10 6v14"^>^<path d="M12 6v14"^>^<path d="M14 6v14"^>^<path d="M16 6v14"^>/^<svg^> > "%ROOT_DIR%\trash.svg"

:: 9. Check
echo ^<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"^>^<polyline points="20 6 9 17 4 12"^>/^<svg^> > "%ROOT_DIR%\check.svg"

:: 10. Close
echo ^<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"^>^<path d="M18 6L6 18"^>^<path d="M6 6l12 12"^>/^<svg^> > "%ROOT_DIR%\close.svg"

echo Done! Icons generated in %ROOT_DIR%
pause