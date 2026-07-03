import { cva } from "class-variance-authority"

/**
 * Badge CVA variants. Kept in a sibling file so `badge.tsx` can stay a
 * components-only module (Fast Refresh bails on mixed exports).
 */
export const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      // Semantic status system (audit 3.8.3): status badges use the soft
      // token pairs — success (green), warning (amber), destructive (red),
      // info (neutral gray). Brand blue (`default`) is reserved for
      // interactive/selected chips, never status.
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive-soft text-destructive-soft-foreground",
        outline: "text-foreground",
        success:
          "border-transparent bg-success-soft text-success-soft-foreground",
        warning:
          "border-transparent bg-warning-soft text-warning-soft-foreground",
        info:
          "border-transparent bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)
