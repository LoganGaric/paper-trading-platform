-- PostgreSQL initialization script for paper trading platform
-- This script runs when the database container starts for the first time

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create additional databases for testing
CREATE DATABASE paper_trading_test;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE paper_trading TO postgres;
GRANT ALL PRIVILEGES ON DATABASE paper_trading_test TO postgres;

-- Create monitoring user for metrics collection
CREATE USER monitoring_user WITH PASSWORD 'monitoring_password';
GRANT CONNECT ON DATABASE paper_trading TO monitoring_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO monitoring_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO monitoring_user;

-- Performance tuning settings (for development)
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_min_duration_statement = '1000ms';
ALTER SYSTEM SET track_activity_query_size = '2048';

-- Log configuration for debugging
ALTER SYSTEM SET logging_collector = 'on';
ALTER SYSTEM SET log_directory = 'log';
ALTER SYSTEM SET log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log';
ALTER SYSTEM SET log_rotation_age = '1d';
ALTER SYSTEM SET log_rotation_size = '100MB';

-- Reload configuration
SELECT pg_reload_conf();