# Multi-stage build for Node.js backend
FROM node:18-alpine as base

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Development stage
FROM base as development

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./
COPY apps/backend/package*.json ./apps/backend/
COPY packages/shared/package*.json ./packages/shared/

# Install all dependencies
RUN npm ci

# Copy source code
COPY apps/backend/ ./apps/backend/
COPY packages/shared/ ./packages/shared/

# Generate Prisma client
RUN cd apps/backend && npx prisma generate

# Change ownership to nodejs user
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 3001

# Start in development mode
CMD ["dumb-init", "npm", "run", "dev", "-w", "@paper-trading/backend"]

# Build stage
FROM base as build

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./
COPY apps/backend/package*.json ./apps/backend/
COPY packages/shared/package*.json ./packages/shared/

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY apps/backend/ ./apps/backend/
COPY packages/shared/ ./packages/shared/

# Generate Prisma client
RUN cd apps/backend && npx prisma generate

# Build the applications
RUN npm run build -w @paper-trading/shared
RUN npm run build -w @paper-trading/backend

# Production stage
FROM base as production

# Copy package files
COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/
COPY packages/shared/package*.json ./packages/shared/

# Install only production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built applications and necessary files
COPY --from=build --chown=nodejs:nodejs /app/apps/backend/dist ./apps/backend/dist
COPY --from=build --chown=nodejs:nodejs /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=build --chown=nodejs:nodejs /app/packages/shared/dist ./packages/shared/dist

# Generate Prisma client for production
RUN cd apps/backend && npx prisma generate

# Create logs directory
RUN mkdir -p apps/backend/logs && \
    chown -R nodejs:nodejs /app

# Switch to nodejs user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health/live', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Expose port
EXPOSE 3001

# Start the application
CMD ["dumb-init", "npm", "run", "start", "-w", "@paper-trading/backend"]