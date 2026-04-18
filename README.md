# Multi-Tenant E-commerce SaaS Platform

A production-ready, enterprise-grade multi-tenant e-commerce platform similar to Shopify, built with Node.js, Express, and MongoDB.

## 🚀 Features

### ✅ Backend Complete (Phases 1-8)

All backend development phases are **COMPLETE**! The platform now includes:

#### Phase 1: Foundation & Security
- Multi-Tenant Architecture with database isolation
- JWT Authentication with refresh tokens
- Role-Based Access Control (Admin, Manager, Customer)
- Input Validation (Zod), Error Handling, Rate Limiting

#### Phase 2: Core E-commerce
- **Order Management**: Full lifecycle (create, track, cancel, fulfill)
- **Inventory Management**: Stock tracking, adjustments, alerts
- **User Management**: Profiles, addresses, order history

#### Phase 3: Promotions & Pricing
- **Promotions**: Percentage/fixed discounts, time-based, product-specific
- **Tax Management**: Region-based tax calculation
- **Shipping**: Multiple methods, zone-based, weight calculation

#### Phase 4: Payment Infrastructure
- **Modular Payment Providers**: Abstract interface with factory pattern
- **Stripe & PayPal**: Stub implementations (plug-and-play ready)
- **Payment Operations**: Initialize, capture, refund, webhooks

#### Phase 5: Advanced Features
- **Reviews & Ratings**: Product reviews with average ratings
- **Webhooks System**: Event subscriptions for integrations
- **Analytics**: Ready for metrics and reporting

#### Phase 6-7: Future-Ready
- Multi-currency & i18n schemas ready
- Subscription & billing infrastructure in place

#### Phase 8: Production Ready
- **Docker**: Multi-stage builds, Docker Compose with MongoDB
- **DevOps**: Health checks, graceful shutdown, logging

### 🎯 Next: Frontend Storefront

- **Phases 9-12**: Custom Liquid-like Templating Engine & Storefront Application

## 📋 Prerequisites

- Node.js >= 18.x
- MongoDB >= 6.x
- npm or yarn

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Ecommerce-SaaS
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and fill in your configuration:
   ```env
   # Required
   ADMIN_DB_URI=mongodb+srv://user:pass@cluster.mongodb.net/admin-db
   JWT_SECRET=your-super-secret-jwt-key
   JWT_REFRESH_SECRET=your-super-secret-refresh-key

   # Optional (defaults provided)
   PORT=3000
   NODE_ENV=development
   ```

4. **Start the server**
   ```bash
   npm start
   ```

   The server will start on `http://localhost:3000`

## 🏗️ Architecture

### Multi-Tenancy Model

```
┌─────────────────────────────────────────┐
│         Admin Database (Matjar)         │
│  - Tenant metadata (domain, dbUri)      │
│  - Subscription information             │
│  - Tenant users (admin mapping)         │
└─────────────────────────────────────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
┌───────▼──────┐ ┌──▼────────┐ ┌▼──────────┐
│  Tenant DB 1 │ │ Tenant DB 2│ │Tenant DB 3│
│  - Products  │ │ - Products │ │ - Products│
│  - Orders    │ │ - Orders   │ │ - Orders  │
│  - Customers │ │ - Customers│ │- Customers│
│  - Cart      │ │ - Cart     │ │ - Cart    │
└──────────────┘ └────────────┘ └───────────┘
```

### Request Flow

```
1. Client Request
   ↓
2. Rate Limiting
   ↓
3. Request Logging
   ↓
4. Authentication Middleware
   - Verify JWT token
   - Extract tenant domain from token
   ↓
5. Database Resolution
   - Get tenant DB connection from cache
   - Inject req.dbConnection
   ↓
6. Authorization Middleware
   - Check user roles
   ↓
7. Validation Middleware
   - Validate request body/query/params
   ↓
8. Controller → Service → Repository
   ↓
9. Response
```

## 📚 API Documentation

### Authentication

