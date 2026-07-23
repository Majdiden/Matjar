import { cva } from "class-variance-authority"

/**
 * Button CVA variants. Kept in a sibling file so `button.tsx` can stay
 * a components-only module (Fast Refresh bails on mixed exports).
 * Consumers like Calendar and Pagination import from here directly.
 */
export const buttonVariants = cva(
  // Disabled state (audit 3.9.13): clearly reduced contrast (opacity +
  // desaturation, no shadow) and `cursor-not-allowed` so a disabled CTA
  // never reads as "half-pressed". `:disabled` only matches real form
  // controls, so asChild links are unaffected. Native disabled buttons
  // swallow clicks, so pointer-events-none is not needed.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 disabled:saturate-50 disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary-hover active:bg-primary-active",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      // Mobile-first sizing for a touch, novice audience: comfortable tap
      // targets on phones (≥36–40px), compacting to the tighter desktop
      // scale at `sm:` where a pointer is precise. One responsive bump here
      // lifts every button in the app.
      size: {
        default: "h-10 px-4 py-2 sm:h-9",
        sm: "h-9 rounded-md px-3 text-sm sm:h-8 sm:text-xs",
        lg: "h-11 rounded-md px-8 sm:h-10",
        icon: "h-10 w-10 sm:h-9 sm:w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
