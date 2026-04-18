# Data Layer Fixes - Implementation Checklist

## Phase 1: Critical Fixes (Week 1-2)

### Validation Improvements
- [ ] **user.js** - Add email validation
  - [ ] Add email regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
  - [ ] Add password minlength: 8
  - [ ] Add password `select: false`
  - [ ] Add name minlength: 2
  - [ ] Mark password for pre-save hashing
  - Time estimate: 1-2 hours

- [ ] **product.js** - Add price/stock/SKU validation
  - [ ] Add `min: 0, max: 999999.99` to price
  - [ ] Add `min: 0` to stock
  - [ ] Add SKU field with unique index
  - [ ] Add product status enum (draft, published, archived)
  - [ ] Add slug field with unique index
  - [ ] Restructure SEO fields
  - Time estimate: 2-3 hours

- [ ] **order.js** - Add order number and status enum
  - [ ] Add orderNumber field (unique, required)
  - [ ] Convert status to enum (pending, confirmed, processing, shipped, delivered, cancelled, refunded)
  - [ ] Convert paymentStatus to enum
  - [ ] Add shippingStatus field
  - [ ] Add currency field
  - [ ] Restructure amounts (subtotal, tax, shipping, discount, total)
  - [ ] Add trackingNumber field
  - Time estimate: 2-3 hours

- [ ] **cart.js** - Add quantity validation and expiration
  - [ ] Add quantity min: 1, max: 999
  - [ ] Add expiresAt with TTL index
  - [ ] Add variant selection support
  - [ ] Add price caching per item
  - [ ] Add discountCode field
  - Time estimate: 1-2 hours

- [ ] **inventory.js** - Add warehouse tracking
  - [ ] Add quantity.total, quantity.reserved, quantity.available structure
  - [ ] Add warehouseLocation object
  - [ ] Add reorderLevel and reorderQuantity
  - [ ] Add lastStockCheckDate
  - [ ] Add trackingHistory subdocument array
  - Time estimate: 1-2 hours

- [ ] **category.js** - Add slug and hierarchy
  - [ ] Add slug field with unique index
  - [ ] Add parentCategory reference field
  - [ ] Add image and icon fields
  - [ ] Add displayOrder field
  - [ ] Add isActive status field
  - [ ] Add seo object (title, description)
  - [ ] Add productCount denormalization
  - Time estimate: 2 hours

- [ ] **review.js** - Add moderation and verification
  - [ ] Make comment required with minlength: 10
  - [ ] Add title field (required, 5-100 chars)
  - [ ] Add verifiedPurchase boolean
  - [ ] Add helpful/unhelpful counts
  - [ ] Add status enum (pending, approved, rejected)
  - [ ] Add sellerResponse object with comment and date
  - [ ] Add isAnonymous boolean
  - Time estimate: 1-2 hours

- [ ] **promotion.js** - Add usage limits and validation
  - [ ] Add discountValue validation (min: 0.01, max 100% for percentage)
  - [ ] Add usageLimit object (global, perUser, currentUsage)
  - [ ] Add minimumOrderAmount field
  - [ ] Add maximumDiscountAmount field
  - [ ] Add isExclusive boolean
  - Time estimate: 1-2 hours

- [ ] **shipping.js** - Add zone and timing validation
  - [ ] Restructure zones as array of objects (not strings)
  - [ ] Add country/region validation to zones
  - [ ] Add freeShippingThreshold field
  - [ ] Add processingTime (hours)
  - [ ] Add cutoffTime field
  - [ ] Add rate validation (min: 0)
  - Time estimate: 1-2 hours

- [ ] **tax.js** - Add rate validation
  - [ ] Add rate validation (min: 0, max: 100)
  - [ ] Restructure region as object (country, state, city, zipCode)
  - [ ] Add applicableProductTypes array
  - [ ] Add exemptionThreshold field
  - [ ] Add isCompound boolean
  - Time estimate: 1 hour

- [ ] **tenantUser.js** - Expand schema
  - [ ] Add password field (select: false)
  - [ ] Add roles array with enum
  - [ ] Add emailVerified boolean
  - [ ] Add status enum (active, inactive, locked)
  - [ ] Add lastLoginAt timestamp
  - [ ] Add permissions array
  - Time estimate: 1 hour

