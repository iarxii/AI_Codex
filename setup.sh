#!/bin/bash
# GP HealthMedAgentix setup script

set -e

# Install dependencies in client and server
for dir in client server; do
  echo "Installing dependencies in $dir..."
  cd "$dir"
  npm install
  # Create .env if it doesn't exist
  if [ ! -f .env ]; then
    echo "Creating starter .env in $dir..."
    echo -e "# Example .env for $dir\nPORT=3000" > .env
  fi
  cd ..
done

echo "Setup complete."
