/**
 * Theme demo FIXTURES (mock dev server)
 * ─────────────────────────────────────
 * Standalone copy of the niche demo catalog data literals extracted from
 * `services/themeDemoData.js` (audit 2.6). The mock dev server
 * (`mockServer.mjs`) serves these fixtures so a theme can be developed
 * with realistic per-niche content and ZERO backend (no Mongo/Redis).
 *
 * This is a deliberate COPY, not an import: the mock server must not pull
 * in any backend code (mongoose/logger/config). Keep in rough sync with
 * the source when the demo catalog changes — drift only affects local
 * theme dev, never production.
 *
 * Shape per slug: { categories:[...], products:[...], collections:[...], media:{...} }
 */

export const THEME_DEMO_DATA = {
  "techhub": {
    "categories": [
      {
        "name": "Smartphones",
        "slug": "smartphones",
        "description": "Flagship phones and the latest mobile tech.",
        "image": "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=900&q=80&auto=format&fit=crop"
      },
      {
        "name": "Laptops",
        "slug": "laptops",
        "description": "Ultrabooks, creator machines and everyday notebooks.",
        "image": "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=900&q=80&auto=format&fit=crop"
      },
      {
        "name": "Audio",
        "slug": "audio",
        "description": "Headphones, earbuds and speakers.",
        "image": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&q=80&auto=format&fit=crop"
      },
      {
        "name": "Wearables",
        "slug": "wearables",
        "description": "Smartwatches and fitness trackers.",
        "image": "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=900&q=80&auto=format&fit=crop"
      }
    ],
    "products": [
      {
        "name": "Aurora Pro 5G Smartphone",
        "slug": "aurora-pro-5g",
        "description": "A titanium-framed flagship with a 6.1\" ProMotion display, triple 48MP camera system and all-day battery.",
        "shortDescription": "Titanium. Fast. Pro camera.",
        "price": 999,
        "compareAtPrice": 1099,
        "categorySlug": "smartphones",
        "stock": 40,
        "rating": 4.8,
        "reviewCount": 2104,
        "featured": true,
        "newArrival": true,
        "tags": [
          "5g",
          "flagship"
        ],
        "images": [
          "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=900&q=80&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Stratus Air 13 Laptop",
        "slug": "stratus-air-13",
        "description": "Strikingly thin 13\" ultrabook with a fanless chip, Liquid-Retina-class panel and 18-hour battery.",
        "price": 1199,
        "categorySlug": "laptops",
        "stock": 25,
        "rating": 4.7,
        "reviewCount": 832,
        "featured": true,
        "tags": [
          "ultrabook"
        ],
        "images": [
          "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=900&q=80&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Pulse Pro Wireless Earbuds",
        "slug": "pulse-pro-earbuds",
        "description": "Adaptive active noise cancellation, spatial audio and 30 hours of total playtime in a pocketable case.",
        "price": 249,
        "categorySlug": "audio",
        "stock": 120,
        "rating": 4.8,
        "reviewCount": 4521,
        "featured": true,
        "tags": [
          "anc",
          "earbuds"
        ],
        "images": [
          "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&q=80&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Halo Over-Ear Headphones",
        "slug": "halo-over-ear",
        "description": "Industry-leading noise cancellation with plush memory-foam cups and 30-hour battery.",
        "price": 399,
        "compareAtPrice": 449,
        "categorySlug": "audio",
        "stock": 60,
        "rating": 4.8,
        "reviewCount": 3210,
        "tags": [
          "anc",
          "over-ear"
        ],
        "images": [
          "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Vita Smartwatch Series 9",
        "slug": "vita-smartwatch-9",
        "description": "Always-on retina display, advanced health sensors and a brighter screen for the outdoors.",
        "price": 399,
        "compareAtPrice": 429,
        "categorySlug": "wearables",
        "stock": 80,
        "rating": 4.8,
        "reviewCount": 2104,
        "newArrival": true,
        "tags": [
          "smartwatch",
          "fitness"
        ],
        "images": [
          "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=900&q=80&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Nimbus Tab 11",
        "slug": "nimbus-tab-11",
        "description": "An 11\" tablet with a laminated display and all-day battery — perfect for work and play.",
        "price": 599,
        "categorySlug": "laptops",
        "stock": 35,
        "rating": 4.6,
        "reviewCount": 412,
        "tags": [
          "tablet"
        ],
        "images": [
          "https://images.unsplash.com/photo-1561154464-82e9adf32764?w=900&q=80&auto=format&fit=crop"
        ]
      }
    ],
    "collections": [
      {
        "title": "New Arrivals",
        "handle": "new-arrivals",
        "description": "The latest drops in tech.",
        "image": "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "aurora-pro-5g",
          "vita-smartwatch-9",
          "nimbus-tab-11"
        ]
      },
      {
        "title": "Best Sellers",
        "handle": "best-sellers",
        "description": "Our most-loved gadgets.",
        "image": "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "pulse-pro-earbuds",
          "halo-over-ear",
          "stratus-air-13"
        ]
      },
      {
        "title": "On Sale",
        "handle": "on-sale",
        "description": "Limited-time deals on top tech.",
        "image": "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "aurora-pro-5g",
          "halo-over-ear"
        ]
      }
    ],
    "media": {
      "heroImage": "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=1600&q=80&auto=format&fit=crop",
      "bannerImages": [
        "https://images.unsplash.com/photo-1593344484962-796055d4a3a4?w=1600&q=80&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=1600&q=80&auto=format&fit=crop"
      ]
    }
  },
  "modern": {
    "categories": [
      {
        "name": "Gadgets",
        "slug": "gadgets",
        "description": "Smart everyday tech.",
        "image": "https://images.unsplash.com/photo-1625948515291-69613efd103f?w=900&q=80&auto=format&fit=crop"
      },
      {
        "name": "Audio",
        "slug": "audio",
        "description": "Speakers and personal audio.",
        "image": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&q=80&auto=format&fit=crop"
      },
      {
        "name": "Accessories",
        "slug": "accessories",
        "description": "Keyboards, hubs and chargers.",
        "image": "https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=900&q=80&auto=format&fit=crop"
      }
    ],
    "products": [
      {
        "name": "Echo Mini Smart Speaker",
        "slug": "echo-mini-speaker",
        "description": "Room-filling 360° sound and a built-in voice assistant in a compact, fabric-wrapped design.",
        "price": 99,
        "compareAtPrice": 129,
        "categorySlug": "audio",
        "stock": 90,
        "rating": 4.6,
        "reviewCount": 891,
        "featured": true,
        "onSale": true,
        "tags": [
          "smart-speaker"
        ],
        "images": [
          "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Glide Wireless Earbuds",
        "slug": "glide-earbuds",
        "description": "Lightweight true-wireless earbuds with secure-fit tips and 24-hour battery.",
        "price": 79,
        "categorySlug": "audio",
        "stock": 150,
        "rating": 4.4,
        "reviewCount": 1284,
        "tags": [
          "earbuds"
        ],
        "images": [
          "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Click Mechanical Keyboard",
        "slug": "click-mechanical-keyboard",
        "description": "A compact 75% mechanical keyboard with hot-swap switches and per-key RGB.",
        "price": 119,
        "categorySlug": "accessories",
        "stock": 70,
        "rating": 4.7,
        "reviewCount": 624,
        "featured": true,
        "tags": [
          "keyboard"
        ],
        "images": [
          "https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Volt 20K Power Bank",
        "slug": "volt-20k-power-bank",
        "description": "20,000mAh portable charger with 65W USB-C output and a smart battery display.",
        "price": 59,
        "compareAtPrice": 79,
        "categorySlug": "gadgets",
        "stock": 200,
        "rating": 4.7,
        "reviewCount": 1876,
        "onSale": true,
        "tags": [
          "charging"
        ],
        "images": [
          "https://images.unsplash.com/photo-1625948515291-69613efd103f?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Orbit Fitness Smartwatch",
        "slug": "orbit-fitness-smartwatch",
        "description": "Heart-rate, GPS and 7-day battery in a slim, swim-proof case.",
        "price": 159,
        "categorySlug": "gadgets",
        "stock": 85,
        "rating": 4.5,
        "reviewCount": 487,
        "newArrival": true,
        "tags": [
          "smartwatch"
        ],
        "images": [
          "https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Stream 4K Webcam",
        "slug": "stream-4k-webcam",
        "description": "Crisp 4K video with auto-framing and dual noise-cancelling mics for calls and streaming.",
        "price": 129,
        "categorySlug": "accessories",
        "stock": 60,
        "rating": 4.5,
        "reviewCount": 268,
        "tags": [
          "webcam"
        ],
        "images": [
          "https://images.unsplash.com/photo-1625948515291-69613efd103f?w=900&q=80&auto=format&fit=crop"
        ]
      }
    ],
    "collections": [
      {
        "title": "New Arrivals",
        "handle": "new-arrivals",
        "description": "Fresh tech, just in.",
        "image": "https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "orbit-fitness-smartwatch",
          "stream-4k-webcam"
        ]
      },
      {
        "title": "On Sale",
        "handle": "on-sale",
        "description": "Save on smart everyday tech.",
        "image": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "echo-mini-speaker",
          "volt-20k-power-bank"
        ]
      },
      {
        "title": "Editor's Picks",
        "handle": "editors-picks",
        "description": "Staff-favorite gear.",
        "image": "https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "click-mechanical-keyboard",
          "echo-mini-speaker"
        ]
      }
    ],
    "media": {
      "heroImage": "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=1600&q=80&auto=format&fit=crop",
      "bannerImages": [
        "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=1600&q=80&auto=format&fit=crop"
      ]
    }
  },
  "starter": {
    "categories": [
      {
        "name": "Electronics",
        "slug": "electronics",
        "description": "Everyday consumer electronics.",
        "image": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&q=80&auto=format&fit=crop"
      },
      {
        "name": "Accessories",
        "slug": "accessories",
        "description": "Add-ons for your devices.",
        "image": "https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=900&q=80&auto=format&fit=crop"
      }
    ],
    "products": [
      {
        "name": "Boombox Portable Speaker",
        "slug": "boombox-portable-speaker",
        "description": "A rugged, waterproof Bluetooth speaker with deep bass and 16 hours of playtime.",
        "price": 89,
        "compareAtPrice": 109,
        "categorySlug": "electronics",
        "stock": 110,
        "rating": 4.5,
        "reviewCount": 932,
        "featured": true,
        "onSale": true,
        "tags": [
          "speaker"
        ],
        "images": [
          "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Glide Wireless Mouse",
        "slug": "glide-wireless-mouse",
        "description": "Ergonomic silent-click mouse with 8K DPI tracking on any surface.",
        "price": 39,
        "categorySlug": "accessories",
        "stock": 180,
        "rating": 4.8,
        "reviewCount": 3421,
        "tags": [
          "mouse"
        ],
        "images": [
          "https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Hub-7 USB-C Adapter",
        "slug": "hub-7-usb-c",
        "description": "7-in-1 USB-C hub with HDMI, card readers and 100W passthrough charging.",
        "price": 49,
        "categorySlug": "accessories",
        "stock": 130,
        "rating": 4.6,
        "reviewCount": 612,
        "tags": [
          "hub"
        ],
        "images": [
          "https://images.unsplash.com/photo-1625948515291-69613efd103f?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Quiet Noise-Cancelling Headphones",
        "slug": "quiet-nc-headphones",
        "description": "Comfortable over-ear headphones with active noise cancelling and 35-hour battery.",
        "price": 149,
        "categorySlug": "electronics",
        "stock": 75,
        "rating": 4.6,
        "reviewCount": 1102,
        "featured": true,
        "tags": [
          "headphones",
          "anc"
        ],
        "images": [
          "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Charge Pad Wireless Charger",
        "slug": "charge-pad-wireless",
        "description": "Slim 15W Qi wireless charging pad with non-slip surface.",
        "price": 29,
        "categorySlug": "accessories",
        "stock": 220,
        "rating": 4.4,
        "reviewCount": 540,
        "tags": [
          "charging"
        ],
        "images": [
          "https://images.unsplash.com/photo-1625948515291-69613efd103f?w=900&q=80&auto=format&fit=crop"
        ]
      }
    ],
    "collections": [
      {
        "title": "New Arrivals",
        "handle": "new-arrivals",
        "description": "Just landed.",
        "image": "https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "charge-pad-wireless",
          "hub-7-usb-c"
        ]
      },
      {
        "title": "On Sale",
        "handle": "on-sale",
        "description": "Everyday savings.",
        "image": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "boombox-portable-speaker",
          "quiet-nc-headphones"
        ]
      }
    ],
    "media": {
      "heroImage": "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=1600&q=80&auto=format&fit=crop",
      "bannerImages": [
        "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=1600&q=80&auto=format&fit=crop"
      ]
    }
  },
  "elegance": {
    "categories": [
      {
        "name": "Womenswear",
        "slug": "womenswear",
        "description": "Refined everyday and occasion pieces.",
        "image": "https://images.unsplash.com/photo-1485462537746-965f33f7f6a7?w=900&q=80&auto=format&fit=crop"
      },
      {
        "name": "Menswear",
        "slug": "menswear",
        "description": "Tailored essentials and modern staples.",
        "image": "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=900&q=80&auto=format&fit=crop"
      },
      {
        "name": "Accessories",
        "slug": "accessories",
        "description": "Bags, scarves and finishing touches.",
        "image": "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=900&q=80&auto=format&fit=crop"
      }
    ],
    "products": [
      {
        "name": "Silk Slip Dress",
        "slug": "silk-slip-dress",
        "description": "A bias-cut silk slip dress with a fluid drape — effortless from desk to dinner.",
        "price": 189,
        "compareAtPrice": 240,
        "categorySlug": "womenswear",
        "stock": 40,
        "rating": 4.7,
        "reviewCount": 218,
        "featured": true,
        "onSale": true,
        "tags": [
          "dress",
          "silk"
        ],
        "images": [
          "https://images.unsplash.com/photo-1485462537746-965f33f7f6a7?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Tailored Wool Blazer",
        "slug": "tailored-wool-blazer",
        "description": "A single-breasted wool-blend blazer with a structured shoulder and clean lapel.",
        "price": 245,
        "categorySlug": "menswear",
        "stock": 30,
        "rating": 4.8,
        "reviewCount": 164,
        "featured": true,
        "tags": [
          "blazer"
        ],
        "images": [
          "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Cashmere Crew Sweater",
        "slug": "cashmere-crew-sweater",
        "description": "Pure cashmere knit in a relaxed crew-neck — light, warm and endlessly soft.",
        "price": 159,
        "categorySlug": "womenswear",
        "stock": 55,
        "rating": 4.7,
        "reviewCount": 287,
        "tags": [
          "knitwear"
        ],
        "images": [
          "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Classic Trench Coat",
        "slug": "classic-trench-coat",
        "description": "A water-resistant cotton-gabardine trench with a timeless double-breasted cut.",
        "price": 320,
        "compareAtPrice": 390,
        "categorySlug": "womenswear",
        "stock": 25,
        "rating": 4.9,
        "reviewCount": 142,
        "onSale": true,
        "tags": [
          "coat"
        ],
        "images": [
          "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Leather Tote Bag",
        "slug": "leather-tote-bag",
        "description": "A full-grain leather tote roomy enough for the everyday, with a structured silhouette.",
        "price": 210,
        "categorySlug": "accessories",
        "stock": 45,
        "rating": 4.6,
        "reviewCount": 198,
        "tags": [
          "bag",
          "leather"
        ],
        "images": [
          "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Crisp Linen Shirt",
        "slug": "crisp-linen-shirt",
        "description": "A breathable European-linen shirt with mother-of-pearl buttons.",
        "price": 95,
        "categorySlug": "menswear",
        "stock": 80,
        "rating": 4.5,
        "reviewCount": 233,
        "newArrival": true,
        "tags": [
          "shirt",
          "linen"
        ],
        "images": [
          "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=900&q=80&auto=format&fit=crop"
        ]
      }
    ],
    "collections": [
      {
        "title": "New Arrivals",
        "handle": "new-arrivals",
        "description": "The latest season, just in.",
        "image": "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "silk-slip-dress",
          "crisp-linen-shirt"
        ]
      },
      {
        "title": "On Sale",
        "handle": "on-sale",
        "description": "Refined pieces, reduced.",
        "image": "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "silk-slip-dress",
          "classic-trench-coat"
        ]
      },
      {
        "title": "Editor's Picks",
        "handle": "editors-picks",
        "description": "Our wardrobe edit.",
        "image": "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "tailored-wool-blazer",
          "leather-tote-bag",
          "cashmere-crew-sweater"
        ]
      }
    ],
    "media": {
      "heroImage": "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1600&q=80&auto=format&fit=crop",
      "bannerImages": [
        "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1600&q=80&auto=format&fit=crop"
      ]
    }
  },
  "beauxe": {
    "categories": [
      {
        "name": "Cosmetics",
        "slug": "cosmetics",
        "description": "Makeup for every look.",
        "image": "https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=900&q=80&auto=format&fit=crop"
      },
      {
        "name": "Fragrance",
        "slug": "fragrance",
        "description": "Signature scents.",
        "image": "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=900&q=80&auto=format&fit=crop"
      },
      {
        "name": "Accessories",
        "slug": "accessories",
        "description": "Scarves, jewelry and more.",
        "image": "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=900&q=80&auto=format&fit=crop"
      }
    ],
    "products": [
      {
        "name": "Velvet Matte Lipstick Set",
        "slug": "velvet-matte-lipstick-set",
        "description": "A set of four long-wear matte lipsticks in everyday-to-evening shades.",
        "price": 48,
        "compareAtPrice": 64,
        "categorySlug": "cosmetics",
        "stock": 130,
        "rating": 4.7,
        "reviewCount": 642,
        "featured": true,
        "onSale": true,
        "tags": [
          "lipstick"
        ],
        "images": [
          "https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Luminous Eyeshadow Palette",
        "slug": "luminous-eyeshadow-palette",
        "description": "Twelve blendable shades — mattes, satins and shimmers — in a mirrored compact.",
        "price": 56,
        "categorySlug": "cosmetics",
        "stock": 90,
        "rating": 4.8,
        "reviewCount": 421,
        "featured": true,
        "tags": [
          "eyeshadow"
        ],
        "images": [
          "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Noir Eau de Parfum",
        "slug": "noir-eau-de-parfum",
        "description": "A warm amber-and-vanilla eau de parfum with notes of jasmine and sandalwood.",
        "price": 120,
        "categorySlug": "fragrance",
        "stock": 60,
        "rating": 4.6,
        "reviewCount": 318,
        "tags": [
          "perfume"
        ],
        "images": [
          "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Silk Foundation SPF 20",
        "slug": "silk-foundation-spf20",
        "description": "A buildable, skin-true foundation with a soft-focus finish and broad-spectrum SPF.",
        "price": 42,
        "categorySlug": "cosmetics",
        "stock": 100,
        "rating": 4.5,
        "reviewCount": 512,
        "tags": [
          "foundation"
        ],
        "images": [
          "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Printed Silk Scarf",
        "slug": "printed-silk-scarf",
        "description": "A hand-rolled silk twill scarf in a painterly print.",
        "price": 75,
        "categorySlug": "accessories",
        "stock": 50,
        "rating": 4.7,
        "reviewCount": 174,
        "newArrival": true,
        "tags": [
          "scarf",
          "silk"
        ],
        "images": [
          "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Gold Statement Earrings",
        "slug": "gold-statement-earrings",
        "description": "18k-gold-plated drop earrings with a hammered, light-catching finish.",
        "price": 38,
        "categorySlug": "accessories",
        "stock": 85,
        "rating": 4.6,
        "reviewCount": 209,
        "tags": [
          "jewelry"
        ],
        "images": [
          "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=900&q=80&auto=format&fit=crop"
        ]
      }
    ],
    "collections": [
      {
        "title": "New Arrivals",
        "handle": "new-arrivals",
        "description": "Fresh beauty drops.",
        "image": "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "printed-silk-scarf",
          "luminous-eyeshadow-palette"
        ]
      },
      {
        "title": "Best Sellers",
        "handle": "best-sellers",
        "description": "Our cult favorites.",
        "image": "https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "velvet-matte-lipstick-set",
          "silk-foundation-spf20"
        ]
      },
      {
        "title": "On Sale",
        "handle": "on-sale",
        "description": "Beauty steals.",
        "image": "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "velvet-matte-lipstick-set"
        ]
      }
    ],
    "media": {
      "heroImage": "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=1600&q=80&auto=format&fit=crop",
      "bannerImages": [
        "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=1600&q=80&auto=format&fit=crop"
      ]
    }
  },
  "glowing": {
    "categories": [
      {
        "name": "Skincare",
        "slug": "skincare",
        "description": "Daily cleansers and moisturizers.",
        "image": "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=900&q=80&auto=format&fit=crop"
      },
      {
        "name": "Serums",
        "slug": "serums",
        "description": "Targeted treatments.",
        "image": "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=900&q=80&auto=format&fit=crop"
      },
      {
        "name": "Masks & SPF",
        "slug": "masks-spf",
        "description": "Masks and sun protection.",
        "image": "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=900&q=80&auto=format&fit=crop"
      }
    ],
    "products": [
      {
        "name": "Glow Vitamin C Serum",
        "slug": "glow-vitamin-c-serum",
        "description": "A 15% vitamin C serum that brightens dull skin and evens tone over time.",
        "price": 34,
        "compareAtPrice": 45,
        "categorySlug": "serums",
        "stock": 140,
        "rating": 4.7,
        "reviewCount": 1320,
        "featured": true,
        "onSale": true,
        "tags": [
          "serum",
          "vitamin-c"
        ],
        "images": [
          "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Hydra Daily Moisturizer",
        "slug": "hydra-daily-moisturizer",
        "description": "A lightweight gel-cream with ceramides and squalane for 48-hour hydration.",
        "price": 28,
        "categorySlug": "skincare",
        "stock": 160,
        "rating": 4.6,
        "reviewCount": 980,
        "featured": true,
        "tags": [
          "moisturizer"
        ],
        "images": [
          "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Gentle Foaming Cleanser",
        "slug": "gentle-foaming-cleanser",
        "description": "A pH-balanced foaming cleanser that lifts makeup and grime without stripping.",
        "price": 22,
        "categorySlug": "skincare",
        "stock": 180,
        "rating": 4.5,
        "reviewCount": 743,
        "tags": [
          "cleanser"
        ],
        "images": [
          "https://images.unsplash.com/photo-1612817288484-6f916006741a?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Hyaluronic Acid Booster",
        "slug": "hyaluronic-acid-booster",
        "description": "A multi-weight hyaluronic acid serum that plumps and smooths fine lines.",
        "price": 26,
        "categorySlug": "serums",
        "stock": 130,
        "rating": 4.6,
        "reviewCount": 654,
        "tags": [
          "serum",
          "hydrating"
        ],
        "images": [
          "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Detox Clay Mask",
        "slug": "detox-clay-mask",
        "description": "A kaolin-and-charcoal mask that draws out impurities and refines pores.",
        "price": 24,
        "categorySlug": "masks-spf",
        "stock": 110,
        "rating": 4.4,
        "reviewCount": 432,
        "newArrival": true,
        "tags": [
          "mask"
        ],
        "images": [
          "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Daily Defense SPF 50",
        "slug": "daily-defense-spf-50",
        "description": "A weightless broad-spectrum SPF 50 with no white cast — perfect under makeup.",
        "price": 30,
        "categorySlug": "masks-spf",
        "stock": 150,
        "rating": 4.7,
        "reviewCount": 1102,
        "tags": [
          "spf",
          "sunscreen"
        ],
        "images": [
          "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=900&q=80&auto=format&fit=crop"
        ]
      }
    ],
    "collections": [
      {
        "title": "Skincare Essentials",
        "handle": "skincare-essentials",
        "description": "Your daily routine, simplified.",
        "image": "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "hydra-daily-moisturizer",
          "gentle-foaming-cleanser",
          "daily-defense-spf-50"
        ]
      },
      {
        "title": "Best Sellers",
        "handle": "best-sellers",
        "description": "The serums everyone loves.",
        "image": "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "glow-vitamin-c-serum",
          "hyaluronic-acid-booster"
        ]
      },
      {
        "title": "On Sale",
        "handle": "on-sale",
        "description": "Glow for less.",
        "image": "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "glow-vitamin-c-serum"
        ]
      }
    ],
    "media": {
      "heroImage": "https://images.unsplash.com/photo-1612817288484-6f916006741a?w=1600&q=80&auto=format&fit=crop",
      "bannerImages": [
        "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=1600&q=80&auto=format&fit=crop"
      ]
    }
  },
  "aurum": {
    "categories": [
      {
        "name": "Earrings",
        "slug": "earrings",
        "description": "Hoops, drops and studs in recycled gold.",
        "image": "https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=900&q=80&auto=format&fit=crop"
      },
      {
        "name": "Necklaces",
        "slug": "necklaces",
        "description": "Pendants and chains for every neckline.",
        "image": "https://images.unsplash.com/photo-1506630448388-4e683c67ddb0?w=900&q=80&auto=format&fit=crop"
      },
      {
        "name": "Rings",
        "slug": "rings",
        "description": "Signets, domes and stacking bands.",
        "image": "https://images.unsplash.com/photo-1611085583191-a3b181a88401?w=900&q=80&auto=format&fit=crop"
      },
      {
        "name": "Bracelets",
        "slug": "bracelets",
        "description": "Chains and sculptural cuffs.",
        "image": "https://images.unsplash.com/photo-1598560917505-59a3ad559071?w=900&q=80&auto=format&fit=crop"
      }
    ],
    "products": [
      {
        "name": "Split Hoop Earrings",
        "slug": "split-hoop-earrings",
        "description": "Sculptural open hoops in 18k gold vermeil, hand-polished to a mirror finish and light enough for all-day wear.",
        "price": 180,
        "categorySlug": "earrings",
        "stock": 60,
        "rating": 4.8,
        "reviewCount": 214,
        "featured": true,
        "tags": [
          "earrings",
          "gold"
        ],
        "images": [
          "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=900&q=80&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1589128777073-263566ae5e4d?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Sphere Pendant Necklace",
        "slug": "sphere-pendant-necklace",
        "description": "A single polished gold sphere on a fine adjustable chain — the everyday pendant that goes with everything.",
        "price": 240,
        "compareAtPrice": 290,
        "categorySlug": "necklaces",
        "stock": 45,
        "rating": 4.7,
        "reviewCount": 178,
        "featured": true,
        "onSale": true,
        "tags": [
          "necklace",
          "pendant"
        ],
        "images": [
          "https://images.unsplash.com/photo-1602173574767-37ac01994b2a?w=900&q=80&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1506630448388-4e683c67ddb0?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Chunky Dome Ring",
        "slug": "chunky-dome-ring",
        "description": "A bold, hollow-formed dome ring with substantial presence and a feather-light feel.",
        "price": 320,
        "categorySlug": "rings",
        "stock": 35,
        "rating": 4.8,
        "reviewCount": 142,
        "tags": [
          "ring",
          "statement"
        ],
        "images": [
          "https://images.unsplash.com/photo-1603561591411-07134e71a2a9?w=900&q=80&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Figaro Chain Bracelet",
        "slug": "figaro-chain-bracelet",
        "description": "A classic figaro-link bracelet in solid gold vermeil with a secure lobster clasp.",
        "price": 210,
        "categorySlug": "bracelets",
        "stock": 50,
        "rating": 4.6,
        "reviewCount": 96,
        "tags": [
          "bracelet",
          "chain"
        ],
        "images": [
          "https://images.unsplash.com/photo-1598560917505-59a3ad559071?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Pearl Drop Earrings",
        "slug": "pearl-drop-earrings",
        "description": "Baroque freshwater pearls suspended from hand-formed gold hooks — no two pairs alike. Reserve yours from the next atelier batch.",
        "price": 260,
        "categorySlug": "earrings",
        "stock": 20,
        "rating": 4.9,
        "reviewCount": 68,
        "newArrival": true,
        "tags": [
          "earrings",
          "pearl"
        ],
        "images": [
          "https://images.unsplash.com/photo-1617038220319-276d3cfab638?w=900&q=80&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Classic Signet Ring",
        "slug": "classic-signet-ring",
        "description": "A refined oval-face signet in brushed gold, ready to wear plain or engraved.",
        "price": 140,
        "compareAtPrice": 175,
        "categorySlug": "rings",
        "stock": 70,
        "rating": 4.5,
        "reviewCount": 121,
        "onSale": true,
        "tags": [
          "ring",
          "signet"
        ],
        "images": [
          "https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=900&q=80&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Curb Chain Necklace",
        "slug": "curb-chain-necklace",
        "description": "A substantial curb chain with a high-shine finish — layer it or let it stand alone.",
        "price": 380,
        "categorySlug": "necklaces",
        "stock": 30,
        "rating": 4.8,
        "reviewCount": 156,
        "featured": true,
        "tags": [
          "necklace",
          "chain"
        ],
        "images": [
          "https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Molten Cuff Bracelet",
        "slug": "molten-cuff-bracelet",
        "description": "An organically textured open cuff, cast from a hand-carved wax original and finished in our atelier.",
        "price": 620,
        "categorySlug": "bracelets",
        "stock": 15,
        "rating": 4.9,
        "reviewCount": 54,
        "tags": [
          "bracelet",
          "cuff"
        ],
        "images": [
          "https://images.unsplash.com/photo-1610694955371-d4a3e0ce4b52?w=900&q=80&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1617117811969-97f441511dee?w=900&q=80&auto=format&fit=crop"
        ]
      }
    ],
    "collections": [
      {
        "title": "New Arrivals",
        "handle": "new-arrivals",
        "description": "Fresh from the atelier.",
        "image": "https://images.unsplash.com/photo-1617038220319-276d3cfab638?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "pearl-drop-earrings",
          "molten-cuff-bracelet"
        ]
      },
      {
        "title": "Best Sellers",
        "handle": "best-sellers",
        "description": "The pieces everyone keeps.",
        "image": "https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "split-hoop-earrings",
          "sphere-pendant-necklace",
          "curb-chain-necklace"
        ]
      },
      {
        "title": "On Sale",
        "handle": "on-sale",
        "description": "Timeless pieces, for less.",
        "image": "https://images.unsplash.com/photo-1602173574767-37ac01994b2a?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "sphere-pendant-necklace",
          "classic-signet-ring"
        ]
      }
    ],
    "media": {
      "heroImage": "https://images.unsplash.com/photo-1531995811006-35cb42e1a022?w=1600&q=80&auto=format&fit=crop",
      "bannerImages": [
        "https://images.unsplash.com/photo-1600721391689-2564bb8055de?w=1600&q=80&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1588444650733-d0767b753fc8?w=1600&q=80&auto=format&fit=crop"
      ]
    }
  },
  "bookshelf": {
    "categories": [
      {
        "name": "Fiction",
        "slug": "fiction",
        "description": "Novels and short stories.",
        "image": "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=900&q=80&auto=format&fit=crop"
      },
      {
        "name": "Non-Fiction",
        "slug": "non-fiction",
        "description": "Ideas, history and self-improvement.",
        "image": "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=900&q=80&auto=format&fit=crop"
      },
      {
        "name": "Children's",
        "slug": "childrens",
        "description": "Picture books and early readers.",
        "image": "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=900&q=80&auto=format&fit=crop"
      }
    ],
    "products": [
      {
        "name": "The Midnight Library",
        "slug": "the-midnight-library",
        "description": "A moving novel about the infinite lives we could have lived, and the one we do.",
        "price": 16,
        "compareAtPrice": 22,
        "categorySlug": "fiction",
        "stock": 90,
        "rating": 4.7,
        "reviewCount": 4210,
        "featured": true,
        "onSale": true,
        "tags": [
          "novel",
          "bestseller"
        ],
        "images": [
          "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Atomic Habits",
        "slug": "atomic-habits",
        "description": "An easy and proven way to build good habits and break bad ones, one percent at a time.",
        "price": 18,
        "categorySlug": "non-fiction",
        "stock": 120,
        "rating": 4.9,
        "reviewCount": 8920,
        "featured": true,
        "tags": [
          "self-help",
          "bestseller"
        ],
        "images": [
          "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "A Brief History of Humankind",
        "slug": "brief-history-humankind",
        "description": "A sweeping account of how our species came to dominate the planet.",
        "price": 21,
        "categorySlug": "non-fiction",
        "stock": 70,
        "rating": 4.6,
        "reviewCount": 3120,
        "tags": [
          "history"
        ],
        "images": [
          "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "The Silent Patient",
        "slug": "the-silent-patient",
        "description": "A psychological thriller about a woman's act of violence and the therapist obsessed with her.",
        "price": 15,
        "categorySlug": "fiction",
        "stock": 85,
        "rating": 4.5,
        "reviewCount": 5210,
        "tags": [
          "thriller"
        ],
        "images": [
          "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Goodnight Little Star",
        "slug": "goodnight-little-star",
        "description": "A gentle, beautifully illustrated bedtime picture book for ages 2–5.",
        "price": 12,
        "categorySlug": "childrens",
        "stock": 140,
        "rating": 4.8,
        "reviewCount": 642,
        "newArrival": true,
        "tags": [
          "picture-book"
        ],
        "images": [
          "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "The Pocket Stoic",
        "slug": "the-pocket-stoic",
        "description": "Timeless lessons on calm and resilience, distilled into a pocket-sized read.",
        "price": 13,
        "categorySlug": "non-fiction",
        "stock": 100,
        "rating": 4.5,
        "reviewCount": 871,
        "tags": [
          "philosophy"
        ],
        "images": [
          "https://images.unsplash.com/photo-1532012197267-da84d127e765?w=900&q=80&auto=format&fit=crop"
        ]
      }
    ],
    "collections": [
      {
        "title": "Bestsellers",
        "handle": "bestsellers",
        "description": "This month's most-read.",
        "image": "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "the-midnight-library",
          "atomic-habits"
        ]
      },
      {
        "title": "New Releases",
        "handle": "new-releases",
        "description": "Hot off the press.",
        "image": "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "goodnight-little-star",
          "the-pocket-stoic"
        ]
      },
      {
        "title": "Staff Picks",
        "handle": "staff-picks",
        "description": "Books we couldn't put down.",
        "image": "https://images.unsplash.com/photo-1532012197267-da84d127e765?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "atomic-habits",
          "brief-history-humankind",
          "the-silent-patient"
        ]
      }
    ],
    "media": {
      "heroImage": "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=1600&q=80&auto=format&fit=crop",
      "bannerImages": [
        "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=1600&q=80&auto=format&fit=crop"
      ]
    }
  },
  "freshmart": {
    "categories": [
      {
        "name": "Fresh Produce",
        "slug": "fresh-produce",
        "description": "Fruit and vegetables, picked fresh.",
        "image": "https://images.unsplash.com/photo-1518843875459-f738682238a6?w=900&q=80&auto=format&fit=crop"
      },
      {
        "name": "Pantry",
        "slug": "pantry",
        "description": "Everyday staples.",
        "image": "https://images.unsplash.com/photo-1542838132-92c53300491e?w=900&q=80&auto=format&fit=crop"
      },
      {
        "name": "Dairy & Bakery",
        "slug": "dairy-bakery",
        "description": "Eggs, dairy and fresh bread.",
        "image": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=900&q=80&auto=format&fit=crop"
      }
    ],
    "products": [
      {
        "name": "Organic Hass Avocados (4-pack)",
        "slug": "organic-avocados-4pack",
        "description": "Creamy, ripe-and-ready organic Hass avocados — perfect for toast and salads.",
        "price": 6,
        "compareAtPrice": 8,
        "categorySlug": "fresh-produce",
        "stock": 200,
        "rating": 4.6,
        "reviewCount": 540,
        "featured": true,
        "onSale": true,
        "tags": [
          "organic",
          "fruit"
        ],
        "images": [
          "https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Fresh Strawberries 1lb",
        "slug": "fresh-strawberries-1lb",
        "description": "Sweet, fragrant strawberries picked at peak ripeness.",
        "price": 5,
        "categorySlug": "fresh-produce",
        "stock": 180,
        "rating": 4.7,
        "reviewCount": 612,
        "featured": true,
        "tags": [
          "fruit"
        ],
        "images": [
          "https://images.unsplash.com/photo-1518843875459-f738682238a6?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Free-Range Eggs (dozen)",
        "slug": "free-range-eggs-dozen",
        "description": "A dozen large free-range eggs from pasture-raised hens.",
        "price": 5,
        "categorySlug": "dairy-bakery",
        "stock": 150,
        "rating": 4.8,
        "reviewCount": 980,
        "tags": [
          "eggs"
        ],
        "images": [
          "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Artisan Sourdough Loaf",
        "slug": "artisan-sourdough-loaf",
        "description": "A slow-fermented sourdough with a crackly crust and open crumb, baked daily.",
        "price": 7,
        "categorySlug": "dairy-bakery",
        "stock": 90,
        "rating": 4.7,
        "reviewCount": 432,
        "newArrival": true,
        "tags": [
          "bread"
        ],
        "images": [
          "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Vine Cherry Tomatoes",
        "slug": "vine-cherry-tomatoes",
        "description": "Sweet on-the-vine cherry tomatoes bursting with flavor.",
        "price": 4,
        "categorySlug": "fresh-produce",
        "stock": 160,
        "rating": 4.5,
        "reviewCount": 318,
        "tags": [
          "vegetable"
        ],
        "images": [
          "https://images.unsplash.com/photo-1557844352-761f2565b576?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Cold-Pressed Olive Oil 500ml",
        "slug": "cold-pressed-olive-oil",
        "description": "Extra-virgin, cold-pressed olive oil with a peppery, fruity finish.",
        "price": 14,
        "compareAtPrice": 18,
        "categorySlug": "pantry",
        "stock": 120,
        "rating": 4.8,
        "reviewCount": 745,
        "onSale": true,
        "tags": [
          "pantry"
        ],
        "images": [
          "https://images.unsplash.com/photo-1542838132-92c53300491e?w=900&q=80&auto=format&fit=crop"
        ]
      }
    ],
    "collections": [
      {
        "title": "Fresh This Week",
        "handle": "fresh-this-week",
        "description": "Picked at peak ripeness.",
        "image": "https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "organic-avocados-4pack",
          "fresh-strawberries-1lb",
          "vine-cherry-tomatoes"
        ]
      },
      {
        "title": "Pantry Staples",
        "handle": "pantry-staples",
        "description": "Everyday essentials.",
        "image": "https://images.unsplash.com/photo-1542838132-92c53300491e?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "cold-pressed-olive-oil",
          "free-range-eggs-dozen"
        ]
      },
      {
        "title": "On Sale",
        "handle": "on-sale",
        "description": "This week's deals.",
        "image": "https://images.unsplash.com/photo-1518843875459-f738682238a6?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "organic-avocados-4pack",
          "cold-pressed-olive-oil"
        ]
      }
    ],
    "media": {
      "heroImage": "https://images.unsplash.com/photo-1542838132-92c53300491e?w=1600&q=80&auto=format&fit=crop",
      "bannerImages": [
        "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=1600&q=80&auto=format&fit=crop"
      ]
    }
  },
  "kidsworld": {
    "categories": [
      {
        "name": "Building Blocks",
        "slug": "building-blocks",
        "description": "Bricks and construction sets.",
        "image": "https://images.unsplash.com/photo-1545558014-8692077e9b5c?w=900&q=80&auto=format&fit=crop"
      },
      {
        "name": "Plush Toys",
        "slug": "plush-toys",
        "description": "Soft and cuddly friends.",
        "image": "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=900&q=80&auto=format&fit=crop"
      },
      {
        "name": "Learning & Crafts",
        "slug": "learning-crafts",
        "description": "Educational and creative play.",
        "image": "https://images.unsplash.com/photo-1513519245088-0e12902e35ca?w=900&q=80&auto=format&fit=crop"
      }
    ],
    "products": [
      {
        "name": "Wooden Building Blocks (100 pcs)",
        "slug": "wooden-building-blocks-100",
        "description": "A 100-piece set of smooth, brightly-painted wooden blocks for open-ended play.",
        "price": 34,
        "compareAtPrice": 45,
        "categorySlug": "building-blocks",
        "stock": 110,
        "rating": 4.8,
        "reviewCount": 642,
        "featured": true,
        "onSale": true,
        "tags": [
          "blocks",
          "wooden"
        ],
        "images": [
          "https://images.unsplash.com/photo-1545558014-8692077e9b5c?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Cuddles the Teddy Bear",
        "slug": "cuddles-teddy-bear",
        "description": "An extra-soft, huggable teddy bear with embroidered eyes — safe from birth.",
        "price": 24,
        "categorySlug": "plush-toys",
        "stock": 140,
        "rating": 4.9,
        "reviewCount": 1320,
        "featured": true,
        "tags": [
          "plush"
        ],
        "images": [
          "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Wooden Train Set",
        "slug": "wooden-train-set",
        "description": "A 40-piece wooden train and track set that connects in endless layouts.",
        "price": 39,
        "categorySlug": "building-blocks",
        "stock": 80,
        "rating": 4.7,
        "reviewCount": 412,
        "tags": [
          "train"
        ],
        "images": [
          "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Rainbow Stacking Rings",
        "slug": "rainbow-stacking-rings",
        "description": "A classic stacking-rings toy that builds color recognition and motor skills.",
        "price": 16,
        "categorySlug": "learning-crafts",
        "stock": 160,
        "rating": 4.6,
        "reviewCount": 528,
        "tags": [
          "educational"
        ],
        "images": [
          "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Benny the Plush Bunny",
        "slug": "benny-plush-bunny",
        "description": "A floppy-eared plush bunny in soft velour, just right for little hands.",
        "price": 19,
        "categorySlug": "plush-toys",
        "stock": 120,
        "rating": 4.8,
        "reviewCount": 367,
        "newArrival": true,
        "tags": [
          "plush"
        ],
        "images": [
          "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Deluxe Art & Craft Kit",
        "slug": "deluxe-art-craft-kit",
        "description": "A 150-piece art kit with crayons, markers, stickers and paper for hours of creativity.",
        "price": 29,
        "categorySlug": "learning-crafts",
        "stock": 95,
        "rating": 4.7,
        "reviewCount": 284,
        "tags": [
          "craft",
          "art"
        ],
        "images": [
          "https://images.unsplash.com/photo-1513519245088-0e12902e35ca?w=900&q=80&auto=format&fit=crop"
        ]
      }
    ],
    "collections": [
      {
        "title": "Toys for Toddlers",
        "handle": "toys-for-toddlers",
        "description": "Safe, soft and fun for little ones.",
        "image": "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "cuddles-teddy-bear",
          "rainbow-stacking-rings",
          "benny-plush-bunny"
        ]
      },
      {
        "title": "New Arrivals",
        "handle": "new-arrivals",
        "description": "Fresh fun, just in.",
        "image": "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "benny-plush-bunny",
          "deluxe-art-craft-kit"
        ]
      },
      {
        "title": "On Sale",
        "handle": "on-sale",
        "description": "Playtime for less.",
        "image": "https://images.unsplash.com/photo-1545558014-8692077e9b5c?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "wooden-building-blocks-100"
        ]
      }
    ],
    "media": {
      "heroImage": "https://images.unsplash.com/photo-1558877385-81a1c7e67d72?w=1600&q=80&auto=format&fit=crop",
      "bannerImages": [
        "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=1600&q=80&auto=format&fit=crop"
      ]
    }
  },
  "homedecor": {
    "categories": [
      {
        "name": "Lighting",
        "slug": "lighting",
        "description": "Lamps and ambient light.",
        "image": "https://images.unsplash.com/photo-1540574163026-643ea20ade25?w=900&q=80&auto=format&fit=crop"
      },
      {
        "name": "Textiles",
        "slug": "textiles",
        "description": "Throws, cushions and rugs.",
        "image": "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=900&q=80&auto=format&fit=crop"
      },
      {
        "name": "Decor",
        "slug": "decor",
        "description": "Vases, candles and accents.",
        "image": "https://images.unsplash.com/photo-1565183997392-2f6f122e5912?w=900&q=80&auto=format&fit=crop"
      }
    ],
    "products": [
      {
        "name": "Ceramic Table Lamp",
        "slug": "ceramic-table-lamp",
        "description": "A hand-glazed ceramic base with a linen drum shade for a warm, even glow.",
        "price": 89,
        "compareAtPrice": 120,
        "categorySlug": "lighting",
        "stock": 60,
        "rating": 4.7,
        "reviewCount": 218,
        "featured": true,
        "onSale": true,
        "tags": [
          "lamp"
        ],
        "images": [
          "https://images.unsplash.com/photo-1540574163026-643ea20ade25?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Chunky Knit Throw Blanket",
        "slug": "chunky-knit-throw",
        "description": "An oversized chunky-knit throw in soft acrylic-wool blend — cozy and sculptural.",
        "price": 65,
        "categorySlug": "textiles",
        "stock": 90,
        "rating": 4.8,
        "reviewCount": 412,
        "featured": true,
        "tags": [
          "throw"
        ],
        "images": [
          "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Scented Soy Candle Set",
        "slug": "scented-soy-candle-set",
        "description": "A trio of hand-poured soy candles in sandalwood, fig and sea salt.",
        "price": 42,
        "categorySlug": "decor",
        "stock": 130,
        "rating": 4.6,
        "reviewCount": 324,
        "tags": [
          "candle"
        ],
        "images": [
          "https://images.unsplash.com/photo-1565183997392-2f6f122e5912?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Matte Stoneware Vase",
        "slug": "matte-stoneware-vase",
        "description": "A tall, matte-finish stoneware vase with an organic, hand-thrown silhouette.",
        "price": 48,
        "categorySlug": "decor",
        "stock": 75,
        "rating": 4.7,
        "reviewCount": 186,
        "newArrival": true,
        "tags": [
          "vase"
        ],
        "images": [
          "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Velvet Lumbar Cushion",
        "slug": "velvet-lumbar-cushion",
        "description": "A plush velvet lumbar cushion with a hidden zip and feather-down insert.",
        "price": 35,
        "categorySlug": "textiles",
        "stock": 110,
        "rating": 4.5,
        "reviewCount": 263,
        "tags": [
          "cushion"
        ],
        "images": [
          "https://images.unsplash.com/photo-1513519245088-0e12902e35ca?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Woven Macrame Wall Hanging",
        "slug": "woven-macrame-wall-hanging",
        "description": "A handwoven cotton macrame piece that adds warmth and texture to any wall.",
        "price": 54,
        "categorySlug": "decor",
        "stock": 50,
        "rating": 4.6,
        "reviewCount": 142,
        "tags": [
          "wall-art"
        ],
        "images": [
          "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=900&q=80&auto=format&fit=crop"
        ]
      }
    ],
    "collections": [
      {
        "title": "New Arrivals",
        "handle": "new-arrivals",
        "description": "Fresh finds for the home.",
        "image": "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "matte-stoneware-vase",
          "woven-macrame-wall-hanging"
        ]
      },
      {
        "title": "On Sale",
        "handle": "on-sale",
        "description": "Style for less.",
        "image": "https://images.unsplash.com/photo-1540574163026-643ea20ade25?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "ceramic-table-lamp"
        ]
      },
      {
        "title": "Editor's Picks",
        "handle": "editors-picks",
        "description": "Pieces we're loving now.",
        "image": "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "chunky-knit-throw",
          "scented-soy-candle-set",
          "velvet-lumbar-cushion"
        ]
      }
    ],
    "media": {
      "heroImage": "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1600&q=80&auto=format&fit=crop",
      "bannerImages": [
        "https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=1600&q=80&auto=format&fit=crop"
      ]
    }
  },
  "artisan": {
    "categories": [
      {
        "name": "Pottery",
        "slug": "pottery",
        "description": "Hand-thrown ceramics.",
        "image": "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=900&q=80&auto=format&fit=crop"
      },
      {
        "name": "Woven & Textiles",
        "slug": "woven-textiles",
        "description": "Baskets, weavings and fabric.",
        "image": "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=900&q=80&auto=format&fit=crop"
      },
      {
        "name": "Woodcraft",
        "slug": "woodcraft",
        "description": "Carved and turned wood pieces.",
        "image": "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=900&q=80&auto=format&fit=crop"
      }
    ],
    "products": [
      {
        "name": "Handmade Ceramic Mug",
        "slug": "handmade-ceramic-mug",
        "description": "A wheel-thrown stoneware mug with a reactive glaze — no two are exactly alike.",
        "price": 32,
        "compareAtPrice": 42,
        "categorySlug": "pottery",
        "stock": 80,
        "rating": 4.8,
        "reviewCount": 312,
        "featured": true,
        "onSale": true,
        "tags": [
          "ceramic",
          "handmade"
        ],
        "images": [
          "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Woven Seagrass Basket",
        "slug": "woven-seagrass-basket",
        "description": "A hand-woven seagrass storage basket with sturdy handles, made by artisans.",
        "price": 46,
        "categorySlug": "woven-textiles",
        "stock": 65,
        "rating": 4.7,
        "reviewCount": 198,
        "featured": true,
        "tags": [
          "basket"
        ],
        "images": [
          "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Carved Acacia Serving Bowl",
        "slug": "carved-acacia-bowl",
        "description": "A hand-carved acacia-wood bowl with a natural grain and food-safe finish.",
        "price": 58,
        "categorySlug": "woodcraft",
        "stock": 50,
        "rating": 4.8,
        "reviewCount": 164,
        "tags": [
          "wood"
        ],
        "images": [
          "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Hand-Poured Beeswax Candle",
        "slug": "hand-poured-beeswax-candle",
        "description": "A pure beeswax candle hand-poured in small batches, with a honey-warm scent.",
        "price": 28,
        "categorySlug": "pottery",
        "stock": 120,
        "rating": 4.6,
        "reviewCount": 241,
        "tags": [
          "candle"
        ],
        "images": [
          "https://images.unsplash.com/photo-1565183997392-2f6f122e5912?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Macrame Plant Hanger",
        "slug": "macrame-plant-hanger",
        "description": "A hand-knotted cotton macrame plant hanger that fits most 6\" pots.",
        "price": 24,
        "categorySlug": "woven-textiles",
        "stock": 100,
        "rating": 4.5,
        "reviewCount": 176,
        "newArrival": true,
        "tags": [
          "macrame"
        ],
        "images": [
          "https://images.unsplash.com/photo-1513519245088-0e12902e35ca?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Stoneware Bud Vase",
        "slug": "stoneware-bud-vase",
        "description": "A petite hand-glazed bud vase, perfect for a single stem on a windowsill.",
        "price": 26,
        "categorySlug": "pottery",
        "stock": 90,
        "rating": 4.7,
        "reviewCount": 203,
        "tags": [
          "vase"
        ],
        "images": [
          "https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=900&q=80&auto=format&fit=crop"
        ]
      }
    ],
    "collections": [
      {
        "title": "New Arrivals",
        "handle": "new-arrivals",
        "description": "Freshly made by hand.",
        "image": "https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "macrame-plant-hanger",
          "stoneware-bud-vase"
        ]
      },
      {
        "title": "Best Sellers",
        "handle": "best-sellers",
        "description": "Our most-loved makes.",
        "image": "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "handmade-ceramic-mug",
          "woven-seagrass-basket"
        ]
      },
      {
        "title": "Editor's Picks",
        "handle": "editors-picks",
        "description": "Handpicked artisan pieces.",
        "image": "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "carved-acacia-bowl",
          "hand-poured-beeswax-candle"
        ]
      }
    ],
    "media": {
      "heroImage": "https://images.unsplash.com/photo-1493106641515-6b5631de4bb9?w=1600&q=80&auto=format&fit=crop",
      "bannerImages": [
        "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=1600&q=80&auto=format&fit=crop"
      ]
    }
  },
  "nutreko": {
    "categories": [
      {
        "name": "Protein",
        "slug": "protein",
        "description": "Powders and recovery.",
        "image": "https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=900&q=80&auto=format&fit=crop"
      },
      {
        "name": "Vitamins",
        "slug": "vitamins",
        "description": "Daily nutrition.",
        "image": "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=900&q=80&auto=format&fit=crop"
      },
      {
        "name": "Performance",
        "slug": "performance",
        "description": "Pre-workout and training support.",
        "image": "https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=900&q=80&auto=format&fit=crop"
      }
    ],
    "products": [
      {
        "name": "Whey Protein Powder 2lb",
        "slug": "whey-protein-2lb",
        "description": "24g of grass-fed whey protein per serving, in smooth vanilla — mixes clean.",
        "price": 39,
        "compareAtPrice": 49,
        "categorySlug": "protein",
        "stock": 140,
        "rating": 4.7,
        "reviewCount": 1820,
        "featured": true,
        "onSale": true,
        "tags": [
          "protein",
          "whey"
        ],
        "images": [
          "https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Daily Multivitamin (90 ct)",
        "slug": "daily-multivitamin-90",
        "description": "A complete daily multivitamin with iron, B-complex and vitamin D3.",
        "price": 22,
        "categorySlug": "vitamins",
        "stock": 200,
        "rating": 4.6,
        "reviewCount": 1320,
        "featured": true,
        "tags": [
          "vitamins"
        ],
        "images": [
          "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Pre-Workout Energy Mix",
        "slug": "pre-workout-energy-mix",
        "description": "A balanced pre-workout with caffeine, beta-alanine and citrulline for clean energy.",
        "price": 34,
        "categorySlug": "performance",
        "stock": 110,
        "rating": 4.5,
        "reviewCount": 642,
        "tags": [
          "pre-workout"
        ],
        "images": [
          "https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Omega-3 Fish Oil",
        "slug": "omega-3-fish-oil",
        "description": "High-potency omega-3 softgels with EPA and DHA for heart and brain health.",
        "price": 19,
        "categorySlug": "vitamins",
        "stock": 160,
        "rating": 4.6,
        "reviewCount": 874,
        "tags": [
          "omega-3"
        ],
        "images": [
          "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Creatine Monohydrate 300g",
        "slug": "creatine-monohydrate-300g",
        "description": "Pure micronized creatine monohydrate — unflavored and easy to mix.",
        "price": 24,
        "categorySlug": "performance",
        "stock": 130,
        "rating": 4.8,
        "reviewCount": 1102,
        "newArrival": true,
        "tags": [
          "creatine"
        ],
        "images": [
          "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "BCAA Recovery Drink",
        "slug": "bcaa-recovery-drink",
        "description": "A 2:1:1 BCAA blend with electrolytes for hydration and muscle recovery.",
        "price": 29,
        "categorySlug": "protein",
        "stock": 95,
        "rating": 4.5,
        "reviewCount": 487,
        "tags": [
          "bcaa"
        ],
        "images": [
          "https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=900&q=80&auto=format&fit=crop"
        ]
      }
    ],
    "collections": [
      {
        "title": "Best Sellers",
        "handle": "best-sellers",
        "description": "Top picks for your goals.",
        "image": "https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "whey-protein-2lb",
          "daily-multivitamin-90"
        ]
      },
      {
        "title": "New Arrivals",
        "handle": "new-arrivals",
        "description": "Latest in nutrition.",
        "image": "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "creatine-monohydrate-300g"
        ]
      },
      {
        "title": "On Sale",
        "handle": "on-sale",
        "description": "Fuel for less.",
        "image": "https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "whey-protein-2lb"
        ]
      }
    ],
    "media": {
      "heroImage": "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1600&q=80&auto=format&fit=crop",
      "bannerImages": [
        "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=1600&q=80&auto=format&fit=crop"
      ]
    }
  },
  "sportzone": {
    "categories": [
      {
        "name": "Footwear",
        "slug": "footwear",
        "description": "Performance shoes.",
        "image": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=900&q=80&auto=format&fit=crop"
      },
      {
        "name": "Equipment",
        "slug": "equipment",
        "description": "Weights, mats and gear.",
        "image": "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=900&q=80&auto=format&fit=crop"
      },
      {
        "name": "Apparel",
        "slug": "apparel",
        "description": "Training clothing.",
        "image": "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=900&q=80&auto=format&fit=crop"
      }
    ],
    "products": [
      {
        "name": "Velocity Running Shoes",
        "slug": "velocity-running-shoes",
        "description": "Lightweight, responsive running shoes with a breathable knit upper and cushioned midsole.",
        "price": 110,
        "compareAtPrice": 140,
        "categorySlug": "footwear",
        "stock": 90,
        "rating": 4.7,
        "reviewCount": 1420,
        "featured": true,
        "onSale": true,
        "tags": [
          "running",
          "shoes"
        ],
        "images": [
          "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Pro Grip Yoga Mat",
        "slug": "pro-grip-yoga-mat",
        "description": "A 6mm non-slip yoga mat with alignment lines and a sweat-resistant surface.",
        "price": 45,
        "categorySlug": "equipment",
        "stock": 120,
        "rating": 4.8,
        "reviewCount": 642,
        "featured": true,
        "tags": [
          "yoga"
        ],
        "images": [
          "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Adjustable Dumbbell Set",
        "slug": "adjustable-dumbbell-set",
        "description": "A space-saving pair of adjustable dumbbells, 5–52.5 lbs each, with a quick dial.",
        "price": 299,
        "categorySlug": "equipment",
        "stock": 40,
        "rating": 4.7,
        "reviewCount": 318,
        "tags": [
          "weights"
        ],
        "images": [
          "https://images.unsplash.com/photo-1599058917212-d750089bc07e?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Official Size Basketball",
        "slug": "official-size-basketball",
        "description": "A composite-leather indoor/outdoor basketball with a deep-channel grip.",
        "price": 34,
        "categorySlug": "equipment",
        "stock": 110,
        "rating": 4.6,
        "reviewCount": 528,
        "tags": [
          "basketball"
        ],
        "images": [
          "https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Compression Training Tee",
        "slug": "compression-training-tee",
        "description": "A moisture-wicking compression tee with four-way stretch for full range of motion.",
        "price": 32,
        "categorySlug": "apparel",
        "stock": 150,
        "rating": 4.5,
        "reviewCount": 412,
        "newArrival": true,
        "tags": [
          "apparel"
        ],
        "images": [
          "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Resistance Bands Set",
        "slug": "resistance-bands-set",
        "description": "Five stackable resistance bands with handles, door anchor and ankle straps.",
        "price": 28,
        "categorySlug": "equipment",
        "stock": 170,
        "rating": 4.6,
        "reviewCount": 736,
        "tags": [
          "bands"
        ],
        "images": [
          "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=900&q=80&auto=format&fit=crop"
        ]
      }
    ],
    "collections": [
      {
        "title": "New Arrivals",
        "handle": "new-arrivals",
        "description": "Gear up with the latest.",
        "image": "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "compression-training-tee",
          "resistance-bands-set"
        ]
      },
      {
        "title": "On Sale",
        "handle": "on-sale",
        "description": "Train for less.",
        "image": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "velocity-running-shoes"
        ]
      },
      {
        "title": "Best Sellers",
        "handle": "best-sellers",
        "description": "Athlete favorites.",
        "image": "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "pro-grip-yoga-mat",
          "adjustable-dumbbell-set"
        ]
      }
    ],
    "media": {
      "heroImage": "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1600&q=80&auto=format&fit=crop",
      "bannerImages": [
        "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=1600&q=80&auto=format&fit=crop"
      ]
    }
  },
  "milmaa": {
    "categories": [
      {
        "name": "Organic Foods",
        "slug": "organic-foods",
        "description": "Pure, natural pantry goods.",
        "image": "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=900&q=80&auto=format&fit=crop"
      },
      {
        "name": "Herbal Teas",
        "slug": "herbal-teas",
        "description": "Soothing botanical blends.",
        "image": "https://images.unsplash.com/photo-1556881286-fc6915169721?w=900&q=80&auto=format&fit=crop"
      },
      {
        "name": "Wellness",
        "slug": "wellness",
        "description": "Everyday wellbeing.",
        "image": "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=900&q=80&auto=format&fit=crop"
      }
    ],
    "products": [
      {
        "name": "Raw Organic Honey 500g",
        "slug": "raw-organic-honey-500g",
        "description": "Unfiltered, cold-extracted raw honey from wildflower meadows — pure and golden.",
        "price": 16,
        "compareAtPrice": 21,
        "categorySlug": "organic-foods",
        "stock": 130,
        "rating": 4.8,
        "reviewCount": 642,
        "featured": true,
        "onSale": true,
        "tags": [
          "honey",
          "organic"
        ],
        "images": [
          "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Calm Herbal Tea Blend",
        "slug": "calm-herbal-tea-blend",
        "description": "A caffeine-free blend of chamomile, lavender and lemon balm for winding down.",
        "price": 12,
        "categorySlug": "herbal-teas",
        "stock": 160,
        "rating": 4.7,
        "reviewCount": 412,
        "featured": true,
        "tags": [
          "tea",
          "herbal"
        ],
        "images": [
          "https://images.unsplash.com/photo-1556881286-fc6915169721?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Organic Quinoa 1kg",
        "slug": "organic-quinoa-1kg",
        "description": "Triple-washed organic white quinoa — a complete-protein pantry staple.",
        "price": 14,
        "categorySlug": "organic-foods",
        "stock": 110,
        "rating": 4.6,
        "reviewCount": 318,
        "tags": [
          "organic",
          "grain"
        ],
        "images": [
          "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Cold-Pressed Coconut Oil",
        "slug": "cold-pressed-coconut-oil",
        "description": "Virgin, cold-pressed coconut oil for cooking, skin and hair.",
        "price": 13,
        "categorySlug": "organic-foods",
        "stock": 140,
        "rating": 4.7,
        "reviewCount": 524,
        "tags": [
          "organic"
        ],
        "images": [
          "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Green Tea & Mint Blend",
        "slug": "green-tea-mint-blend",
        "description": "A refreshing organic green tea blended with cooling peppermint leaves.",
        "price": 11,
        "categorySlug": "herbal-teas",
        "stock": 150,
        "rating": 4.5,
        "reviewCount": 287,
        "newArrival": true,
        "tags": [
          "tea",
          "green"
        ],
        "images": [
          "https://images.unsplash.com/photo-1556881286-fc6915169721?w=900&q=80&auto=format&fit=crop"
        ]
      },
      {
        "name": "Organic Chia Seeds 500g",
        "slug": "organic-chia-seeds-500g",
        "description": "Nutrient-dense organic chia seeds, rich in fiber and omega-3.",
        "price": 10,
        "categorySlug": "wellness",
        "stock": 180,
        "rating": 4.6,
        "reviewCount": 463,
        "tags": [
          "organic",
          "superfood"
        ],
        "images": [
          "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=900&q=80&auto=format&fit=crop"
        ]
      }
    ],
    "collections": [
      {
        "title": "Best Sellers",
        "handle": "best-sellers",
        "description": "Pure favorites.",
        "image": "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "raw-organic-honey-500g",
          "calm-herbal-tea-blend"
        ]
      },
      {
        "title": "New Arrivals",
        "handle": "new-arrivals",
        "description": "Fresh from nature.",
        "image": "https://images.unsplash.com/photo-1556881286-fc6915169721?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "green-tea-mint-blend",
          "organic-chia-seeds-500g"
        ]
      },
      {
        "title": "On Sale",
        "handle": "on-sale",
        "description": "Wellness for less.",
        "image": "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=900&q=80&auto=format&fit=crop",
        "productSlugs": [
          "raw-organic-honey-500g"
        ]
      }
    ],
    "media": {
      "heroImage": "https://images.unsplash.com/photo-1490818387583-1baba5e638af?w=1600&q=80&auto=format&fit=crop",
      "bannerImages": [
        "https://images.unsplash.com/photo-1556881286-fc6915169721?w=1600&q=80&auto=format&fit=crop"
      ]
    }
  }
};