### Index Creation
- [ ] **user.js** - Add 4 indexes (30 minutes)
  ```javascript
  userSchema.index({ email: 1 });
  userSchema.index({ status: 1 });
  userSchema.index({ createdAt: -1 });
  userSchema.index({ email: 1, status: 1 });
  ```

- [ ] **product.js** - Add 6 indexes (45 minutes)
  ```javascript
  productSchema.index({ status: 1 });
  productSchema.index({ category: 1 });
  productSchema.index({ createdAt: -1 });
  productSchema.index({ slug: 1 });
  productSchema.index({ status: 1, category: 1, createdAt: -1 });
  productSchema.index({ sku: 1 });
  ```

- [ ] **order.js** - Add 6 indexes (45 minutes)
  ```javascript
  orderSchema.index({ user: 1 });
  orderSchema.index({ status: 1 });
  orderSchema.index({ createdAt: -1 });
  orderSchema.index({ paymentStatus: 1 });
  orderSchema.index({ user: 1, status: 1, createdAt: -1 });
  orderSchema.index({ orderNumber: 1 });
  ```

- [ ] **cart.js** - Add 4 indexes (30 minutes)
  ```javascript
  cartSchema.index({ user: 1 });
  cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL
  cartSchema.index({ "items.product": 1 });
  cartSchema.index({ user: 1, updatedAt: -1 });
  ```

- [ ] **category.js** - Add 4 indexes (30 minutes)
  ```javascript
  categorySchema.index({ slug: 1 });
  categorySchema.index({ parentCategory: 1 });
  categorySchema.index({ isActive: 1 });
  categorySchema.index({ displayOrder: 1 });
  ```

- [ ] **review.js** - Add 5 indexes (45 minutes)
  ```javascript
  reviewSchema.index({ product: 1 });
  reviewSchema.index({ user: 1 });
  reviewSchema.index({ status: 1 });
  reviewSchema.index({ product: 1, status: 1, rating: -1 });
  reviewSchema.index({ createdAt: -1 });
  ```

- [ ] **inventory.js** - Add 3 indexes (30 minutes)
  ```javascript
  inventorySchema.index({ product: 1 }); // unique already
  inventorySchema.index({ "quantity.available": 1 });
  inventorySchema.index({ warehouseLocation.warehouse: 1 });
  ```

- [ ] **promotion.js** - Add 4 indexes (30 minutes)
  ```javascript
  promotionSchema.index({ startDate: 1, endDate: 1 });
  promotionSchema.index({ "applicableProducts": 1 });
  promotionSchema.index({ isActive: 1 });
  promotionSchema.index({ createdAt: -1 });
  ```

- [ ] **shipping.js** - Add 2 indexes (15 minutes)
  ```javascript
  shippingSchema.index({ isActive: 1 });
  shippingSchema.index({ "zones.region": 1 });
  ```

- [ ] **tax.js** - Add 3 indexes (15 minutes)
  ```javascript
  taxSchema.index({ "region.country": 1, "region.state": 1 });
  taxSchema.index({ "applicableCategories": 1 });
  taxSchema.index({ isActive: 1 });
  ```

- [ ] **wishlist.js** - Add 2 indexes (15 minutes)
  ```javascript
  wishlistSchema.index({ user: 1 });
  wishlistSchema.index({ "products": 1 });
  ```

- [ ] **payment.js** - Add 3 indexes (20 minutes)
  ```javascript
  paymentSchema.index({ order: 1 });
  paymentSchema.index({ status: 1 });
  paymentSchema.index({ provider: 1, status: 1 });
  ```

- [ ] **supportTicket.js** - Add 3 indexes (20 minutes)
  ```javascript
  supportTicketSchema.index({ user: 1 });
  supportTicketSchema.index({ status: 1 });
  supportTicketSchema.index({ createdAt: -1 });
  ```

