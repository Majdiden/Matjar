import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  description?: string;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, ...props }, ref) => {
    return (
      <div className="flex items-start space-x-3">
        <div className="relative flex items-center">
          <input
            type="checkbox"
            className="peer sr-only"
            ref={ref}
            {...props}
          />
          <div
            className={cn(
              'h-5 w-5 rounded border border-input bg-background',
              'peer-checked:bg-primary peer-checked:border-primary',
              'peer-focus:ring-2 peer-focus:ring-ring peer-focus:ring-offset-2',
              'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
              'cursor-pointer transition-colors',
              className
            )}
            onClick={() => {
              const input = (props.id ? document.getElementById(props.id) : null) as HTMLInputElement | null;
              if (input && !props.disabled) {
                input.click();
              }
            }}
          >
            <Check className="h-4 w-4 text-primary-foreground hidden peer-checked:block absolute top-0.5 start-0.5" />
          </div>
        </div>
        {(label || description) && (
          <div className="flex-1">
            {label && (
              <label
                htmlFor={props.id}
                className="text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {label}
              </label>
            )}
            {description && (
              <p className="text-sm text-muted-foreground mt-1">
                {description}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

export { Checkbox };
