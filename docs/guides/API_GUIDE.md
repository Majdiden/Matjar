# API Documentation Guide

Complete API reference for the Multi-Tenant E-commerce Platform

---

## Base URL

```
Development: http://localhost:3000/api
Production: https://your-domain.com/api
```

---

## Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer {your_access_token}
```

---

## Response Format

All API responses follow this standard format:

```json
{
  "success": true|false,
  "message": "Human-readable message",
  "responseObject": {
    /* Response data */
  },
  "errors": [ /* Only present on validation failures */ ]
}
```

---

## Authentication Endpoints

### Register Tenant (Store)

Create a new tenant/store with an admin user.

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

**Response** (201):
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

---

### Login

Authenticate user and receive access + refresh tokens.

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@mystore.com",
  "password": "SecurePass123",
  "domain": "mystore"
}
```

**Response** (200):
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

---

### Refresh Access Token

Get a new access token using refresh token.

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGc..."
}
```

**Response** (200):
```json
{
  "success": true,
  "message": "Access token refreshed successfully",
  "responseObject": {
    "accessToken": "eyJhbGc..."
  }
}
```

---

### Get Current User

Get authenticated user's information.

```http
GET /api/auth/me
Authorization: Bearer {token}
```

**Response** (200):
```json
{
  "success": true,
  "message": "User info retrieved successfully",
  "responseObject": {
    "userId": "...",
    "tenantDomain": "mystore",
    "roles": ["admin"]
  }
}
```

---

### Logout

Logout current user.

```http
POST /api/auth/logout
Authorization: Bearer {token}
```

**Response** (200):
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## Product Endpoints

### List Products

Get paginated list of products with filtering and sorting.

```http
GET /api/products?page=1&limit=10&category={categoryId}&minPrice=10&maxPrice=1000&search=phone&sort=-price
Authorization: Bearer {token} (optional)
```

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 10)
- `category` (string): Filter by category ID
- `minPrice` (number): Minimum price
- `maxPrice` (number): Maximum price
- `search` (string): Search in product name/description
- `sort` (string): Sort field (prefix with `-` for descending)
  - Options: `price`, `-price`, `name`, `-name`, `createdAt`, `-createdAt`

**Response** (200):
```json
{
  "success": true,
  "message": "Products retrieved successfully",
  "responseObject": {
    "products": [...],
    "pagination": {
      "total": 100,
      "page": 1,
      "pages": 10,
      "limit": 10
    }
  }
}
```

---

### Get Single Product

Get detailed information about a specific product.

```http
GET /api/products/:id
Authorization: Bearer {token} (optional)
```

**Response** (200):
```json
{
  "success": true,
  "responseObject": {
    "data": {
      "_id": "...",
      "name": "iPhone 15",
      "description": "Latest iPhone...",
      "price": 999.99,
      "stock": 100,
      "category": {...},
      "variants": [...],
      "images": [...],
      "seoTitle": "...",
      "seoDescription": "...",
      "createdAt": "...",
      "updatedAt": "..."
    }
  }
}
```

---

### Create Product

Create a new product (Admin/Manager only).

```http
POST /api/products
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "iPhone 15",
  "description": "Latest iPhone model with advanced features",
  "price": 999.99,
  "stock": 100,
  "category": "categoryId",
  "variants": [
    {
      "name": "256GB",
      "additionalPrice": 100,
      "stock": 50
    }
  ],
  "images": ["https://example.com/image1.jpg"],
  "seoTitle": "Buy iPhone 15",
  "seoDescription": "Shop the latest iPhone 15 with amazing features",
  "seoKeywords": ["iphone", "apple", "smartphone"]
}
```

**Response** (201):
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Product added successfully",
  "responseObject": {
    "data": {...}
  }
}
```

---

### Update Product

Update existing product (Admin/Manager only).

```http
PUT /api/products/:id
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "iPhone 15 Pro",
  "price": 1099.99,
  "stock": 80
}
```

**Response** (201):
```json
{
  "success": true,
  "message": "Product updated successfully",
  "responseObject": {...}
}
```

---

### Delete Product

Delete a product (Admin/Manager only).

```http
DELETE /api/products/:id
Authorization: Bearer {token}
```

**Response** (201):
```json
{
  "success": true,
  "message": "Product deleted successfully"
}
```

---

## Order Endpoints

### Create Order

Create an order from cart.

```http
POST /api/orders
Authorization: Bearer {token}
Content-Type: application/json

{
  "cartId": "...",
  "shippingAddress": {
    "addressLine1": "123 Main St",
    "addressLine2": "Apt 4B",
    "city": "New York",
    "state": "NY",
    "postalCode": "10001",
    "country": "USA"
  },
  "paymentMethod": "credit_card"
}
```

