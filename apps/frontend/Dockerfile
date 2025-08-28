# Multi-stage build for React frontend
FROM node:18-alpine as base

# Install dumb-init
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
COPY apps/frontend/package*.json ./apps/frontend/
COPY packages/shared/package*.json ./packages/shared/

# Install all dependencies
RUN npm ci

# Copy source code
COPY apps/frontend/ ./apps/frontend/
COPY packages/shared/ ./packages/shared/

# Build shared package
RUN npm run build -w @paper-trading/shared

# Change ownership to nodejs user
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 3000

# Start in development mode
CMD ["dumb-init", "npm", "run", "dev", "-w", "@paper-trading/frontend"]

# Build stage
FROM base as build

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./
COPY apps/frontend/package*.json ./apps/frontend/
COPY packages/shared/package*.json ./packages/shared/

# Install all dependencies
RUN npm ci

# Copy source code
COPY apps/frontend/ ./apps/frontend/
COPY packages/shared/ ./packages/shared/

# Build the applications
RUN npm run build -w @paper-trading/shared
RUN npm run build -w @paper-trading/frontend

# Production stage with nginx
FROM nginx:alpine as production

# Copy custom nginx config
COPY apps/frontend/nginx.conf /etc/nginx/nginx.conf

# Copy built application
COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html

# Create nginx user
RUN addgroup -g 1001 -S nginx_app && \
    adduser -S nginx_app -u 1001

# Set proper permissions
RUN chown -R nginx_app:nginx_app /usr/share/nginx/html && \
    chown -R nginx_app:nginx_app /var/cache/nginx && \
    chown -R nginx_app:nginx_app /var/log/nginx && \
    chown -R nginx_app:nginx_app /etc/nginx/conf.d

# Create nginx pid directory
RUN mkdir -p /var/run/nginx && \
    chown -R nginx_app:nginx_app /var/run/nginx

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Switch to non-root user
USER nginx_app

# Expose port
EXPOSE 3000

# Start nginx
CMD ["nginx", "-g", "daemon off;"]