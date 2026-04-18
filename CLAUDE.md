# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **multitenant e-commerce SaaS platform** similar to Shopify, built with Node.js, Express, and MongoDB. Each tenant (store) has its own isolated database connection, providing strong data isolation while sharing the same application infrastructure.

## Core Architecture

### Multitenancy Model

The platform uses **database-per-tenant** architecture:

1. **Admin Database**: Central database (`Matjar`) stores tenant metadata (domain, DB URI, subscription info)
2. **Tenant Databases**: Each tenant has a separate MongoDB database for their store data
3. **Connection Management**: LRU cache (max 5000 connections) manages tenant database connections
4. **Request Flow**: Domain-based tenant resolution → JWT authentication → tenant DB connection injection

### Key Components

- **Connection Manager** (`utils/connectionManager.js`):

  - Initializes all tenant connections on startup
  - Provides connection pooling with LRU cache
  - Handles graceful shutdown of all connections
  - **Note**: Currently has hardcoded admin DB URI that should be moved to environment variables

- **Database Resolver Middleware** (`middlewares/databaseResolver.js`):

  - Extracts tenant domain from JWT token or request body
  - Retrieves appropriate database connection
  - Injects `req.dbConnection` for downstream handlers

- **Repository Pattern**: All database operations go through repository layer

  - Located in `repositories/` directory
  - Accept `dbConnection` as first parameter
  - Provide abstraction over Mongoose models

- **Service Layer**: Business logic and transaction management
  - Located in `services/` directory
  - Handle multi-step operations and cross-database transactions
  - Example: `services/tenant.js` creates tenant + admin user atomically

### Application Structure

```
├── controllers/          # HTTP request handlers
├── middlewares/         # Express middleware (auth, DB resolver)
├── repositories/        # Database access layer
├── routes/             # API route definitions
├── schemas/            # Mongoose schemas
│   ├── store/         # Tenant database schemas (products, orders, cart, etc.)
│   └── tenant.js      # Admin database schemas
├── services/          # Business logic layer
├── server/           # Express configuration
├── utils/           # Utilities (connection manager, JWT, LRU cache)
└── index.js        # Application entry point
```

## Development Commands

### Running the Application

```bash
# Start development server with hot reload
npm start

# The server runs on port 3000 by default (configurable via PORT env var)
```

### Environment Variables

Create a `.env` file with:

- `PORT`: Server port (default: 3000)
- `JWT_SECRET`: Secret key for JWT token signing
- Database URIs should be configured (currently hardcoded in connectionManager.js)

## API Structure

All routes are prefixed with `/api`:

- `/api/auth` - Authentication (login, register)
- `/api/products` - Product management
- `/api/categories` - Category management
- `/api/carts` - Shopping cart operations
- `/api/users` - User management

### Authentication Flow

1. **Tenant Registration**: POST `/api/auth/register` creates tenant, admin user in both admin DB and tenant DB
2. **Login**: POST `/api/auth/login` requires `domain` in request body, returns JWT with `userId` and `tenantDomain`
3. **Authenticated Requests**: Include JWT in `Authorization: Bearer <token>` header

## Important Implementation Details

### Database Connection Pattern

Every controller/service function receives a database connection:

```javascript
// In repositories
export const getProductsRepo = async (dbConnection, filters) => {
  const ProductModel = dbConnection.model("Product");
  return await ProductModel.find(filters);
};

// In services
export const getProductsService = async (dbConnection, filters) => {
  return await getProductsRepo(dbConnection, filters);
};

// In controllers
export const getProducts = async (req, res) => {
  const dbConnection = req.dbConnection; // Injected by middleware
  const products = await getProductsService(dbConnection, req.query);
  res.json(products);
};
```

### Schema Organization

- **Admin DB schemas**: `schemas/tenant.js`, `schemas/tenantUser.js`, `schemas/subscription.js`
- **Tenant DB schemas**: Everything in `schemas/store/` (user, product, category, cart, order, etc.)
- Schema files export a function that accepts a connection and returns a model

### Transaction Management

Multi-database transactions are handled in service layer:

```javascript
const session = await dbConnection.startSession();
session.startTransaction();
try {
  // Perform operations
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  await session.endSession();
}
```

## Project Policies

This project follows strict **task-driven development** principles documented in `.cursor/rules.md`:

1. **No code changes without an agreed task**: All work must be associated with a Product Backlog Item (PBI) and specific task
2. **PBI alignment**: Tasks must align with PRD documents when available
3. **Task granularity**: Break down complex features into small, testable units
4. **Documentation requirements**:
   - PBIs documented in `docs/delivery/backlog.md`
   - Task details in `docs/delivery/<PBI-ID>/<PBI-ID>-<TASK-ID>.md`
   - Technical documentation for APIs and interfaces
5. **DRY principle**: Information defined once and referenced elsewhere
6. **Constants for repeated values**: Use named constants instead of magic numbers
7. **Test proportionality**: Test plans must match task complexity
8. **Status synchronization**: Task status must match in both index and task file

## Known Issues & Architectural Notes

From ASSESSMENT.md:

- **Security**:

  - Hardcoded database credentials in connectionManager.js (move to env vars)
  - Missing password hashing implementation
  - No rate limiting on authentication endpoints

- **Missing Core Features**:

  - Payment integration (Stripe/PayPal)
  - Inventory tracking system
  - Shipping calculations
  - Email notifications
  - Theme/storefront system

- **Code Quality**:
  - Excessive console.log statements throughout codebase
  - No input validation middleware
  - No centralized error handling middleware

## Future Development

See "E-commerce Templating Engine Design.md" for planned theme customization system that will enable merchants to customize their storefronts using a Liquid-like templating engine.

## Working with this Codebase

1. **Follow the repository pattern** - don't bypass it to directly use Mongoose
2. **Test with multiple tenants** to ensure proper isolation
3. **Never skip the database resolver middleware** for authenticated routes
4. **Use transactions** for multi-step operations that must be atomic
