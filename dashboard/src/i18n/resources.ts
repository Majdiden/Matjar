// Auto-aggregates the JSON files in locales/{lang}/*.json. Each
// translation agent appends keys to the JSON files; this file does
// not need to be edited by them.
import enCommon from './locales/en/common.json'
import arCommon from './locales/ar/common.json'
import enNav from './locales/en/nav.json'
import arNav from './locales/ar/nav.json'
import enAuth from './locales/en/auth.json'
import arAuth from './locales/ar/auth.json'
import enDashboard from './locales/en/dashboard.json'
import arDashboard from './locales/ar/dashboard.json'
import enProducts from './locales/en/products.json'
import arProducts from './locales/ar/products.json'
import enOrders from './locales/en/orders.json'
import arOrders from './locales/ar/orders.json'
import enCustomers from './locales/en/customers.json'
import arCustomers from './locales/ar/customers.json'
import enInventory from './locales/en/inventory.json'
import arInventory from './locales/ar/inventory.json'
import enMarketing from './locales/en/marketing.json'
import arMarketing from './locales/ar/marketing.json'
import enAnalytics from './locales/en/analytics.json'
import arAnalytics from './locales/ar/analytics.json'
import enThemes from './locales/en/themes.json'
import arThemes from './locales/ar/themes.json'
import enPages from './locales/en/pages.json'
import arPages from './locales/ar/pages.json'
import enMedia from './locales/en/media.json'
import arMedia from './locales/ar/media.json'
import enRedirects from './locales/en/redirects.json'
import arRedirects from './locales/ar/redirects.json'
import enMenus from './locales/en/menus.json'
import arMenus from './locales/ar/menus.json'
import enDomains from './locales/en/domains.json'
import arDomains from './locales/ar/domains.json'
import enStaff from './locales/en/staff.json'
import arStaff from './locales/ar/staff.json'
import enPayments from './locales/en/payments.json'
import arPayments from './locales/ar/payments.json'
import enSettings from './locales/en/settings.json'
import arSettings from './locales/ar/settings.json'
import enReviews from './locales/en/reviews.json'
import arReviews from './locales/ar/reviews.json'
import enWebhooks from './locales/en/webhooks.json'
import arWebhooks from './locales/ar/webhooks.json'
import enNotifications from './locales/en/notifications.json'
import arNotifications from './locales/ar/notifications.json'
import enCompanies from './locales/en/companies.json'
import arCompanies from './locales/ar/companies.json'
import enSubscriptions from './locales/en/subscriptions.json'
import arSubscriptions from './locales/ar/subscriptions.json'
import enAudit from './locales/en/audit.json'
import arAudit from './locales/ar/audit.json'
import enErrors from './locales/en/errors.json'
import arErrors from './locales/ar/errors.json'

export const resources = {
  en: {
    common: enCommon,
    nav: enNav,
    auth: enAuth,
    dashboard: enDashboard,
    products: enProducts,
    orders: enOrders,
    customers: enCustomers,
    inventory: enInventory,
    marketing: enMarketing,
    analytics: enAnalytics,
    themes: enThemes,
    pages: enPages,
    media: enMedia,
    redirects: enRedirects,
    menus: enMenus,
    domains: enDomains,
    staff: enStaff,
    payments: enPayments,
    settings: enSettings,
    reviews: enReviews,
    webhooks: enWebhooks,
    notifications: enNotifications,
    companies: enCompanies,
    subscriptions: enSubscriptions,
    audit: enAudit,
    errors: enErrors,
  },
  ar: {
    common: arCommon,
    nav: arNav,
    auth: arAuth,
    dashboard: arDashboard,
    products: arProducts,
    orders: arOrders,
    customers: arCustomers,
    inventory: arInventory,
    marketing: arMarketing,
    analytics: arAnalytics,
    themes: arThemes,
    pages: arPages,
    media: arMedia,
    redirects: arRedirects,
    menus: arMenus,
    domains: arDomains,
    staff: arStaff,
    payments: arPayments,
    settings: arSettings,
    reviews: arReviews,
    webhooks: arWebhooks,
    notifications: arNotifications,
    companies: arCompanies,
    subscriptions: arSubscriptions,
    audit: arAudit,
    errors: arErrors,
  },
} as const
