#!/bin/bash
# GP HealthMedAgentix setup script

set -e

# Install dependencies in client and server
for dir in client server mcp; do
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

  # Run database migration
  echo "Running database migration..."
  if command -v sqlite3 >/dev/null 2>&1; then
    if [ -f db_lite/migrations/001_create_schema.sql ]; then
      sqlite3 db_lite/chat.db < db_lite/migrations/001_create_schema.sql
      echo "Migration applied to db_lite/chat.db."
    else
      echo "Migration file not found: db_lite/migrations/001_create_schema.sql"
    fi
  else
    echo "sqlite3 not found. Please install SQLite3 and run the migration manually."
  fi
echo "Setup complete."
