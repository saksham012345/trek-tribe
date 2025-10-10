FROM node:20-alpine
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
# Use npm install since this is part of a workspace setup
RUN npm install

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

