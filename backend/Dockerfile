# Use Bullseye-slim for better Python/OpenCV compatibility
FROM node:20-bullseye-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    poppler-utils \
    python3 \
    python3-pip \
    python3-dev \
    g++ \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Fix: Upgrade pip and install Paddle 2.6.1 (available on the mirror)
RUN pip3 install --upgrade pip setuptools wheel --no-cache-dir
RUN pip3 install paddlepaddle==2.6.1 -i https://www.paddlepaddle.org.cn/packages/stable/cpu/ --no-cache-dir
RUN pip3 install paddleocr==2.7.0 --no-cache-dir

WORKDIR /app

# 1. Install Node Dependencies
COPY backend/package*.json ./
RUN npm install --production

# 2. Copy all backend source code
COPY backend/ ./

# 3. Create essential directories
RUN mkdir -p uploads/pdfs uploads/covers uploads/audio \
    temp/pdfs temp/covers \
    src/ocr_worker/model_cache

# 4. Critical Environment Variables for Render
ENV PYTHONUNBUFFERED=1
ENV PADDLE_HOME=/app/src/ocr_worker/model_cache
ENV OMP_NUM_THREADS=1

EXPOSE 10000

CMD ["node", "src/server.js"]