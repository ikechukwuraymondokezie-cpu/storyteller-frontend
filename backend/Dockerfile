# Use a slim version of Node to keep the image lightweight
FROM node:20-bullseye-slim

# Install system dependencies
# 1. poppler-utils: for pdftoppm (Covers)
# 2. tesseract-ocr: the engine for image extraction
# 3. tesseract-ocr-eng: English language data (add others like -fra, -spa if needed)
# 4. ca-certificates: for Cloudinary/MongoDB SSL
RUN apt-get update && apt-get install -y \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-eng \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy backend dependency files
COPY backend/package*.json ./

# Install production dependencies
# Note: Ensure 'tesseract.js' and 'pdf-parse' are in your package.json!
RUN npm install --production

# Copy the rest of your backend source code
COPY backend/ ./

# Create uploads directories to ensure they exist with correct permissions
RUN mkdir -p uploads/pdfs uploads/covers uploads/audio

# Expose the port Render expects
EXPOSE 10000

# Start the server
CMD ["node", "src/server.js"]