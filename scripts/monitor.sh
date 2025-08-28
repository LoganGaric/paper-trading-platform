#!/bin/bash

# Paper Trading Platform Monitoring Script
# This script provides monitoring and maintenance utilities

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="docker-compose.yml"

# Functions
print_usage() {
    cat << EOF
Usage: $0 [COMMAND] [OPTIONS]

Monitor and maintain Paper Trading Platform

COMMANDS:
    status          Show service status
    logs            Show service logs
    health          Check service health
    metrics         Show system metrics
    backup          Backup database
    restore         Restore database from backup
    cleanup         Clean up old containers and images
    scale           Scale services
    restart         Restart services

OPTIONS:
    -f, --compose-file FILE  Docker Compose file to use
    -s, --service SERVICE    Target specific service
    -n, --lines N           Number of log lines to show (default: 100)
    -t, --timeout N         Health check timeout in seconds (default: 30)
    -h, --help              Show this help message

EXAMPLES:
    $0 status
    $0 logs -s backend -n 50
    $0 health -t 60
    $0 backup
    $0 scale backend 3

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

check_compose_cmd() {
    if command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    elif docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    else
        error "Docker Compose is not available"
        exit 1
    fi
}

show_status() {
    log "Showing service status..."
    cd "$PROJECT_ROOT"
    
    echo "===================================="
    echo "    SERVICE STATUS"
    echo "===================================="
    $COMPOSE_CMD -f "$COMPOSE_FILE" ps
    
    echo ""
    echo "===================================="
    echo "    DOCKER SYSTEM INFO"
    echo "===================================="
    docker system df
    
    echo ""
    echo "===================================="
    echo "    CONTAINER RESOURCE USAGE"
    echo "===================================="
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
}

show_logs() {
    local service="${1:-}"
    local lines="${2:-100}"
    
    cd "$PROJECT_ROOT"
    
    if [[ -n "$service" ]]; then
        log "Showing logs for service: $service"
        $COMPOSE_CMD -f "$COMPOSE_FILE" logs --tail="$lines" -f "$service"
    else
        log "Showing logs for all services"
        $COMPOSE_CMD -f "$COMPOSE_FILE" logs --tail="$lines" -f
    fi
}

check_health() {
    local timeout="${1:-30}"
    
    log "Performing health checks..."
    cd "$PROJECT_ROOT"
    
    # Get service endpoints
    local backend_port=$(docker-compose -f "$COMPOSE_FILE" port backend 3001 2>/dev/null | cut -d: -f2 || echo "3001")
    local frontend_port=$(docker-compose -f "$COMPOSE_FILE" port frontend 3000 2>/dev/null | cut -d: -f2 || echo "3000")
    
    local backend_url="http://localhost:${backend_port}"
    local frontend_url="http://localhost:${frontend_port}"
    
    echo "===================================="
    echo "    HEALTH CHECK RESULTS"
    echo "===================================="
    
    # Check backend health
    printf "Backend (${backend_url}/health): "
    if timeout "$timeout" bash -c "until curl -f -s ${backend_url}/health > /dev/null 2>&1; do sleep 1; done"; then
        echo -e "${GREEN}HEALTHY${NC}"
        
        # Get detailed health info
        local health_info=$(curl -s "${backend_url}/health" | jq -r '.status // "unknown"' 2>/dev/null || echo "unknown")
        local db_status=$(curl -s "${backend_url}/health" | jq -r '.services.database.status // "unknown"' 2>/dev/null || echo "unknown")
        echo "  Status: $health_info"
        echo "  Database: $db_status"
    else
        echo -e "${RED}UNHEALTHY${NC}"
    fi
    
    # Check frontend health
    printf "Frontend (${frontend_url}): "
    if timeout "$timeout" bash -c "until curl -f -s ${frontend_url} > /dev/null 2>&1; do sleep 1; done"; then
        echo -e "${GREEN}HEALTHY${NC}"
    else
        echo -e "${RED}UNHEALTHY${NC}"
    fi
    
    # Check database health
    printf "Database: "
    if $COMPOSE_CMD -f "$COMPOSE_FILE" exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
        echo -e "${GREEN}HEALTHY${NC}"
        
        # Get database info
        local db_size=$(docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U postgres -d paper_trading -t -c "SELECT pg_size_pretty(pg_database_size('paper_trading'));" 2>/dev/null | xargs || echo "unknown")
        echo "  Database size: $db_size"
    else
        echo -e "${RED}UNHEALTHY${NC}"
    fi
    
    # Check Redis health
    printf "Redis: "
    if $COMPOSE_CMD -f "$COMPOSE_FILE" exec -T redis redis-cli ping | grep -q PONG; then
        echo -e "${GREEN}HEALTHY${NC}"
    else
        echo -e "${RED}UNHEALTHY${NC}"
    fi
}

show_metrics() {
    log "Collecting system metrics..."
    cd "$PROJECT_ROOT"
    
    echo "===================================="
    echo "    SYSTEM METRICS"
    echo "===================================="
    
    # Container metrics
    echo "Container Resource Usage:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
    
    echo ""
    echo "Docker System Usage:"
    docker system df
    
    echo ""
    echo "Database Metrics:"
    local db_connections=$($COMPOSE_CMD -f "$COMPOSE_FILE" exec -T postgres psql -U postgres -d paper_trading -t -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null | xargs || echo "unknown")
    local db_size=$($COMPOSE_CMD -f "$COMPOSE_FILE" exec -T postgres psql -U postgres -d paper_trading -t -c "SELECT pg_size_pretty(pg_database_size('paper_trading'));" 2>/dev/null | xargs || echo "unknown")
    echo "  Active connections: $db_connections"
    echo "  Database size: $db_size"
    
    echo ""
    echo "Application Metrics (if metrics endpoint is available):"
    local backend_port=$(docker-compose -f "$COMPOSE_FILE" port backend 3001 2>/dev/null | cut -d: -f2 || echo "3001")
    if curl -f -s "http://localhost:${backend_port}/metrics" > /dev/null 2>&1; then
        echo "  Metrics endpoint: http://localhost:${backend_port}/metrics"
        echo "  Available metrics:"
        curl -s "http://localhost:${backend_port}/metrics" | grep "^# HELP" | head -5 | sed 's/^# HELP /  - /'
    else
        echo "  Metrics endpoint not available"
    fi
}

backup_database() {
    local backup_name="paper_trading_backup_$(date +%Y%m%d_%H%M%S).sql"
    local backup_dir="${PROJECT_ROOT}/backups"
    
    log "Creating database backup..."
    
    # Create backup directory
    mkdir -p "$backup_dir"
    
    cd "$PROJECT_ROOT"
    
    # Create backup
    $COMPOSE_CMD -f "$COMPOSE_FILE" exec -T postgres pg_dump -U postgres -d paper_trading > "${backup_dir}/${backup_name}"
    
    # Compress backup
    gzip "${backup_dir}/${backup_name}"
    
    success "Database backup created: ${backup_dir}/${backup_name}.gz"
    
    # Clean up old backups (keep last 7 days)
    find "$backup_dir" -name "*.gz" -mtime +7 -delete 2>/dev/null || true
    
    log "Backup directory cleaned (kept last 7 days)"
}

restore_database() {
    local backup_file="$1"
    
    if [[ -z "$backup_file" ]]; then
        error "Backup file not specified"
        echo "Usage: $0 restore <backup_file>"
        exit 1
    fi
    
    if [[ ! -f "$backup_file" ]]; then
        error "Backup file not found: $backup_file"
        exit 1
    fi
    
    warn "This will replace the current database. Are you sure? (y/N)"
    read -r confirmation
    if [[ "$confirmation" != "y" && "$confirmation" != "Y" ]]; then
        log "Restore cancelled"
        exit 0
    fi
    
    log "Restoring database from: $backup_file"
    
    cd "$PROJECT_ROOT"
    
    # Extract if compressed
    if [[ "$backup_file" == *.gz ]]; then
        zcat "$backup_file" | $COMPOSE_CMD -f "$COMPOSE_FILE" exec -T postgres psql -U postgres -d paper_trading
    else
        $COMPOSE_CMD -f "$COMPOSE_FILE" exec -T postgres psql -U postgres -d paper_trading < "$backup_file"
    fi
    
    success "Database restored successfully"
}

cleanup_system() {
    log "Cleaning up Docker system..."
    
    # Remove stopped containers
    docker container prune -f
    
    # Remove unused images
    docker image prune -f
    
    # Remove unused volumes (be careful with this)
    warn "Remove unused volumes? This cannot be undone. (y/N)"
    read -r confirmation
    if [[ "$confirmation" == "y" || "$confirmation" == "Y" ]]; then
        docker volume prune -f
    fi
    
    # Remove unused networks
    docker network prune -f
    
    success "Docker system cleanup completed"
    
    # Show disk usage after cleanup
    echo ""
    log "Disk usage after cleanup:"
    docker system df
}

scale_service() {
    local service="$1"
    local replicas="$2"
    
    if [[ -z "$service" || -z "$replicas" ]]; then
        error "Service and replica count must be specified"
        echo "Usage: $0 scale <service> <replicas>"
        exit 1
    fi
    
    log "Scaling $service to $replicas replicas..."
    
    cd "$PROJECT_ROOT"
    $COMPOSE_CMD -f "$COMPOSE_FILE" up -d --scale "$service=$replicas"
    
    success "Service $service scaled to $replicas replicas"
}

restart_services() {
    local service="${1:-}"
    
    cd "$PROJECT_ROOT"
    
    if [[ -n "$service" ]]; then
        log "Restarting service: $service"
        $COMPOSE_CMD -f "$COMPOSE_FILE" restart "$service"
    else
        log "Restarting all services..."
        $COMPOSE_CMD -f "$COMPOSE_FILE" restart
    fi
    
    success "Services restarted"
}

# Parse command line arguments
COMMAND=""
SERVICE=""
LINES="100"
TIMEOUT="30"

while [[ $# -gt 0 ]]; do
    case $1 in
        status|logs|health|metrics|backup|restore|cleanup|scale|restart)
            COMMAND="$1"
            shift
            ;;
        -f|--compose-file)
            COMPOSE_FILE="$2"
            shift 2
            ;;
        -s|--service)
            SERVICE="$2"
            shift 2
            ;;
        -n|--lines)
            LINES="$2"
            shift 2
            ;;
        -t|--timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        -h|--help)
            print_usage
            exit 0
            ;;
        *)
            if [[ -z "$COMMAND" ]]; then
                COMMAND="$1"
                shift
            else
                # Additional arguments for commands
                break
            fi
            ;;
    esac
done

# Check requirements
check_compose_cmd

# Execute command
case "$COMMAND" in
    status)
        show_status
        ;;
    logs)
        show_logs "$SERVICE" "$LINES"
        ;;
    health)
        check_health "$TIMEOUT"
        ;;
    metrics)
        show_metrics
        ;;
    backup)
        backup_database
        ;;
    restore)
        restore_database "$1"
        ;;
    cleanup)
        cleanup_system
        ;;
    scale)
        scale_service "$1" "$2"
        ;;
    restart)
        restart_services "$SERVICE"
        ;;
    "")
        error "No command specified"
        print_usage
        exit 1
        ;;
    *)
        error "Unknown command: $COMMAND"
        print_usage
        exit 1
        ;;
esac