**Response** (201):
```json
{
  "success": true,
  "message": "Order created successfully",
  "responseObject": {
    "_id": "...",
    "user": {...},
    "products": [...],
    "totalAmount": 1099.99,
    "status": "Pending",
    "paymentStatus": "Not Paid",
    "createdAt": "..."
  }
}
```

---

### Get Order

Get specific order details.

```http
GET /api/orders/:id
Authorization: Bearer {token}
```

**Response** (200):
```json
{
  "success": true,
  "message": "Order retrieved successfully",
  "responseObject": {
    "_id": "...",
    "user": {...},
    "products": [...],
    "totalAmount": 1099.99,
    "status": "Processing",
    "shippingAddress": {...},
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

---

### Get My Orders

Get current user's order history.

```http
GET /api/orders/my-orders?page=1&limit=10&sort=-createdAt
Authorization: Bearer {token}
```

**Response** (200):
```json
{
  "success": true,
  "message": "Order history retrieved successfully",
  "responseObject": {
    "orders": [...],
    "pagination": {...}
  }
}
```

---

### Get All Orders

Get all orders (Admin/Manager only).

```http
GET /api/orders?page=1&limit=10&status=Pending
Authorization: Bearer {token}
```

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `status` (string): Filter by status (Pending, Processing, Shipped, Delivered, Cancelled)
- `sort` (string): Sort field

**Response** (200):
```json
{
  "success": true,
  "message": "Orders retrieved successfully",
  "responseObject": {
    "orders": [...],
    "pagination": {...}
  }
}
```

---

### Update Order Status

Update order status (Admin/Manager only).

```http
PATCH /api/orders/:id/status
Authorization: Bearer {token}
Content-Type: application/json

{
  "status": "Shipped"
}
```

**Valid Statuses:**
- `Pending`
- `Processing`
- `Shipped`
- `Delivered`
- `Cancelled`

**Response** (200):
```json
{
  "success": true,
  "message": "Order status updated successfully",
  "responseObject": {...}
}
```

---

### Cancel Order

Cancel an order (restores inventory).

```http
POST /api/orders/:id/cancel
Authorization: Bearer {token}
```

**Response** (200):
```json
{
  "success": true,
  "message": "Order cancelled successfully",
  "responseObject": {...}
}
```

**Note:** Only orders with status "Pending" or "Processing" can be cancelled.

---

## Error Responses

### Validation Error (400)

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "body.email",
      "message": "Invalid email format"
    },
    {
      "field": "body.password",
      "message": "Password must be at least 8 characters"
    }
  ]
}
```

---

### Authentication Error (401)

```json
{
  "success": false,
  "message": "Invalid or expired token. Please login again."
}
```

---

### Authorization Error (403)

```json
{
  "success": false,
  "message": "Access denied. You do not have permission to perform this action.",
  "requiredRoles": ["admin", "manager"]
}
```

---

### Not Found Error (404)

```json
{
  "success": false,
  "message": "Order not found"
}
```

---

### Rate Limit Error (429)

```json
{
  "success": false,
  "message": "Too many requests from this IP, please try again later."
}
```

---

### Internal Server Error (500)

```json
{
  "success": false,
  "message": "Internal server error"
}
```

---

## Rate Limiting

- **Window**: 15 minutes (configurable)
- **Max Requests**: 100 per window per IP (configurable)
- **Headers Returned**:
  - `RateLimit-Limit`: Maximum requests allowed
  - `RateLimit-Remaining`: Remaining requests
  - `RateLimit-Reset`: Time when limit resets

---

## Health Check

Check if the API is running.

```http
GET /health
```

**Response** (200):
```json
{
  "success": true,
  "message": "Server is healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "environment": "development"
}
```

---

## Testing with cURL

### Complete Flow Example

```bash
# 1. Register a tenant
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Store",
    "email": "admin@test.com",
    "password": "Test123456",
    "domain": "teststore",
    "dbUri": "mongodb+srv://user:pass@cluster.mongodb.net/teststore"
  }'

# 2. Login
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "Test123456",
    "domain": "teststore"
  }' | jq -r '.responseObject.accessToken')

# 3. Create a product
curl -X POST http://localhost:3000/api/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Product",
    "description": "A test product",
    "price": 29.99,
    "stock": 100
  }'

# 4. Get products
curl -X GET "http://localhost:3000/api/products" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Postman Collection

Import this base configuration into Postman:

```json
{
  "info": {
    "name": "E-commerce SaaS API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000/api"
    },
    {
      "key": "accessToken",
      "value": ""
    }
  ]
}
```

---

## Additional Resources

- Full backend documentation: `BACKEND_COMPLETE.md`
- Phase 1 security details: `PHASE1_COMPLETE.md`
- Architecture guide: `CLAUDE.md`
- Docker setup: `docker-compose.yml`

---

**Need Help?** Check the `/health` endpoint to ensure the API is running, and verify your `.env` file is properly configured.
