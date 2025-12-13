FROM node:20-alpine
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies - use install instead of ci for flexibility
RUN npm install --production

# Install TypeScript globally for build
RUN npm install -g typescript

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Clean up build dependencies
RUN npm prune --production

EXPOSE 4000
CMD ["node", "dist/index.js"]

