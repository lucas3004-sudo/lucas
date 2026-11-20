FROM python:3.13-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY pyproject.toml ./
COPY agency ./agency
COPY web ./web
RUN pip install --no-cache-dir -e ".[api]"
RUN useradd -m agency && mkdir -p /app/data /app/briefs && chown -R agency /app
USER agency
ENV AGENCY_DATA_DIR=/app/data AGENCY_HOST=0.0.0.0 AGENCY_PORT=8000
EXPOSE 8000
CMD ["python", "-m", "agency", "api"]
