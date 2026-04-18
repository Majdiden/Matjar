# Store Auto-Setup System

## Overview

The Store Auto-Setup system automatically configures new stores with everything they need to start selling immediately:

1. **Domain Registration** - Registers subdomains locally (dev) or with DNS providers (production)
2. **Theme Installation** - Installs and activates a default theme
3. **Sample Data Seeding** - Creates sample categories and products

## How It Works

### Registration Flow

```
User Registers Store
        ↓
Tenant Created in Database
        ↓
Admin User Created
        ↓
Tenant DB Connection Cached
        ↓
[ASYNC] Store Setup Begins
        ↓
    ┌─────────────────────┐
    │ Domain Registration │
    └─────────────────────┘
        ↓
    ┌─────────────────────┐
    │  Theme Installation │
    └─────────────────────┘
        ↓
    ┌─────────────────────┐
    │   Data Seeding      │
    └─────────────────────┘
        ↓
Setup Complete!
```

## Development Environment

### Local Subdomain Access

In development, stores are accessible via `.localhost` subdomains, which work automatically in modern browsers:

**Example:**
- Register a store with subdomain `mystore`
- Access it at: `http://mystore.localhost:3000`

**Benefits:**
- No `/etc/hosts` modifications needed
- No DNS configuration required
- Works immediately after registration

### Custom Local Domains

If you're using a custom local domain (e.g., `.local`), you'll need to update `/etc/hosts`:

```bash
# Add this line to /etc/hosts
127.0.0.1 mystore.matjar.local
```

**Quick command:**
```bash
sudo sh -c 'echo "127.0.0.1 mystore.matjar.local" >> /etc/hosts'
```

## Production Environment

### Domain Registration

In production, the system integrates with DNS providers for automatic domain setup:

**Supported Providers (Planned):**
- Cloudflare API
- AWS Route53
- Vercel/Netlify DNS

**Current Implementation:**
- Returns DNS record instructions
- Manual setup required until provider integration is complete

### Required DNS Records

```
A Record:
  Name: @
  Value: YOUR_SERVER_IP
  TTL: 3600

CNAME Record:
  Name: www
  Value: yourdomain.com
  TTL: 3600

CNAME Record (for subdomains):
  Name: *.yourdomain.com
  Value: yourdomain.com
  TTL: 3600
```

## API Endpoints

### Get Setup Status

Track the progress of store setup in real-time.

```http
GET /api/store-setup/status/:tenantId
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Setup status retrieved successfully",
  "responseObject": {
    "tenantId": "64a1b2c3d4e5f6g7h8i9j0k1",
    "status": "in_progress",
    "currentStep": "data_seeding",
    "steps": {
      "domain_registration": {
        "status": "completed",
        "domain": "mystore.localhost",
        "timestamp": "2025-01-15T10:30:00.000Z"
      },
      "theme_installation": {
        "status": "completed",
        "theme": {
          "id": "theme123",
          "name": "Modern Store",
          "slug": "modern-store"
        },
        "timestamp": "2025-01-15T10:30:05.000Z"
      },
      "data_seeding": {
        "status": "in_progress",
        "timestamp": "2025-01-15T10:30:10.000Z"
      }
    },
    "startedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

### Clear Setup Status

Remove setup status after viewing (cleanup).

```http
DELETE /api/store-setup/status/:tenantId
Authorization: Bearer <token>
```

## Setup Steps Detail

### 1. Domain Registration

**Development:**
- Generates `subdomain.localhost` URL
- No actual DNS changes needed
- Instant availability

**Production:**
- Integrates with DNS provider API
- Creates DNS records automatically
- Waits for DNS propagation (5-30 minutes)

### 2. Theme Installation

- Finds the default theme or first active theme
- Activates theme for the tenant
- Increments theme installation count
- **Skips if no themes available** (non-blocking)

### 3. Sample Data Seeding

Creates sample data for immediate testing:

**Categories Created:**
- Electronics
- Clothing
- Home & Garden

**Products Created:**
- Wireless Bluetooth Headphones ($79.99)
- Classic Cotton T-Shirt ($24.99)
- Ceramic Plant Pot Set ($34.99)
- Smart Watch Pro ($199.99)
- Denim Jacket ($89.99)

**Features:**
- SKUs assigned
- Stock levels set
- Some products marked as featured
- Tags for better organization
- **Skips if data already exists**

## Frontend Integration

### During Registration

Show a loading modal with setup progress:

```typescript
// After successful registration
const { tenantId } = response.responseObject;

