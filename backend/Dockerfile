# Base image
FROM node:20-bullseye

# Install system dependencies (required for pdf-poppler)
RUN apt-get update && apt-get install -y poppler-utils

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy app source
COPY . .

# Expose backend port
EXPOSE 5000

# Start server
CMD ["node", "src/server.js"]
