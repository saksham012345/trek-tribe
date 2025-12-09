FROM node:20-alpine
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies with npm ci for reproducible builds
# Skip optional dependencies that might cause issues
RUN npm ci --only=production || npm install

# Install TypeScript globally for build
RUN npm install -g typescript

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Remove dev dependencies for smaller image
RUN npm prune --production

EXPOSE 4000
CMD ["node", "dist/index.js"]

