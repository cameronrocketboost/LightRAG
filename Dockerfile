# Build stage
FROM python:3.11-slim AS builder

WORKDIR /app

# Install Rust and required build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    pkg-config \
    # Add system dependencies for document parsing (needed by textract/specific libs)
    antiword \
    poppler-utils \
    tesseract-ocr \
    libreoffice \
    # End added dependencies
    && rm -rf /var/lib/apt/lists/* \
    && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y \
    && . $HOME/.cargo/env

# Copy only requirements files first to leverage Docker cache
COPY requirements.txt .
COPY lightrag/api/requirements.txt ./lightrag/api/

# Install dependencies
ENV PATH="/root/.cargo/bin:${PATH}"
RUN pip install --user --no-cache-dir -r requirements.txt
# Add python-pptx to the API requirements install
RUN pip install --user --no-cache-dir -r lightrag/api/requirements.txt python-pptx

# Final stage
FROM python:3.11-slim

WORKDIR /app

# Copy necessary system libraries installed in builder stage
COPY --from=builder /usr/bin/ /usr/bin/
COPY --from=builder /usr/lib/ /usr/lib/
COPY --from=builder /lib/ /lib/
COPY --from=builder /etc/ /etc/
# Copy only necessary files from builder
COPY --from=builder /root/.local /root/.local
COPY ./lightrag ./lightrag
COPY setup.py .

# Install the main package (should already be done by copy from builder, but safe)
# RUN pip install . 
# Make sure scripts in .local are usable
ENV PATH=/root/.local/bin:$PATH

# Create necessary directories
RUN mkdir -p /app/data/rag_storage /app/data/inputs

# Docker data directories
ENV WORKING_DIR=/app/data/rag_storage
ENV INPUT_DIR=/app/data/inputs

# Expose the default port
EXPOSE 9621

# Set entrypoint
ENTRYPOINT ["python", "-m", "lightrag.api.lightrag_server"]
