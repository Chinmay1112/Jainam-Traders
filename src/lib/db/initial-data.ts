import { Category, Coupon, Offer, Product, ShopSettings } from '@/lib/types';
import { CANONICAL_SHOP_CONFIG } from '@/lib/config/shop-config';

// ==============================================================================
// JAINAM TRADERS — PRODUCTION INITIAL DATA
// All fake/demo products, orders, reviews, coupons, and offers have been cleared.
// The store starts clean with ZERO demo records. Real inventory is entered by staff.
// ==============================================================================

export const INITIAL_SHOP_SETTINGS: ShopSettings = {
  ...CANONICAL_SHOP_CONFIG,
};

export const INITIAL_CATEGORIES: Category[] = [
  {
    id: 'b0000000-0000-0000-0000-000000000001',
    name: 'Gift Articles & Mementos',
    slug: 'gifts-mementos',
    description: 'Curated gift hampers, crystal mementos, brass idols & trophy pieces',
    icon: 'Gift',
    sortOrder: 1,
    isFeatured: true,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'b0000000-0000-0000-0000-000000000002',
    name: 'Photo Frames & Albums',
    slug: 'photo-frames',
    description: 'Wooden, acrylic, metallic and collage photo frames',
    icon: 'Image',
    sortOrder: 2,
    isFeatured: true,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'b0000000-0000-0000-0000-000000000003',
    name: 'Clocks & Timepieces',
    slug: 'clocks',
    description: 'Vintage pendulum, silent sweep wall clocks, and digital desk clocks',
    icon: 'Clock',
    sortOrder: 3,
    isFeatured: true,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'b0000000-0000-0000-0000-000000000004',
    name: 'Watches & Eyewear',
    slug: 'watches',
    description: 'Analog quartz wristwatches and polarized sunglasses',
    icon: 'Watch',
    sortOrder: 4,
    isFeatured: true,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'b0000000-0000-0000-0000-000000000005',
    name: 'Leather Belts, Purses & Bags',
    slug: 'belts-purses',
    description: 'Genuine leather wallets, reversible belts, clutches and travel duffles',
    icon: 'Briefcase',
    sortOrder: 5,
    isFeatured: true,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'b0000000-0000-0000-0000-000000000006',
    name: 'Perfumes & Fragrances',
    slug: 'perfumes',
    description: 'Long-lasting luxury EDPs, attars, and body mists',
    icon: 'Sparkles',
    sortOrder: 6,
    isFeatured: false,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'b0000000-0000-0000-0000-000000000007',
    name: 'Toys & Board Games',
    slug: 'toys-games',
    description: 'STEM learning toys, educational board games, remote cars, and soft plushes',
    icon: 'Gamepad2',
    sortOrder: 7,
    isFeatured: true,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'b0000000-0000-0000-0000-000000000008',
    name: 'Executive Stationery',
    slug: 'stationery',
    description: 'Fine metal rollerball pens, leather planners, desk organizers, and art kits',
    icon: 'PenTool',
    sortOrder: 8,
    isFeatured: false,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'b0000000-0000-0000-0000-000000000009',
    name: 'Decorative & Home Showpieces',
    slug: 'decorative',
    description: 'Handcrafted resin statues, brass lamps, feng shui crystals, and tabletop art',
    icon: 'Heart',
    sortOrder: 9,
    isFeatured: true,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
];

// Production products: ZERO demo records
export const INITIAL_PRODUCTS: Product[] = [];

// Production coupons: ZERO demo records
export const INITIAL_COUPONS: Coupon[] = [];

// Production offers: ZERO demo records
export const INITIAL_OFFERS: Offer[] = [];
