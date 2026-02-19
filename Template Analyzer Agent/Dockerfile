# Template Analyzer Agent (Python FastAPI) - Cloud Run
FROM python:3.11-slim

WORKDIR /app

# Copy requirements
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY src/ ./src/

# Cloud Run sets PORT (default 8080)
ENV PORT=8080
EXPOSE 8080

# Use PORT from environment (Cloud Run sets it to 8080)
CMD ["sh", "-c", "exec uvicorn src.app:app --host 0.0.0.0 --port ${PORT:-8080}"]
