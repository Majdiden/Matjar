/**
 * Section Library Service
 * Defines available section types with default configurations
 */

import { v4 as uuidv4 } from "uuid";

/**
 * Available section types with metadata and default settings
 */
export const SECTION_TYPES = {
  // Content Sections
  hero: {
    name: "Hero Banner",
    description: "Large banner with heading, subheading, and call-to-action",
    category: "content",
    icon: "🎯",
    defaultSettings: {
      heading: "Welcome to Our Store",
      subheading: "Discover amazing products at great prices",
      buttonText: "Shop Now",
      buttonLink: "/products",
      imageUrl: "",
      backgroundColor: "#f3f4f6",
      textColor: "#1f2937",
      layout: "full-width",
      padding: "4rem 0",
    },
    defaultElements: [
      {
        id: "heading",
        type: "text",
        order: 0,
        content: "Welcome to Our Store",
        styles: {
          fontSize: "3rem",
          fontWeight: "bold",
          textAlign: "center",
        },
      },
      {
        id: "subheading",
        type: "text",
        order: 1,
        content: "Discover amazing products at great prices",
        styles: {
          fontSize: "1.25rem",
          textAlign: "center",
        },
      },
      {
        id: "cta-button",
        type: "button",
        order: 2,
        content: "Shop Now",
        styles: {
          backgroundColor: "#2563eb",
          color: "#ffffff",
          padding: "0.75rem 2rem",
        },
      },
    ],
  },

  banner: {
    name: "Promotional Banner",
    description: "Announcement or promotional banner",
    category: "content",
    icon: "🖼️",
    defaultSettings: {
      heading: "Special Offer!",
      content: "Free shipping on orders over $50",
      backgroundColor: "#2563eb",
      textColor: "#ffffff",
      layout: "full-width",
      padding: "1rem 0",
    },
    defaultElements: [
      {
        id: "banner-text",
        type: "text",
        order: 0,
        content: "Free shipping on orders over $50",
        styles: {
          fontSize: "1rem",
          textAlign: "center",
          color: "#ffffff",
        },
      },
    ],
  },

  // E-commerce Sections
  "featured-products": {
    name: "Featured Products",
    description: "Showcase featured or selected products",
    category: "ecommerce",
    icon: "⭐",
    defaultSettings: {
      heading: "Featured Products",
      subheading: "Check out our top picks",
      productLimit: 8,
      sortBy: "featured",
      displayStyle: "grid",
      layout: "contained",
      padding: "3rem 0",
    },
    defaultElements: [],
  },

  "new-arrivals": {
    name: "New Arrivals",
    description: "Display recently added products",
    category: "ecommerce",
    icon: "🆕",
    defaultSettings: {
      heading: "New Arrivals",
      subheading: "Discover what's new",
      productLimit: 12,
      sortBy: "newest",
      displayStyle: "grid",
      layout: "contained",
      padding: "3rem 0",
    },
    defaultElements: [],
  },

  "product-grid": {
    name: "Product Grid",
    description: "Customizable product display grid",
    category: "ecommerce",
    icon: "📦",
    defaultSettings: {
      heading: "Our Products",
      productLimit: 12,
      categoryIds: [],
      sortBy: "popularity",
      displayStyle: "grid",
      layout: "contained",
      padding: "3rem 0",
    },
    defaultElements: [],
  },

  categories: {
    name: "Category Showcase",
    description: "Display product categories",
    category: "ecommerce",
    icon: "📁",
    defaultSettings: {
      heading: "Shop by Category",
      subheading: "Browse our collections",
      displayStyle: "grid",
      layout: "contained",
      padding: "3rem 0",
    },
    defaultElements: [],
  },

  "best-sellers": {
    name: "Best Sellers",
    description: "Top selling products",
    category: "ecommerce",
    icon: "🔥",
    defaultSettings: {
      heading: "Best Sellers",
      subheading: "Our most popular items",
      productLimit: 8,
      sortBy: "best-selling",
      displayStyle: "grid",
      layout: "contained",
      padding: "3rem 0",
    },
    defaultElements: [],
  },

  // Engagement Sections
  testimonials: {
    name: "Testimonials",
    description: "Customer reviews and testimonials",
    category: "engagement",
    icon: "💬",
    defaultSettings: {
      heading: "What Our Customers Say",
      subheading: "Real reviews from real customers",
      backgroundColor: "#f9fafb",
      layout: "contained",
      padding: "3rem 0",
    },
    defaultElements: [
      {
        id: "testimonial-1",
        type: "testimonial",
        order: 0,
        content: {
          text: "Amazing products and great service!",
          author: "Jane Doe",
          rating: 5,
        },
        styles: {},
      },
    ],
  },

  newsletter: {
    name: "Newsletter Signup",
    description: "Email subscription form",
    category: "engagement",
    icon: "📧",
    defaultSettings: {
      heading: "Stay Updated",
      subheading: "Subscribe to our newsletter for exclusive offers",
      backgroundColor: "#2563eb",
      textColor: "#ffffff",
      buttonText: "Subscribe",
      layout: "contained",
      padding: "3rem 0",
    },
    defaultElements: [
      {
        id: "email-input",
        type: "input",
        order: 0,
        content: {
          placeholder: "Enter your email",
          type: "email",
        },
        styles: {},
      },
      {
        id: "submit-button",
        type: "button",
        order: 1,
        content: "Subscribe",
        styles: {
          backgroundColor: "#1e40af",
          color: "#ffffff",
        },
      },
    ],
  },

  features: {
    name: "Features",
    description: "Highlight key features or benefits",
    category: "content",
    icon: "✨",
    defaultSettings: {
      heading: "Why Choose Us",
      layout: "contained",
      padding: "3rem 0",
    },
    defaultElements: [
      {
        id: "feature-1",
        type: "feature",
        order: 0,
        content: {
          icon: "🚚",
          title: "Free Shipping",
          description: "On orders over $50",
        },
        styles: {},
      },
      {
        id: "feature-2",
        type: "feature",
        order: 1,
        content: {
          icon: "🔒",
          title: "Secure Payment",
          description: "100% secure transactions",
        },
        styles: {},
      },
      {
        id: "feature-3",
        type: "feature",
        order: 2,
        content: {
          icon: "↩️",
          title: "Easy Returns",
          description: "30-day return policy",
        },
        styles: {},
      },
    ],
  },

  "image-gallery": {
    name: "Image Gallery",
    description: "Showcase images in a gallery layout",
    category: "content",
    icon: "🖼️",
    defaultSettings: {
      heading: "Gallery",
      displayStyle: "grid",
      layout: "contained",
      padding: "3rem 0",
    },
    defaultElements: [],
  },

  video: {
    name: "Video Section",
    description: "Embed video content",
    category: "content",
    icon: "🎥",
    defaultSettings: {
      heading: "Watch Our Story",
      videoUrl: "",
      layout: "contained",
      padding: "3rem 0",
    },
    defaultElements: [
      {
        id: "video-embed",
        type: "video",
        order: 0,
        content: {
          url: "",
          autoplay: false,
        },
        styles: {
          width: "100%",
          height: "auto",
        },
      },
    ],
  },

  brands: {
    name: "Brand Showcase",
    description: "Display partner or product brands",
    category: "content",
    icon: "🏷️",
    defaultSettings: {
      heading: "Our Brands",
      backgroundColor: "#ffffff",
      layout: "contained",
      padding: "2rem 0",
    },
    defaultElements: [],
  },
};

