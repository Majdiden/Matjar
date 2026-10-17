import type { LucideIcon } from 'lucide-react';
import {
  Baby, BookOpen, Cake, Camera, Car, Coffee, Dumbbell, Flower2, Footprints, Gem, Gift, Glasses, HeartPulse, Home,
  Laptop, Leaf, Music, Palette, PawPrint, Pill, Shirt, ShoppingBag, Smartphone, Sofa, Sparkles, SprayCan, Store,
  UtensilsCrossed, Watch, Wrench,
} from 'lucide-react';

/**
 * Icons the platform owner can give a theme category (Lucide names). Same
 * list as THEME_CATEGORY_ICONS in config/themeCategories.js and the console
 * picker (platform-admin categoryIcons.tsx) — parity test.
 */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Store, ShoppingBag, Shirt, Footprints, Glasses, Watch, Gem, Sparkles,
  SprayCan, Flower2, HeartPulse, Pill, Baby, Gift, Smartphone, Laptop,
  Camera, Music, UtensilsCrossed, Coffee, Cake, Leaf, Home, Sofa,
  Palette, Wrench, Car, PawPrint, Dumbbell, BookOpen,
};
