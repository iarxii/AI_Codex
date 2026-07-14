# Stage 1: Build the Go sidecar
FROM golang:1.23-alpine AS sidecar-builder
WORKDIR /app
COPY ./codex_spaces_local/sidecar /app
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o ms_agent .

# Stage 2: Main Python runtime
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
COPY ./OllamaOpt_local /app/OllamaOpt
COPY ./codex_spaces_local /app/codex_spaces
COPY ./skills_local /app/skills

# Copy compiled Go sidecar from stage 1
COPY --from=sidecar-builder /app/ms_agent /app/ms_agent

# Set PYTHONPATH
ENV PYTHONPATH=/app:/app/OllamaOpt

# Expose port (Cloud Run uses 8080 by default)
EXPOSE 8080

WORKDIR /app

# Run the application
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080"]
