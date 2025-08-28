#!/bin/bash

# Paper Trading Platform Deployment Script
# This script handles deployment to different environments

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENVIRONMENTS=("development" "staging" "production")

# Default values
ENVIRONMENT="development"
BUILD_IMAGES=true
RUN_MIGRATIONS=true
SEED_DATABASE=false
SKIP_HEALTH_CHECK=false
COMPOSE_FILE="docker-compose.yml"

# Functions
print_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Deploy Paper Trading Platform to specified environment

OPTIONS:
    -e, --environment ENV    Target environment (development|staging|production)
    -f, --compose-file FILE  Docker Compose file to use
    --no-build              Skip building Docker images
    --no-migrations         Skip running database migrations
    --seed                  Seed database with sample data
    --skip-health-check     Skip health check after deployment
    -h, --help              Show this help message

EXAMPLES:
    $0 -e development --seed
    $0 -e production --no-build
    $0 -e staging -f docker-compose.staging.yml

EOF
}

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

check_requirements() {
    log "Checking requirements..."
    
    # Check if Docker is installed and running
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        error "Docker daemon is not running"
        exit 1
    fi
    
    # Check if Docker Compose is available
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        error "Docker Compose is not available"
        exit 1
    fi
    
    # Check if environment file exists
    local env_file="${PROJECT_ROOT}/.env.${ENVIRONMENT}"
    if [[ ! -f "$env_file" ]]; then
        error "Environment file not found: $env_file"
        exit 1
    fi
    
    success "Requirements check passed"
}

validate_environment() {
    if [[ ! " ${ENVIRONMENTS[@]} " =~ " ${ENVIRONMENT} " ]]; then
        error "Invalid environment: ${ENVIRONMENT}"
        error "Valid environments: ${ENVIRONMENTS[*]}"
        exit 1
    fi
    
    log "Deploying to environment: ${ENVIRONMENT}"
}

setup_environment() {
    log "Setting up environment variables..."
    
    # Load environment-specific variables
    local env_file="${PROJECT_ROOT}/.env.${ENVIRONMENT}"
    if [[ -f "$env_file" ]]; then
        set -a  # Export all variables
        source "$env_file"
        set +a
        log "Loaded environment variables from $env_file"
    fi
    
    # Set Docker Compose project name
    export COMPOSE_PROJECT_NAME="paper-trading-${ENVIRONMENT}"
    
    # Set build target based on environment
    if [[ "$ENVIRONMENT" == "production" ]]; then
        export BUILD_TARGET="production"
        export NODE_ENV="production"
    else
        export BUILD_TARGET="development"
        export NODE_ENV="development"
    fi
}

build_images() {
    if [[ "$BUILD_IMAGES" == "true" ]]; then
        log "Building Docker images..."
        
        cd "$PROJECT_ROOT"
        
        # Use docker compose or docker-compose based on availability
        if command -v docker-compose &> /dev/null; then
            COMPOSE_CMD="docker-compose"
        else
            COMPOSE_CMD="docker compose"
        fi
        
        $COMPOSE_CMD -f "$COMPOSE_FILE" build --parallel
        
        success "Docker images built successfully"
    else
        log "Skipping image build"
    fi
}

run_database_migrations() {
    if [[ "$RUN_MIGRATIONS" == "true" ]]; then
        log "Running database migrations..."
        
        cd "$PROJECT_ROOT"
        
        # Start only the database service
        $COMPOSE_CMD -f "$COMPOSE_FILE" up -d postgres
        
        # Wait for database to be ready
        log "Waiting for database to be ready..."
        sleep 10
        
        # Run migrations
        $COMPOSE_CMD -f "$COMPOSE_FILE" exec -T postgres pg_isready -U postgres || {
            error "Database is not ready"
            exit 1
        }
        
        # Run Prisma migrations
        $COMPOSE_CMD -f "$COMPOSE_FILE" run --rm backend sh -c "cd apps/backend && npx prisma migrate deploy"
        
        success "Database migrations completed"
    else
        log "Skipping database migrations"
    fi
}

seed_database() {
    if [[ "$SEED_DATABASE" == "true" ]]; then
        log "Seeding database..."
        
        local seed_args=""
        if [[ "$ENVIRONMENT" == "production" ]]; then
            seed_args="--production --skip-market-data"
            warn "Seeding production database with minimal data"
        elif [[ "$ENVIRONMENT" == "test" ]]; then
            seed_args="--test --skip-market-data"
        else
            seed_args="--skip-market-data"
        fi
        
        $COMPOSE_CMD -f "$COMPOSE_FILE" run --rm backend sh -c "cd apps/backend && npm run seed -- $seed_args"
        
        success "Database seeded successfully"
    fi
}

