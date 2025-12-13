FROM node:20-alpine
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev) for build
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Prune to production dependencies only for runtime image
RUN npm prune --production

EXPOSE 4000
CMD ["node", "dist/index.js"]

