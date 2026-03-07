# Use Bullseye-slim for better Python/OpenCV compatibility
FROM node:20-bullseye-slim

# Install system dependencies
# Added python3-dev and g++ to ensure C++ extensions can compile if needed
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

# Fix: Upgrade pip and install Paddle using the specific CPU mirror
# This bypasses the "No matching distribution found" error
RUN pip3 install --upgrade pip setuptools wheel --no-cache-dir
RUN pip3 install paddlepaddle==2.6.0 -i https://www.paddlepaddle.org.cn/packages/stable/cpu/ --no-cache-dir
RUN pip3 install paddleocr==2.7.0 --no-cache-dir

WORKDIR /app

# 1. Install Node Dependencies
COPY backend/package*.json ./
RUN npm install --production

# 2. Copy all backend source code
COPY backend/ ./

# 3. Create essential directories with correct permissions
RUN mkdir -p uploads/pdfs uploads/covers uploads/audio \
    temp/pdfs temp/covers \
    src/ocr_worker/model_cache

# 4. Critical Environment Variables for Render
ENV PYTHONUNBUFFERED=1
ENV PADDLE_HOME=/app/src/ocr_worker/model_cache
# Forces single-threaded execution to prevent 512MB RAM spikes
ENV OMP_NUM_THREADS=1

EXPOSE 10000

# Start the Node.js server
CMD ["node", "src/server.js"]