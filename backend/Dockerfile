# ---------------------------
# Stage 1: Build frontend
# ---------------------------
FROM node:20-bullseye AS frontend-build
WORKDIR /app/storyteller-frontend

COPY storyteller-frontend/package*.json ./
RUN npm install
COPY storyteller-frontend/ ./
RUN npm run build

# ---------------------------
# Stage 2: Setup backend
# ---------------------------
FROM node:20-bullseye

RUN apt-get update && apt-get install -y poppler-utils

WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm install

COPY backend/src ./src
COPY backend/uploads ./uploads

# Copy frontend build into backend public folder
COPY --from=frontend-build /app/storyteller-frontend/build ./public

EXPOSE 10000
CMD ["node", "src/server.js"]
