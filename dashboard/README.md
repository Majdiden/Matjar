# Matjar Dashboard

A modern, responsive e-commerce store management dashboard built with React, TypeScript, and Tailwind CSS.

## 🚀 Features

### ✅ Implemented
- **Authentication**
  - Login with domain, email, and password
  - Registration with subdomain availability check
  - JWT token management
  - Protected routes

- **Dashboard Layout**
  - Responsive sidebar navigation
  - Mobile-friendly hamburger menu
  - User profile section
  - Breadcrumb navigation

- **Dashboard Home**
  - Statistics cards (products, orders, revenue, growth)
  - Domain information banner
  - Quick actions grid
  - Getting started guide for new stores

- **Domain Management** 🎯
  - View active domain and all domains
  - Subdomain management (view, update)
  - Custom domain support (add, verify, remove)
  - DNS verification instructions with copy-to-clipboard
  - SSL certificate management
  - Primary domain selection
  - Subscription-based access control

- **UI Components**
  - Button (multiple variants and sizes)
  - Input, Label
  - Card components
  - Loading states
  - Error and success messages

### 🚧 Coming Soon
- Product management (CRUD operations)
- Category management
- Order management
- Theme customization
- Advanced analytics

## ⚙️ Setup

### Prerequisites
- Node.js 18+
- Backend API running on `http://localhost:3000`

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   ```

   Edit `.env`:
   ```env
   VITE_API_BASE_URL=http://localhost:3000/api
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Open browser:**
   ```
   http://localhost:5173
   ```

## 🚀 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## 🌐 Domain Management

### Subdomain
- Free for all plans: `storename.matjar.to`
- Instant activation
- Can be updated anytime

### Custom Domain (Pro/Enterprise)
- Connect your own domain (e.g., `mystore.com`)
- DNS verification via TXT record
- SSL certificate support
- Set as primary domain

## 📁 Project Structure

```
dashboard/
├── src/
│   ├── components/
│   │   ├── layouts/DashboardLayout.tsx
│   │   ├── ui/                      # UI components
│   │   └── ProtectedRoute.tsx
│   ├── contexts/AuthContext.tsx
│   ├── lib/
│   │   ├── api-client.ts            # HTTP client
│   │   └── utils.ts
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   └── domains/Domains.tsx
│   ├── types/index.ts
│   └── App.tsx
├── .env
└── package.json
```

## 🐛 Troubleshooting

### API Connection Issues
Ensure backend is running on `http://localhost:3000`

### CORS Errors
Configure CORS in backend to allow `http://localhost:5173`

## 📝 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API URL | `http://localhost:3000/api` |

---

**Built for Matjar E-commerce Platform**
