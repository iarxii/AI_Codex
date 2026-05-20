#!/bin/bash
set -e

# Run initial setup if MT5 terminal does not exist yet
if [ ! -f "/opt/wineprefix/drive_c/Program Files/MetaTrader 5/terminal64.exe" ]; then
    echo "First run: Installing MetaTrader 5..."
    # Start Xvfb in background to satisfy installer UI requirements
    Xvfb :1 -screen 0 1024x768x16 &
    XVFB_PID=$!
    sleep 2
    
    # Run installer silently
    wine mt5setup.exe /auto
    
    # Wait for setup to finish
    sleep 10
    kill $XVFB_PID
fi

# Hand over to supervisor to run the processes
exec supervisord -c /home/trader/supervisor.conf
