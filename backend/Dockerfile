# ---------------------------
# Stage 1: Build frontend
# ---------------------------
FROM node:20-bullseye AS frontend-build

# Set working directory
WORKDIR /app/storyteller-frontend

# Copy frontend package.json and install dependencies
COPY storyteller-frontend/package*.json ./
RUN npm install

# Copy all frontend source files and build
COPY storyteller-frontend/ ./
RUN npm run build

# ---------------------------
# Stage 2: Build backend
# ---------------------------
FROM node:20-bullseye

# Install system dependencies
RUN apt-get update && apt-get install -y poppler-utils

# Set working directory for backend
WORKDIR /app/backend

# Copy backend package.json and install dependencies
COPY backend/package*.json ./
RUN npm install

# Copy backend source code and uploads
COPY backend/src ./src
COPY backend/uploads ./uploads

# Copy frontend build into backend public folder
COPY --from=frontend-build /app/storyteller-frontend/build ./public

# Expose backend port
EXPOSE 10000

# Start backend server
CMD ["node", "src/server.js"]
