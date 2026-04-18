import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps extends React.ComponentProps<"input"> {
  // Optional label/error wrapper. When `label` or `error` is provided the
  // component renders a labelled field block (matching Textarea's API);
  // otherwise it stays a bare <input> for use inside custom layouts.
  label?: string
  error?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, ...props }, ref) => {
    const input = (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          error && "border-destructive focus-visible:ring-destructive",
          className
        )}
        ref={ref}
        {...props}
      />
    )

    if (!label && !error) return input

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium mb-2">
            {label}
            {props.required && <span className="text-destructive ml-1">*</span>}
          </label>
        )}
        {input}
        {error && <p className="text-sm text-destructive mt-1">{error}</p>}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
