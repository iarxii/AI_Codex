#!/bin/bash
# This script creates a Python virtual environment named 'venv' if it doesn't already exist.

set -e # Exit immediately if a command exits with a non-zero status.

VENV_DIR="venv"

# Navigate to the script's directory to ensure venv is created in the right place
cd "$(dirname "$0")"

# Check if the virtual environment directory exists
if [ ! -d "$VENV_DIR" ]; then
    echo "Virtual environment '$VENV_DIR' not found. Creating..."
    # Use python3 to be explicit, as it's the modern standard.
    # You can change this to 'python' if 'python3' is not on your PATH.
    python3 -m venv "$VENV_DIR"
    echo "Virtual environment created successfully."
else
    echo "Virtual environment '$VENV_DIR' already exists."
fi

echo -e "\nTo activate the virtual environment, run the following command in your terminal:\n  source $VENV_DIR/bin/activate\n"