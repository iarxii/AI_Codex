# Use python 3.10 slim
FROM python:3.10-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY . /app/backend

# Copy OllamaOpt (sibling directory)
# NOTE: This requires the build context to be at the level where both AI_Codex and OllamaOpt are visible
# Or we can copy it manually if we are building via a script.
# For now, let's assume we copy it into the backend folder temporarily or handle it in the build command.
COPY ./OllamaOpt_local /app/OllamaOpt

# Set PYTHONPATH
# We need /app to find 'backend' package and /app/OllamaOpt to find 'cli'
ENV PYTHONPATH=/app:/app/OllamaOpt

# Expose port (Cloud Run uses 8080 by default)
EXPOSE 8080

# Set the working directory to the project root (where 'backend' folder is)
# This allows 'import backend.main' to work correctly
WORKDIR /app

# Run the application
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080"]
