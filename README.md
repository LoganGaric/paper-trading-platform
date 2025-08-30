# 📊 Paper Trading Platform

A production-ready, full-stack TypeScript paper trading platform with real-time market simulation, comprehensive order management, and advanced observability.

[![CI/CD Pipeline](https://github.com/your-repo/paper-trading-platform/workflows/CI/CD%20Pipeline/badge.svg)](https://github.com/your-repo/paper-trading-platform/actions)
[![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)
[![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

## ✨ Features

### 🏦 Core Trading Features
- **Always-On Market Simulation** - 24/7 market access for demo testing with enhanced volatility
- **Real-time Price Movements** - Dynamic price simulation with 8% volatility overlay for active testing
- **Advanced Order Management** - Market, limit orders with complete lifecycle tracking
- **Portfolio Tracking** - Real-time positions, P&L, and account balances with live change calculations
- **Risk Management Engine** - Pre-trade risk checks, position limits, and kill switches
- **WebSocket Integration** - Live updates for orders, fills, positions, and market data
- **Matching Engine** - FIFO order matching with partial fills support

### 🔧 Production Features
- **Comprehensive Observability** - Structured logging, metrics, health checks, and monitoring
- **Security & Validation** - Input sanitization, rate limiting, XSS protection, and CSRF prevention
- **Performance Monitoring** - Prometheus metrics, Grafana dashboards, and request tracing
- **Error Handling** - Circuit breakers, graceful degradation, and detailed error tracking
- **Docker Containerization** - Multi-stage builds with development and production targets
- **CI/CD Pipeline** - Automated testing, building, and deployment with GitHub Actions

### 🎨 Developer Experience
- **TypeScript Monorepo** - Shared types and utilities across frontend and backend
- **Hot Reloading** - Fast development with instant feedback
- **Comprehensive Testing** - Unit, integration, and end-to-end test coverage
- **API Documentation** - OpenAPI/Swagger documentation with interactive testing
- **Database Management** - Automated migrations, seeding, and backup scripts

## 🏗️ Tech Stack

### Core Technologies
- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS
- **Backend**: Node.js + Express + TypeScript + Prisma ORM
- **Database**: PostgreSQL 16 with Redis for caching
- **Real-time**: WebSockets with connection management
- **Testing**: Jest + React Testing Library + Supertest

### Infrastructure & DevOps
- **Containerization**: Docker + Docker Compose with multi-stage builds
- **Monitoring**: Prometheus + Grafana + Winston logging
- **Security**: Helmet.js + Rate limiting + Input validation
- **CI/CD**: GitHub Actions with automated testing and deployment
- **Reverse Proxy**: Nginx with SSL termination and load balancing

## 🚀 Deployment Options

### 💻 Local Development (Recommended)

**For the best experience**, run the platform locally to access all advanced features:

- ✅ **Full market simulation** with WebSocket real-time updates
- ✅ **Advanced matching engine** with partial fills
- ✅ **No performance delays** - instant response times
- ✅ **Complete feature set** including background market simulation
- ✅ **Comprehensive monitoring** with Prometheus & Grafana

### ☁️ Cloud Demo (Vercel)

**Quick demo deployment** available on Vercel with some limitations:

- ✅ **Zero setup required** - just visit the URL
- ✅ **Basic trading functionality** with order placement and tracking
- ✅ **Real market data** with current August 2025 stock prices
- ⚠️ **Simplified simulation** - ±2% random price movements only
- ⚠️ **Cold start delays** - first load may take 10-30 seconds
- ⚠️ **No WebSocket support** - REST API only
- ⚠️ **Intermittent performance** due to serverless limitations

**Live Demo**: [Paper Trading Platform](https://paper-trading-platform-g5vrw7wnm-logan-garics-projects.vercel.app) *(May require 30s initial load)*

**API Endpoint**: [Backend API](https://paper-trading-platform-logangaric.vercel.app)

### Feature Comparison

| Feature | Local Development | Cloud (Vercel) |
|---------|------------------|----------------|
| **Market Simulation** | Historical data + WebSocket updates | ±2% random movements |
| **Performance** | Instant response | 10-30s cold starts |
| **Order Execution** | Advanced matching engine | Basic fill logic |
| **Real-time Updates** | WebSocket streaming | 2-second polling |
| **Setup Time** | 5 minutes (Docker required) | 0 minutes |
| **Reliability** | 100% uptime | Intermittent delays |

**Recommendation**: Use local development for serious testing, cloud demo for quick evaluation.

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** and npm 9+
- **Docker & Docker Compose** v2.0+
- **Git**
- **curl** (for health checks)

### Option 1: Docker Compose (Recommended)

```bash
# Clone repository
git clone <repository-url>
cd paper-trading-platform

# Start all services with Docker Compose
./scripts/deploy.sh -e development --seed

# Access the application
open http://localhost:3000
```

### Option 2: Local Development

```bash
# 1. Clone and install dependencies
git clone <repository-url>
cd paper-trading-platform
npm install

# 2. Start database services
docker-compose up postgres redis -d

# 3. Setup backend environment
cp .env.development .env
cd apps/backend

# 4. Database setup
npx prisma generate
npx prisma migrate deploy
npm run seed -- --skip-market-data

# 5. Start development servers
cd ../../
npm run dev
```

### 🌐 Access Points

After startup, you can access:

- **Trading Interface**: http://localhost:3000
- **API Server**: http://localhost:3001
- **API Health**: http://localhost:3001/health
- **API Metrics**: http://localhost:3001/metrics
- **Prometheus**: http://localhost:9090 *(Docker only)*
- **Grafana**: http://localhost:3003 *(Docker only, admin/admin)*

### 📊 Quick Test

```bash
# Check system health
curl http://localhost:3001/health

# Place a test order
curl -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -d '{"accountId":"demo-account","ticker":"AAPL","type":"MARKET","side":"BUY","quantity":10}'
```

## 🔧 Development

### Project Structure

```
paper-trading-platform/
├── apps/
│   ├── backend/              # Express API server
│   │   ├── src/
│   │   │   ├── routes/       # API endpoints
│   │   │   ├── services/     # Business logic (risk, matching, etc.)
│   │   │   ├── middleware/   # Auth, logging, validation
│   │   │   ├── websocket/    # WebSocket handlers
│   │   │   └── utils/        # Utilities (logger, circuit breaker)
│   │   ├── prisma/           # Database schema and migrations
│   │   └── Dockerfile        # Multi-stage container build
│   ├── frontend/             # React frontend
│   │   ├── src/
│   │   │   ├── components/   # Reusable UI components
│   │   │   ├── pages/        # Trading interface pages
│   │   │   └── hooks/        # Custom React hooks
│   │   └── Dockerfile        # Frontend container build
│   └── packages/
│       └── shared/           # Shared TypeScript types
├── infra/                    # Infrastructure configuration
│   ├── postgres/            # Database initialization
│   ├── prometheus/          # Metrics collection config
│   ├── grafana/             # Monitoring dashboards
│   └── nginx/               # Reverse proxy config
├── scripts/                  # Deployment and maintenance scripts
├── .github/workflows/        # CI/CD pipeline
└── docker-compose.yml       # Development environment
```

### 📝 Available Scripts

```bash
# Development
npm run dev                   # Start all services in dev mode
npm run build                # Build all packages for production
npm run test                 # Run comprehensive test suite
npm run lint                 # ESLint + Prettier formatting
npm run type-check           # TypeScript compilation check

# Backend specific
npm run dev -w apps/backend          # Start backend only
npm run test -w apps/backend         # Backend tests (47 tests)
npm run db:generate -w apps/backend  # Generate Prisma client
npm run db:migrate -w apps/backend   # Run database migrations
npm run seed -w apps/backend         # Seed database with demo data

# Frontend specific  
npm run dev -w apps/frontend         # Start frontend only
npm run test -w apps/frontend        # Frontend tests
npm run build -w apps/frontend       # Build production frontend

# Infrastructure
./scripts/deploy.sh -e development   # Deploy with Docker Compose
./scripts/monitor.sh status          # Check system status
./scripts/monitor.sh logs            # View service logs
./scripts/monitor.sh health          # Run health checks
./scripts/monitor.sh backup          # Backup database
```

### 🧪 Testing Strategy

The platform includes comprehensive testing at multiple levels:

- **Unit Tests** (Jest): Individual functions and components
- **Integration Tests** (Supertest): API endpoints with real database
- **Component Tests** (React Testing Library): Frontend components
- **End-to-End Tests**: Complete user workflows

```bash
# Run all tests (47/47 passing)
npm test

# Run specific test suites
npm test -- --testPathPattern=riskEngine
npm test -- --testPathPattern=orders.integration
npm test -- --testNamePattern="should calculate P&L correctly"

# Test with coverage
npm run test:coverage
```

## 🏭 Production Deployment

### Environment Configuration

The platform supports multiple environments with specific configurations:

```bash
# Development (default)
./scripts/deploy.sh -e development --seed

# Staging environment
./scripts/deploy.sh -e staging --no-seed

# Production deployment
./scripts/deploy.sh -e production --no-build --skip-health-check
```

### Docker Images

Multi-stage Docker builds optimize for both development speed and production size:

```bash
# Build development images
docker build -f apps/backend/Dockerfile --target development .

# Build production images
docker build -f apps/backend/Dockerfile --target production .

# Push to registry
docker tag paper-trading-backend ghcr.io/your-org/paper-trading-backend:latest
docker push ghcr.io/your-org/paper-trading-backend:latest
```

### CI/CD Pipeline

GitHub Actions pipeline includes:

- ✅ **Code Quality**: ESLint, TypeScript checking, Prettier
- ✅ **Security**: npm audit, dependency scanning
- ✅ **Testing**: Unit, integration, and E2E tests  
- ✅ **Building**: Docker images with caching
- ✅ **Deployment**: Automated staging and production deploys

## 📊 Monitoring & Observability

### Health Checks

```bash
# Basic health check
curl http://localhost:3001/health

# Detailed health check
curl http://localhost:3001/health/deep | jq

# Readiness probe (Kubernetes)
curl http://localhost:3001/health/ready

# Liveness probe
curl http://localhost:3001/health/live
```

### Metrics & Monitoring

- **Prometheus Metrics**: `/metrics` endpoint with business and system metrics
- **Structured Logging**: JSON logs with request tracing and contextual information
- **Grafana Dashboards**: Pre-configured dashboards for trading metrics
- **Alert Management**: Configurable alerts for system and business events

```bash
# View real-time metrics
curl http://localhost:3001/metrics

# Check Prometheus targets
open http://localhost:9090/targets

# Open Grafana dashboards
open http://localhost:3003 # admin/admin
```

### Performance Monitoring

The platform tracks comprehensive metrics:

- **HTTP Request Metrics**: Duration, status codes, throughput
- **Business Metrics**: Orders placed, fills executed, risk checks
- **System Metrics**: Memory usage, CPU utilization, database connections
- **Error Tracking**: Categorized by type with stack traces and context

## 📚 API Documentation

### Core Endpoints

```bash
# Health & System
GET  /health                 # System health status
GET  /health/ready          # Readiness probe
GET  /health/live           # Liveness probe  
GET  /metrics               # Prometheus metrics

# Trading Operations
POST /api/orders            # Place new order
GET  /api/orders            # Order history
POST /api/orders/:id/cancel # Cancel order
GET  /api/positions         # Portfolio positions
GET  /api/fills            # Execution history
GET  /api/accounts/:id     # Account information

# Risk Management
GET  /api/risk/limits      # Current risk limits
PUT  /api/risk/limits      # Update risk limits

# Market Simulation
GET  /api/simulator/status # Simulation status
POST /api/simulator/start  # Start market simulation
POST /api/simulator/stop   # Stop simulation
```

### Example API Calls

```bash
# Place a market order
curl -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "demo-account",
    "ticker": "AAPL", 
    "type": "MARKET",
    "side": "BUY",
    "quantity": 100
  }'

# Place a limit order
curl -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "demo-account",
    "ticker": "TSLA",
    "type": "LIMIT", 
    "side": "SELL",
    "quantity": 50,
    "price": 250.00
  }'

# Get account positions
curl "http://localhost:3001/api/positions?accountId=demo-account"

# Cancel an order
curl -X POST http://localhost:3001/api/orders/ORDER_ID/cancel
```

## ⚙️ Configuration

### Environment Variables

```bash
# Database Configuration
DATABASE_URL=postgresql://user:pass@localhost:5432/paper_trading
REDIS_URL=redis://localhost:6379

# Server Configuration  
NODE_ENV=development
PORT=3001
LOG_LEVEL=info

# Security
JWT_SECRET=your-secret-key
INTERNAL_API_TOKEN=internal-service-token
ALLOWED_ORIGINS=http://localhost:3000

# Feature Flags
ENABLE_MARKET_SIMULATION=true
ENABLE_RATE_LIMITING=true
ENABLE_METRICS=true
```

### Market Simulation Settings

- **Always-On Operation**: 24/7 market simulation for continuous demo testing
- **Enhanced Volatility**: 8% random price movements overlay for dynamic testing experience
- **Update Frequency**: Every 2 seconds for real-time price updates
- **Base Data**: CSV market data with additional volatility enhancement
- **Instruments**: AAPL, TSLA, GOOGL, MSFT, NVDA, SPY
- **Price Calculations**: Live change tracking with proper percentage and dollar calculations

### Risk Management

- **Max Quantity Per Symbol**: 10,000 shares
- **Max Notional Value**: $50,000 per order
- **Max Daily Orders**: 100 orders per account
- **Global Kill Switch**: Emergency trading halt
- **Buying Power Checks**: Prevent over-leverage


---

**Built with ❤️ for traders and developers who appreciate production-quality code.**