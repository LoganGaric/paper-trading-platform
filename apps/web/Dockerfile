FROM node:18-alpine

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY tsconfig.json ./

# Copy workspace package files
COPY apps/web/package*.json ./apps/web/
COPY packages/shared/package*.json ./packages/shared/

# Install dependencies
RUN npm ci

# Copy source code
COPY apps/web/ ./apps/web/
COPY packages/shared/ ./packages/shared/

# Build the application
RUN npm run build -w @paper-trading/shared
RUN npm run build -w @paper-trading/web

EXPOSE 3000

CMD ["npm", "run", "preview", "-w", "@paper-trading/web"]