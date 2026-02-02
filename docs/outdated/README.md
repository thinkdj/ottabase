# Outdated Documentation

This directory contains documentation that is no longer current with the latest repository architecture.

## Files

### D1_LOCAL_DEVELOPMENT.md
**Status**: Outdated (Prisma-based approach)

This document referenced Prisma ORM for D1 database management. The repository now uses **Drizzle ORM** with **OttaORM** for database operations.

**Current equivalent documentation**:
- `packages/db/README.md` - Drizzle ORM integration
- `packages/ottaorm/README.md` - OttaORM fat model pattern
- `apps/ottabase-template-app-tanstack/ottabase/migrations/README.md` - Migration system

### D1_PRODUCTION_DEPLOYMENT.md
**Status**: Outdated (Prisma-based approach)

This document covered production deployment using Prisma. The repository has moved to **Drizzle ORM + OttaORM**.

**Current equivalent documentation**:
- `packages/db/README.md` - D1 database setup
- `packages/ottaorm/README.md` - Production ORM usage
- App-specific deployment guides in template apps

## Why These Are Outdated

The Ottabase project transitioned from Prisma to:
1. **Drizzle ORM** - For type-safe database queries
2. **OttaORM** - Fat model pattern with Drizzle support
3. **Automated migrations** - Via `/api/ottaorm/init` endpoint

These files remain archived for historical reference only.

## Archived Date
Moved to outdated: February 2025