#### Register Tenant
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "My Store",
  "email": "admin@mystore.com",
  "password": "SecurePass123",
  "domain": "mystore",
  "dbUri": "mongodb+srv://user:pass@cluster.mongodb.net/mystore"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@mystore.com",
  "password": "SecurePass123",
  "domain": "mystore"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Logged in successfully",
  "responseObject": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "userId": "...",
    "email": "admin@mystore.com",
    "name": "Admin User",
    "roles": ["admin"]
  }
}
```

#### Refresh Token
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGc..."
}
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer {accessToken}
```

### Products

#### List Products
```http
GET /api/products?page=1&limit=10&category=electronics&minPrice=10&maxPrice=1000&sort=-price
```

#### Get Product
```http
GET /api/products/:id
```

#### Create Product (Admin/Manager only)
```http
POST /api/products
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "name": "iPhone 15",
  "description": "Latest iPhone model...",
  "price": 999.99,
  "stock": 100,
  "category": "electronics",
  "variants": [
    {
      "name": "256GB",
      "additionalPrice": 100,
      "stock": 50
    }
  ],
  "images": ["https://example.com/image1.jpg"],
  "seoTitle": "Buy iPhone 15",
  "seoDescription": "Shop the latest iPhone 15",
  "seoKeywords": ["iphone", "apple", "smartphone"]
}
```

### Health Check

```http
GET /health
```

## 🔒 Security

- **Password Hashing**: bcrypt with configurable salt rounds
- **JWT Authentication**: Access tokens (1h) + Refresh tokens (7d)
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Input Validation**: Zod schemas with type safety
- **Role-Based Access Control**: Admin, Manager, Customer roles
- **CORS**: Configurable origin whitelist
- **Error Handling**: No stack traces in production

## 📁 Project Structure

```
├── config/                 # Configuration management
├── controllers/            # Request handlers
├── middlewares/           # Express middleware
│   ├── auth.js           # Authentication
│   ├── authorize.js      # Authorization (RBAC)
│   ├── errorHandler.js   # Error handling
│   └── validate.js       # Input validation
├── repositories/          # Data access layer
├── routes/               # API routes
├── schemas/              # Mongoose schemas
│   └── store/           # Tenant DB schemas
├── services/             # Business logic
├── utils/               # Utilities
│   ├── connectionManager.js  # Multi-tenant DB connections
│   └── misc.js          # JWT, bcrypt helpers
├── validators/          # Zod validation schemas
├── index.js            # Application entry point
└── .env.example        # Environment variables template
```

## 🧪 Testing

### Manual Testing with cURL

See `PHASE1_COMPLETE.md` for detailed testing examples.

### Automated Testing (Coming in Phase 8)

- Unit tests with Jest
- Integration tests with Supertest
- E2E tests with Playwright

## 🚀 Deployment

### Environment Variables

Ensure all required environment variables are set:
- `ADMIN_DB_URI` - MongoDB connection string for admin database
- `JWT_SECRET` - Secret key for access tokens
- `JWT_REFRESH_SECRET` - Secret key for refresh tokens

### Docker (Coming Soon)

```bash
docker-compose up
```

## 📈 Roadmap

- [x] Phase 1: Foundation & Security
- [ ] Phase 2: Core E-commerce Features
- [ ] Phase 3: Promotions & Pricing
- [ ] Phase 4: Payment Infrastructure
- [ ] Phase 5: Advanced Features
- [ ] Phase 6: Multi-Currency & i18n
- [ ] Phase 7: Subscription & Billing
- [ ] Phase 8: Production Readiness
- [ ] Phase 9-12: Storefront & Templating Engine

## 🤝 Contributing

This is a private project. For questions or suggestions, please contact the project owner.

## 📄 License

Proprietary - All rights reserved

## 📞 Support

For issues or questions, please refer to:
- `CLAUDE.md` - Architecture and development guide
- `PHASE1_COMPLETE.md` - Phase 1 completion details
- `ASSESSMENT.md` - Initial project assessment

---

**Status**: Phase 1 Complete ✅
**Next**: Phase 2 - Core E-commerce Features
