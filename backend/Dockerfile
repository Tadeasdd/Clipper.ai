FROM python:3.12-slim

WORKDIR /app

# System deps. Phase 2 adds FFmpeg for audio extraction.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ app/
COPY alembic/ alembic/
COPY alembic.ini .

EXPOSE 8000

# Run migrations on boot, then start uvicorn. For larger deployments split these.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
