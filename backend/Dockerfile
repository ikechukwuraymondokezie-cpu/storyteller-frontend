# ---------------------------
# Stage 1: Build frontend
# ---------------------------
FROM node:20-bullseye AS frontend-build

# Set working directory for frontend
WORKDIR /app/storyteller-frontend

# Copy frontend package.json and package-lock.json
COPY storyteller-frontend/package*.json ./

# Install frontend dependencies
RUN npm install

# Copy frontend source code
COPY storyteller-frontend/ ./

# Build frontend
RUN npm run build

# ---------------------------
# Stage 2: Setup backend
# ---------------------------
FROM node:20-bullseye

# Install system dependencies (required for pdf-poppler)
RUN apt-get update && apt-get install -y poppler-utils

# Set working directory for backend
WORKDIR /app/backend

# Copy backend package.json and package-lock.json
COPY backend/package*.json ./

# Install backend dependencies
RUN npm install

# Copy backend source code
COPY backend/src ./src
COPY backend/uploads ./uploads

# Copy built frontend from previous stage
COPY --from=frontend-build /app/storyteller-frontend/build ../../storyteller-frontend/build

# Expose backend port
EXPOSE 10000

# Start server
CMD ["node", "src/server.js"]