### File Cleanup
- [ ] Delete test files
  ```bash
  git rm schemas/test.js
  git rm schemas/test2.js
  git rm schemas/test3.js
  git commit -m "Remove test schema files from repository"
  ```
  Time estimate: 15 minutes

### Transaction Implementation
- [ ] Add transaction to order creation service
  - [ ] Wrap in session.startTransaction()
  - [ ] Deduct inventory in transaction
  - [ ] Clear cart in transaction
  - [ ] Create payment in transaction
  - [ ] Proper error handling and rollback
  - Time estimate: 2-3 hours

---

## Phase 2: High Priority Fixes (Week 2-3)

### Soft Delete Implementation
- [ ] Add soft delete fields to all schemas
  - [ ] Add isDeleted: Boolean, default: false, index: true
  - [ ] Add deletedAt: Date, sparse: true
  - [ ] Add deletedBy: ObjectId reference, sparse: true
  - Schemas to update: user, product, category, order, cart, review, promotion, shipping, tax, inventory, wishlist, supportTicket, payment
  - Time estimate: 4-6 hours

- [ ] Add pre-find middleware to exclude deleted
  - [ ] Schema.pre('find', excludeDeleted)
  - [ ] Schema.pre('findOne', excludeDeleted)
  - [ ] Schema.pre('aggregate', excludeDeleted)
  - Time estimate: 2-3 hours

### Referential Integrity
- [ ] Implement cascade delete handlers
  - [ ] When Product deleted → archive/delete CartItems
  - [ ] When User deleted → archive/anonymize Orders and Reviews
  - [ ] When Category deleted → unset from Products
  - Time estimate: 3-4 hours

- [ ] Add circular dependency prevention (Category hierarchy)
  - [ ] Add validation on parentCategory save
  - [ ] Check depth limit (max 5 levels)
  - [ ] Prevent self-reference
  - Time estimate: 1-2 hours

### Audit Trail
- [ ] Create Audit schema
  ```javascript
  {
    entity: String,
    entityId: ObjectId,
    action: enum (create, update, delete),
    changes: Map,
    changedBy: ObjectId,
    changedAt: Date,
    ipAddress: String,
    userAgent: String
  }
  ```
  Time estimate: 1-2 hours

- [ ] Add audit logging middleware
  - [ ] Hook into post('save') for create/update
  - [ ] Hook into pre('remove') for delete
  - [ ] Track all field changes
  - Time estimate: 3-4 hours

### Repository Pattern Standardization
- [ ] Choose one pattern (recommend Pattern B - wrapper functions)
- [ ] Convert all Pattern A repos to Pattern B
  - [ ] product.js (10 functions)
  - [ ] cart.js (4 functions)
  - [ ] user.js (4 functions)
  - [ ] category.js (5 functions)
  - [ ] tenantUser.js (3 functions)
  - [ ] tenant.js (4 functions)
  - Time estimate: 8-10 hours

- [ ] Add standardized error handling
  - [ ] Try-catch wrapper for all repo functions
  - [ ] Consistent error response format
  - [ ] Error logging
  - Time estimate: 3-4 hours

### Database Migration Scripts
- [ ] Create migration framework
  - [ ] Timestamp-based migration system
  - [ ] Up/down rollback capability
  - [ ] Migration status tracking
  - Time estimate: 2-3 hours

- [ ] Write initial migrations
  - [ ] Migration: Add missing fields with defaults
  - [ ] Migration: Create indexes
  - [ ] Migration: Data cleanup (fix invalid data)
  - Time estimate: 3-4 hours

---

## Phase 3: Medium Priority Fixes (Week 3-4)

### Enhanced Transactions
- [ ] Add transaction support to all repositories
  - [ ] Accept session parameter in all repo functions
  - [ ] Pass session to all database operations
  - [ ] Document transaction usage patterns
  - Time estimate: 6-8 hours

- [ ] Implement transactions for critical operations
  - [ ] User registration (create + verify email + prefs)
  - [ ] Promotion application (check + increment + apply)
  - [ ] Inventory adjustment (all updates)
  - [ ] Payment processing (payment + order status)
  - Time estimate: 6-8 hours

