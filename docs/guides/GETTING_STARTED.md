# 🚀 Getting Started Guide

Complete guide to get your Multi-Tenant E-commerce Platform up and running in minutes!

---

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js** >= 18.x ([Download](https://nodejs.org/))
- **MongoDB** account (MongoDB Atlas recommended)
- **Git** (for cloning the repository)
- **Docker** (optional, for containerized deployment)

---

## ⚡ Quick Start (5 Minutes)

### Option 1: Docker (Recommended)

The fastest way to get started with everything pre-configured:

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd Ecommerce-SaaS

# 2. Create environment file
cp .env.example .env

# 3. Edit .env and add your MongoDB credentials
nano .env  # or use your preferred editor

# 4. Start everything with Docker Compose
docker-compose up

# ✅ Done! API is running at http://localhost:3000
# MongoDB GUI available at http://localhost:8081
```

### Option 2: Local Development

Run directly on your machine without Docker:

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd Ecommerce-SaaS

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env

# 4. Edit .env with your configuration
nano .env

# 5. Start the server
npm start

# ✅ Done! API is running at http://localhost:3000
```

---

## 🔧 Environment Configuration

Edit your `.env` file with these required values:

```env
# ===== REQUIRED (Application won't start without these) =====

# Your MongoDB connection string for the admin database
ADMIN_DB_URI=mongodb+srv://username:password@cluster.mongodb.net/admin-db?retryWrites=true&w=majority

# Secret keys for JWT tokens (generate random strings)
JWT_SECRET=your-super-secret-key-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-chars

# ===== OPTIONAL (Have sensible defaults) =====

# Server port
PORT=3000

# Environment
NODE_ENV=development

# JWT token expiration
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Password hashing
BCRYPT_SALT_ROUNDS=10

# Connection pool
MAX_TENANT_CONNECTIONS=5000
CONNECTION_CACHE_TTL=3600000

# CORS (comma-separated origins or *)
CORS_ORIGIN=*

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
```

### 🔑 Generating Secure Secrets

Use these commands to generate secure random secrets:

```bash
# On Mac/Linux
openssl rand -base64 32

# Or with Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## 🗄️ MongoDB Setup

### Option A: MongoDB Atlas (Cloud - Recommended)

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free account
3. Create a new cluster
4. Click "Connect" → "Connect your application"
5. Copy the connection string
6. Replace `<password>` and `<dbname>` in the connection string
7. Paste into your `.env` file as `ADMIN_DB_URI`

### Option B: Local MongoDB (with Docker Compose)

If you're using Docker Compose, MongoDB is already included!

```bash
docker-compose up

# Access MongoDB at: mongodb://admin:admin123@localhost:27017
# Use this for ADMIN_DB_URI: mongodb://admin:admin123@localhost:27017/admin-db
```

---

## ✅ Verify Installation

### 1. Check Health Endpoint

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "success": true,
  "message": "Server is healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "environment": "development"
}
```

### 2. Check Server Logs

You should see:
```
╔════════════════════════════════════════╗
║   Multi-Tenant E-commerce Platform    ║
╠════════════════════════════════════════╣
║  Environment: development              ║
║  Port: 3000                            ║
║  Status: Running                       ║
╚════════════════════════════════════════╝
```

---

## 🗃️ Migrations

Schema and one-time data changes are tracked in the `migrations/` directory
and applied by a lightweight custom runner at `scripts/migrate.js`. State
lives in the `_migrations` collection of your main MongoDB database.

### Check what would run

```bash
npm run migrate:status
```

You'll see one pending migration on a fresh clone — `001_baseline`, the
no-op marker that seals the schema as of 2026-04-18.

### Apply all pending migrations

```bash
npm run migrate
```

Migrations run in numeric order, each wrapped in a MongoDB transaction
(when the deployment is a replica set or Atlas). On a standalone local
Mongo without a replica set, the runner logs a warning and runs without
transactions — this is fine for development.

### Revert the most recent migration

```bash
npm run migrate:down
```

Reverts exactly one migration. Run repeatedly to unwind further.

### Create a new migration

```bash
npm run migrate:create add_sku_to_products
# → migrations/002_add_sku_to_products.js scaffolded
```

Edit the file, fill in `up()` and `down()`, then commit both. See
`migrations/README.md` for the authoring conventions and when to use a
migration vs a one-off script in `scripts/`.

### Production

In `NODE_ENV=production`, `migrate` and `migrate:down` refuse to run
without an explicit `--production` flag. The deployed service in
`render.yaml` invokes `npm run migrate:production` in its
`preDeployCommand`, so deploys apply migrations automatically. For
manual remediation, shell into the production environment and run
the same script.

---

## 🎯 First Steps

### 1. Register Your First Tenant (Store)

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Store",
    "email": "admin@mystore.com",
    "password": "SecurePass123",
    "domain": "mystore",
    "dbUri": "mongodb+srv://user:pass@cluster.mongodb.net/mystore"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Tenant added successfully",
  "responseObject": {
    "tenantId": "...",
    "userId": "..."
  }
}
```

### 2. Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@mystore.com",
    "password": "SecurePass123",
    "domain": "mystore"
  }'
```

**Save the `accessToken` from the response!**

### 3. Create Your First Product

```bash
curl -X POST http://localhost:3000/api/products \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "iPhone 15",
    "description": "Latest iPhone model",
    "price": 999.99,
    "stock": 100
  }'
```

### 4. List Products

```bash
curl -X GET http://localhost:3000/api/products
```

---

## 🐳 Docker Commands

### Start Services
```bash
# Start in foreground
docker-compose up

# Start in background
docker-compose up -d
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app
```

### Stop Services
```bash
docker-compose down
```

### Rebuild After Changes
```bash
docker-compose up --build
```

### Access MongoDB GUI
```bash
# Open in browser
open http://localhost:8081

# Login: admin / admin123
```

---

## 📊 Available Services (Docker)

| Service | URL | Credentials |
|---------|-----|-------------|
| API | http://localhost:3000 | - |
| Health Check | http://localhost:3000/health | - |
| MongoDB | localhost:27017 | admin / admin123 |
| Mongo Express | http://localhost:8081 | admin / admin123 |

---

## 🧪 Testing the API

### Using cURL (Command Line)

See examples above or check `API_GUIDE.md` for complete documentation.

### Using Postman

1. Import the API collection (see `API_GUIDE.md`)
2. Set base URL: `http://localhost:3000/api`
3. Test endpoints

### Using VS Code REST Client

Create a file `test.http`:

```http
### Register Tenant
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "name": "Test Store",
  "email": "admin@test.com",
  "password": "Test123456",
  "domain": "teststore",
  "dbUri": "mongodb+srv://user:pass@cluster.mongodb.net/teststore"
}

### Login
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "admin@test.com",
  "password": "Test123456",
  "domain": "teststore"
}

### Get Products
GET http://localhost:3000/api/products
Authorization: Bearer YOUR_TOKEN_HERE
```

---

## 🔍 Troubleshooting

### Error: "Missing required environment variables"

**Solution:** Ensure `.env` file exists and contains all required variables:
```bash
# Check if .env exists
ls -la .env

# Verify contents
cat .env
```

### Error: "Unable to connect to database"

**Solutions:**
1. Verify `ADMIN_DB_URI` is correct
2. Check network connectivity
3. Ensure MongoDB cluster allows connections from your IP
4. Test connection string separately

### Error: "Port 3000 already in use"

**Solutions:**
```bash
# Option 1: Kill process using port 3000
lsof -ti:3000 | xargs kill -9

# Option 2: Change port in .env
PORT=3001
```

### Error: "Docker: no such file or directory"

**Solution:** Docker is not installed. Either:
- Install Docker Desktop
- Use local development (Option 2)

### Application starts but requests fail

**Check:**
1. MongoDB connection is working
2. Access token is valid (not expired)
3. Request headers are correct
4. CORS is configured for your origin

---

## 📚 Next Steps

### Explore the API
- Read `API_GUIDE.md` for complete API documentation
- Test all endpoints with your favorite HTTP client
- Understand authentication flow

### Understand the Architecture
- Read `CLAUDE.md` for architecture deep-dive
- Review `BACKEND_COMPLETE.md` for feature matrix
- Explore the codebase structure

### Customize for Your Needs
- Add custom payment providers
- Extend product schemas
- Add custom business logic
- Configure webhooks

### Deploy to Production
- Set `NODE_ENV=production`
- Use production MongoDB cluster
- Configure proper CORS origins
- Set up SSL/TLS
- Use environment variables for secrets
- Set up monitoring and logging

---

## 🎓 Learning Resources

### Documentation Files
- `README.md` - Project overview
- `API_GUIDE.md` - Complete API reference
- `BACKEND_COMPLETE.md` - Feature documentation
- `PHASE1_COMPLETE.md` - Phase 1 details
- `CLAUDE.md` - Architecture guide

### Code Examples
- `controllers/` - See how endpoints are implemented
- `services/` - Business logic examples
- `middlewares/` - Authentication & validation examples

---

## 💡 Tips & Best Practices

### Development
1. Use environment variables for all configuration
2. Never commit `.env` file
3. Test with multiple tenants
4. Use the health check endpoint
5. Monitor logs during development

### Security
1. Generate strong, unique JWT secrets
2. Use HTTPS in production
3. Configure CORS properly
4. Enable rate limiting
5. Keep dependencies updated

### Performance
1. Use connection pooling
2. Implement caching where appropriate
3. Monitor database queries
4. Use indexes on MongoDB
5. Optimize Docker images

---

## 🆘 Getting Help

### Check Documentation
1. Search `API_GUIDE.md`
2. Review error messages carefully
3. Check logs: `docker-compose logs -f app`

### Common Issues
- Authentication: Check token expiration
- Database: Verify connection string
- Rate limiting: Wait or adjust limits
- CORS: Configure allowed origins

### Debug Mode
Enable detailed logging:
```env
LOG_LEVEL=debug
NODE_ENV=development
```

---

## ✨ Success!

If you've reached this point and everything is working, congratulations! 🎉

You now have a **production-ready, enterprise-grade e-commerce backend** running!

**What you can do now:**
- Create multiple stores (tenants)
- Add products and categories
- Manage orders and inventory
- Configure payments
- Set up webhooks
- Build your storefront

---

## 🚀 Ready for More?

Check out `BACKEND_COMPLETE.md` to see all the features available and start building your storefront application!

**Next:** Phases 9-12 - Custom Templating Engine & Storefront