/**
 * Get all available section types
 */
export const getAllSectionTypes = () => {
  return Object.entries(SECTION_TYPES).map(([key, value]) => ({
    type: key,
    ...value,
  }));
};

/**
 * Get section types by category
 */
export const getSectionTypesByCategory = (category) => {
  return Object.entries(SECTION_TYPES)
    .filter(([_, value]) => value.category === category)
    .map(([key, value]) => ({
      type: key,
      ...value,
    }));
};

/**
 * Get section type details
 */
export const getSectionType = (type) => {
  return SECTION_TYPES[type] || null;
};

/**
 * Create a new section instance with default values
 */
export const createSectionInstance = (type, customSettings = {}) => {
  const sectionType = getSectionType(type);

  if (!sectionType) {
    throw new Error(`Unknown section type: ${type}`);
  }

  // Generate unique ID for section
  const sectionId = `${type}-${uuidv4().slice(0, 8)}`;

  // Create elements with unique IDs
  const elements = sectionType.defaultElements.map((element, index) => ({
    ...element,
    id: `${sectionId}-${element.id || `element-${index}`}`,
  }));

  return {
    id: sectionId,
    type,
    enabled: true,
    order: customSettings.order || 0,
    layout: sectionType.defaultSettings.layout || "full-width",
    settings: {
      ...sectionType.defaultSettings,
      ...customSettings,
    },
    elements,
  };
};

/**
 * Validate section configuration
 */
export const validateSection = (section) => {
  const errors = [];

  if (!section.id) {
    errors.push("Section ID is required");
  }

  if (!section.type) {
    errors.push("Section type is required");
  }

  if (section.type && !SECTION_TYPES[section.type]) {
    errors.push(`Invalid section type: ${section.type}`);
  }

  if (typeof section.order !== "number") {
    errors.push("Section order must be a number");
  }

  if (typeof section.enabled !== "boolean") {
    errors.push("Section enabled must be a boolean");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Get categories
 */
export const getSectionCategories = () => {
  return [
    { id: "content", name: "Content", description: "General content sections" },
    {
      id: "ecommerce",
      name: "E-commerce",
      description: "Product and shopping sections",
    },
    {
      id: "engagement",
      name: "Engagement",
      description: "Customer engagement sections",
    },
  ];
};
