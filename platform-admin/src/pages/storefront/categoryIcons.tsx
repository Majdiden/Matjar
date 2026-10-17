import type { LucideIcon } from 'lucide-react';
import {
  Baby, BookOpen, Cake, Camera, Car, Coffee, Dumbbell, Flower2, Footprints, Gem, Gift, Glasses, HeartPulse, Home,
  Laptop, Leaf, Music, Palette, PawPrint, Pill, Shirt, ShoppingBag, Smartphone, Sofa, Sparkles, SprayCan, Store,
  Tag, UtensilsCrossed, Watch, Wrench,
} from 'lucide-react';

/**
 * Icons a theme category can use, in picker order. Same names as
 * THEME_CATEGORY_ICONS in config/themeCategories.js (the server accepts only
 * these) and the signup icons in dashboard Register.tsx — parity test.
 */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Store, ShoppingBag, Shirt, Footprints, Glasses, Watch, Gem, Sparkles,
  SprayCan, Flower2, HeartPulse, Pill, Baby, Gift, Smartphone, Laptop,
  Camera, Music, UtensilsCrossed, Coffee, Cake, Leaf, Home, Sofa,
  Palette, Wrench, Car, PawPrint, Dumbbell, BookOpen,
};

/** The category's picture, else its icon, else a tag — as signup shows it. */
export function CategoryMark({ icon, image, className = 'h-9 w-9' }: { icon?: string; image?: string; className?: string }) {
  const Icon = (icon && CATEGORY_ICONS[icon]) || Tag;
  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-foreground ${className}`}>
      {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <Icon className="h-4 w-4" />}
    </span>
  );
}

/** A grid of the offered icons; clicking the selected one clears it. */
export function IconPicker({ value, onChange }: { value: string; onChange: (icon: string) => void }) {
  return (
    <div className="grid grid-cols-8 gap-1" role="radiogroup" aria-label="Icon">
      {Object.entries(CATEGORY_ICONS).map(([name, Icon]) => {
        const selected = value === name;
        return (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={name}
            title={name}
            onClick={() => onChange(selected ? '' : name)}
            className={`flex h-9 items-center justify-center rounded-md border transition-colors ${
              selected ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-transparent hover:bg-muted'
            }`}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
