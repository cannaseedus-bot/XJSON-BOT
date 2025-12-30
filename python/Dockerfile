# XJSON-BOT Python API Server
# Multi-model inference with K'UHUL engine

# ==================== BASE IMAGE ====================
FROM python:3.11-slim as base

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# ==================== CPU BUILD ====================
FROM base as cpu

# Copy requirements
COPY requirements.txt .

# Install CPU-only PyTorch first
RUN pip install torch --index-url https://download.pytorch.org/whl/cpu

# Install remaining dependencies
RUN pip install -r requirements.txt

# Copy application
COPY . .

# Create directories
RUN mkdir -p /app/cache /app/models /app/uploads

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

# ==================== GPU BUILD ====================
FROM nvidia/cuda:12.1.0-runtime-ubuntu22.04 as gpu

# Install Python
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 \
    python3-pip \
    python3.11-venv \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set Python 3.11 as default
RUN ln -sf /usr/bin/python3.11 /usr/bin/python && \
    ln -sf /usr/bin/pip3 /usr/bin/pip

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Copy requirements
COPY requirements.txt .

# Install CUDA-enabled PyTorch
RUN pip install torch --index-url https://download.pytorch.org/whl/cu121

# Install remaining dependencies
RUN pip install -r requirements.txt

# Copy application
COPY . .

# Create directories
RUN mkdir -p /app/cache /app/models /app/uploads

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
