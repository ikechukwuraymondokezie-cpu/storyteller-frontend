# ---------------------------
# Stage 1: Build frontend
# ---------------------------
FROM node:20-bullseye AS frontend-build

WORKDIR /app/storyteller-frontend

# Copy frontend package.json and install
COPY storyteller-frontend/package*.json ./
RUN npm install

# Copy frontend source and build
COPY storyteller-frontend/ ./
RUN npm run build

# ---------------------------
# Stage 2: Setup backend
# ---------------------------
FROM node:20-bullseye

# Install system dependencies
RUN apt-get update && apt-get install -y poppler-utils

WORKDIR /app/backend

# Copy backend package.json and install
COPY backend/package*.json ./
RUN npm install

# Copy backend source and uploads
COPY backend/src ./src
COPY backend/uploads ./uploads

# Copy built frontend into backend public folder (or wherever you serve it)
COPY --from=frontend-build /app/storyteller-frontend/build ./public

# Expose port
EXPOSE 10000

# Start server
CMD ["node", "src/server.js"]

