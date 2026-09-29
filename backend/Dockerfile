FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

ENV DATABASE_URL=sqlite:////data/dev.db
ENV FIXTURES_PATH=/app/dog_food/fixtures.json
ENV PORT=4000
ENV UPLOAD_DIR=/data/uploads

EXPOSE 4000

CMD ["sh", "-c", "python -m app.seed && uvicorn app.main:app --host 0.0.0.0 --port 4000"]
