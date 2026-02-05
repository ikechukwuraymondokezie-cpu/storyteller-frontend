# Use a slim version of Node to keep the image lightweight
FROM node:20-bullseye-slim

# Install system dependencies (needed for PDF processing)
# We add 'ca-certificates' to ensure secure connections to Cloudinary
RUN apt-get update && apt-get install -y \
    poppler-utils \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy backend dependency files
# Stage 2 will now install 'cloudinary' from your package.json
COPY backend/package*.json ./

# Install only production dependencies
RUN npm install --production

# Copy the rest of your backend source code
COPY backend/ ./

# Expose the port Render expects
EXPOSE 10000

# Start the server
# Adjust the path if your entry point is different (e.g., node server.js)
CMD ["node", "src/server.js"]