start_services() {
    log "Starting services..."
    
    cd "$PROJECT_ROOT"
    
    # Start all services
    if [[ "$ENVIRONMENT" == "production" ]]; then
        # In production, also start nginx and monitoring services
        $COMPOSE_CMD -f "$COMPOSE_FILE" --profile production up -d
    else
        $COMPOSE_CMD -f "$COMPOSE_FILE" up -d
    fi
    
    success "Services started"
}

health_check() {
    if [[ "$SKIP_HEALTH_CHECK" == "true" ]]; then
        log "Skipping health check"
        return 0
    fi
    
    log "Performing health checks..."
    
    local backend_url="http://localhost:${BACKEND_PORT:-3001}"
    local frontend_url="http://localhost:${FRONTEND_PORT:-3000}"
    local max_attempts=30
    local attempt=1
    
    # Check backend health
    log "Checking backend health at $backend_url/health"
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f -s "$backend_url/health" > /dev/null 2>&1; then
            success "Backend health check passed"
            break
        fi
        
        if [[ $attempt -eq $max_attempts ]]; then
            error "Backend health check failed after $max_attempts attempts"
            return 1
        fi
        
        log "Backend not ready, attempt $attempt/$max_attempts..."
        sleep 5
        ((attempt++))
    done
    
    # Check frontend health (if not production)
    if [[ "$ENVIRONMENT" != "production" ]]; then
        log "Checking frontend health at $frontend_url"
        attempt=1
        while [[ $attempt -le $max_attempts ]]; do
            if curl -f -s "$frontend_url" > /dev/null 2>&1; then
                success "Frontend health check passed"
                break
            fi
            
            if [[ $attempt -eq $max_attempts ]]; then
                error "Frontend health check failed after $max_attempts attempts"
                return 1
            fi
            
            log "Frontend not ready, attempt $attempt/$max_attempts..."
            sleep 5
            ((attempt++))
        done
    fi
    
    success "All health checks passed"
}

show_deployment_info() {
    log "Deployment completed successfully!"
    echo ""
    echo "===================================="
    echo "    DEPLOYMENT INFORMATION"
    echo "===================================="
    echo "Environment: $ENVIRONMENT"
    echo "Backend URL: http://localhost:${BACKEND_PORT:-3001}"
    if [[ "$ENVIRONMENT" != "production" ]]; then
        echo "Frontend URL: http://localhost:${FRONTEND_PORT:-3000}"
    fi
    if [[ "$ENVIRONMENT" == "development" ]]; then
        echo "Prometheus: http://localhost:${PROMETHEUS_PORT:-9090}"
        echo "Grafana: http://localhost:${GRAFANA_PORT:-3003} (admin/admin)"
    fi
    echo ""
    echo "Useful commands:"
    echo "  View logs: docker-compose -f $COMPOSE_FILE logs -f"
    echo "  Stop services: docker-compose -f $COMPOSE_FILE down"
    echo "  Check status: docker-compose -f $COMPOSE_FILE ps"
    echo "===================================="
}

cleanup() {
    if [[ $? -ne 0 ]]; then
        error "Deployment failed!"
        log "Cleaning up..."
        cd "$PROJECT_ROOT"
        $COMPOSE_CMD -f "$COMPOSE_FILE" down || true
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -f|--compose-file)
            COMPOSE_FILE="$2"
            shift 2
            ;;
        --no-build)
            BUILD_IMAGES=false
            shift
            ;;
        --no-migrations)
            RUN_MIGRATIONS=false
            shift
            ;;
        --seed)
            SEED_DATABASE=true
            shift
            ;;
        --skip-health-check)
            SKIP_HEALTH_CHECK=true
            shift
            ;;
        -h|--help)
            print_usage
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            print_usage
            exit 1
            ;;
    esac
done

# Main execution
main() {
    log "Starting Paper Trading Platform deployment..."
    
    trap cleanup EXIT
    
    validate_environment
    check_requirements
    setup_environment
    build_images
    run_database_migrations
    seed_database
    start_services
    health_check
    show_deployment_info
    
    trap - EXIT
}

# Run main function
main "$@"