### Query Optimization Utilities
- [ ] Create query builder utility
  ```javascript
  buildQuery(filters) - handles operators
  buildProjection(fields) - handles field selection
  buildSort(sortBy) - handles sort syntax
  buildPagination(page, limit) - consistent pagination
  ```
  Time estimate: 2-3 hours

- [ ] Implement in all list endpoints
  - [ ] Add optional projection parameter
  - [ ] Add optional populate parameter
  - [ ] Add .lean() for read-only queries
  - [ ] Update all list repositories
  - Time estimate: 4-6 hours

### Pagination Standards
- [ ] Create pagination utility
  ```javascript
  {
    total: Number,
    page: Number,
    pages: Number,
    limit: Number,
    hasNext: Boolean,
    hasPrev: Boolean
  }
  ```
  Time estimate: 1-2 hours

- [ ] Apply to all list operations
  - [ ] Update getProductsRepo
  - [ ] Update getOrdersRepo
  - [ ] Update all list operations
  - [ ] Add validation for page/limit
  - Time estimate: 3-4 hours

### Search Utilities
- [ ] Create full-text search indexes
  - [ ] product: name, description, sku
  - [ ] category: name, description
  - [ ] review: title, comment
  - Time estimate: 1-2 hours

- [ ] Implement search repositories
  - [ ] searchProducts(dbConnection, query, filters, options)
  - [ ] searchCategories(...)
  - [ ] searchReviews(...)
  - [ ] searchOrders(...)
  - Time estimate: 3-4 hours

---

## Phase 4: Low Priority (Week 4+)

### Data Versioning
- [ ] Implement document versioning
  - [ ] Add __v field for CAS
  - [ ] Track historical versions
  - [ ] Implement rollback capability

### Performance Monitoring
- [ ] Add query performance logging
  - [ ] Track slow queries
  - [ ] Monitor index usage
  - [ ] Generate performance reports

### Data Cleanup Jobs
- [ ] Implement cleanup jobs
  - [ ] Archive old deleted records
  - [ ] Compress old audit logs
  - [ ] Clean up expired carts

### Export Utilities
- [ ] CSV export for common entities
  - [ ] Products
  - [ ] Orders
  - [ ] Users
  - [ ] Reviews

---

## Testing Checklist

- [ ] Schema validation tests
  - [ ] Valid data accepted
  - [ ] Invalid data rejected
  - [ ] Boundary conditions tested
  
- [ ] Index tests
  - [ ] Indexes created
  - [ ] Index usage verified
  
- [ ] Transaction tests
  - [ ] Successful commits
  - [ ] Proper rollbacks
  - [ ] Concurrent operations
  
- [ ] Relationship tests
  - [ ] Cascade deletes work
  - [ ] Orphan prevention works
  - [ ] Circular dependencies prevented
  
- [ ] Query performance tests
  - [ ] Index queries < 100ms
  - [ ] Full collection scans identified
  - [ ] N+1 queries eliminated

---

## Deployment Strategy

### Pre-deployment
- [ ] All tests passing
- [ ] Schema changes backward compatible
- [ ] Migration scripts tested
- [ ] Rollback plan documented

### Deployment Phases
1. **Phase 1**: Deploy schema changes + indexes (can be done online)
2. **Phase 2**: Run data migration scripts
3. **Phase 3**: Deploy code changes
4. **Phase 4**: Verify data integrity

### Rollback Plan
- [ ] Index removal (can be done online)
- [ ] Code rollback to previous version
- [ ] Data restoration from backup if needed

---

## Estimated Total Effort

| Phase | Est. Hours | Duration |
|-------|-----------|----------|
| Phase 1: Critical | 30-40 hours | 1-2 weeks |
| Phase 2: High | 40-50 hours | 2-3 weeks |
| Phase 3: Medium | 30-40 hours | 1-2 weeks |
| Phase 4: Low | 20-30 hours | 1-2 weeks |
| **TOTAL** | **120-160 hours** | **6-10 weeks** |

---

## Sign-off

- [ ] Business owner reviewed risks
- [ ] Timeline agreed upon
- [ ] Resource allocation confirmed
- [ ] Go/no-go decision made

