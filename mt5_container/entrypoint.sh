#!/bin/bash
set -e

# Run initial setup if MT5 terminal does not exist yet
if [ ! -f "/opt/wineprefix/drive_c/Program Files/MetaTrader 5/terminal64.exe" ]; then
    echo "First run: Installing MetaTrader 5..."
    
    # Ensure anti-debugger registry entry is disabled in case of prefix reset
    wine reg delete "HKLM\Software\Microsoft\Windows NT\CurrentVersion\AeDebug" /v Debugger /f || true
    
    # Start Xvfb in background to satisfy installer UI requirements
    Xvfb :1 -screen 0 1024x768x16 &
    XVFB_PID=$!
    sleep 2
    
    # Run installer silently in background
    wine mt5setup.exe /auto &
    
    # Poll for terminal64.exe to be created
    echo "Waiting for MetaTrader 5 installation to complete..."
    TIMEOUT=180
    ELAPSED=0
    while [ ! -f "/opt/wineprefix/drive_c/Program Files/MetaTrader 5/terminal64.exe" ]; do
        sleep 2
        ELAPSED=$((ELAPSED + 2))
        if [ $ELAPSED -ge $TIMEOUT ]; then
            echo "Installation timed out after $TIMEOUT seconds."
            exit 1
        fi
    done
    
    echo "MetaTrader 5 installed successfully!"
    # Give it a few extra seconds to flush final file writes and registry updates
    sleep 5
    kill $XVFB_PID || true
fi

# Hand over to supervisor to run the processes
exec supervisord -c /home/trader/supervisor.conf