// Poll for setup status
const checkStatus = setInterval(async () => {
  const status = await api.get(`/store-setup/status/${tenantId}`);

  if (status.data.status === 'completed') {
    clearInterval(checkStatus);
    // Redirect to store or dashboard
    window.location.href = `http://${subdomain}.localhost:3000`;
  }

  if (status.data.status === 'failed') {
    clearInterval(checkStatus);
    // Show error message
  }

  // Update UI with current step
  updateProgressUI(status.data);
}, 2000);
```

### Progress UI States

```tsx
{currentStep === 'domain_registration' && (
  <div>
    <Loader />
    <p>Setting up your domain...</p>
  </div>
)}

{currentStep === 'theme_installation' && (
  <div>
    <Loader />
    <p>Installing theme...</p>
  </div>
)}

{currentStep === 'data_seeding' && (
  <div>
    <Loader />
    <p>Adding sample products...</p>
  </div>
)}

{status === 'completed' && (
  <div>
    <CheckCircle />
    <p>Your store is ready!</p>
    <Button onClick={() => visitStore()}>
      Visit Your Store
    </Button>
  </div>
)}
```

## Configuration

### Environment Variables

```env
# Domain configuration
BASE_DOMAIN=localhost          # Development
# BASE_DOMAIN=matjar.com       # Production

DOMAIN_SUFFIX=localhost        # Development
# DOMAIN_SUFFIX=matjar.com     # Production

# Database
ADMIN_DB_URI=mongodb://localhost:27017/Matjar
TENANT_DB_BASE_URI=mongodb://localhost:27017

# Node environment
NODE_ENV=development
```

### Disabling Auto-Setup

To disable automatic setup (for testing), you can modify `services/tenant.js`:

```javascript
// Comment out this line:
initializeStoreSetup(data, tenantDbConnection).catch((error) => {
  console.error(`[Tenant] Store setup failed for ${data.name}:`, error);
});
```

## Troubleshooting

### Store not accessible after registration

**Check:**
1. Server is running on correct port
2. Using `.localhost` domain (not `.local` or custom)
3. Browser supports `.localhost` (most modern browsers do)
4. No firewall blocking localhost connections

**Solution for custom domains:**
```bash
# Add to /etc/hosts
sudo sh -c 'echo "127.0.0.1 mystore.matjar.local" >> /etc/hosts'
```

### Setup status not found

**Cause:** Setup completed and status was cleared

**Solution:** Check if tenant exists in database - if yes, setup completed successfully

### Theme installation failed

**Cause:** No themes available in database

**Solution:** Add themes to the database or skip theme installation (non-critical)

### Data seeding failed

**Cause:** Database connection issue or schema mismatch

**Solution:** Check logs for specific error, verify schemas are loaded

## Best Practices

1. **Always use .localhost in development** - Avoids DNS issues
2. **Monitor setup logs** - Check console for setup progress
3. **Clear setup status** - After viewing to free memory
4. **Test with multiple stores** - Ensure isolation works correctly
5. **Use environment variables** - Never hardcode domains

## Future Enhancements

- [ ] WebSocket support for real-time progress updates
- [ ] Cloudflare API integration for production DNS
- [ ] AWS Route53 integration
- [ ] Custom theme selection during registration
- [ ] Advanced sample data options
- [ ] Automatic SSL certificate provisioning
- [ ] Email notifications on setup completion
- [ ] Rollback on setup failure
- [ ] Setup retry mechanism
