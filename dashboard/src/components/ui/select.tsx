import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

// Shim that supports BOTH APIs:
//   1. Legacy: <Select options={[{value,label}]} value onChange />
//   2. Compound (shadcn-style): <Select value onValueChange><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value>Label</SelectItem>...</SelectContent></Select>
// Both render a native <select> so keyboard + a11y work with zero dependencies.

type Option = { value: string; label: string };

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string;
  error?: string;
  options?: Option[];
  /**
   * Native <select> always emits a string, but callers often narrow the
   * value to a local union (e.g. `(v: 'all' | 'any') => void`). We use
   * method syntax here because under `strictFunctionTypes` it's
   * bivariant in its arguments — that's what lets consumers pass a
   * narrowed callback without `as` casts at every call site.
   */
  onValueChange?(value: string): void;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  placeholder?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      label,
      error,
      options,
      onValueChange,
      onChange,
      children,
      placeholder,
      ...props
    },
    ref
  ) => {
    // If options prop is given → legacy path. Else walk children for compound shape.
    const derivedOptions: Option[] = options ? [...options] : [];
    let derivedPlaceholder: string | undefined = placeholder;
    if (!options && children) {
      React.Children.forEach(children, (node) => {
        if (!React.isValidElement(node)) return;
        const n = node as React.ReactElement<{ children?: React.ReactNode; placeholder?: string }>;
        // Unwrap SelectTrigger: look for SelectValue with placeholder
        if ((n.type as { __selectPart?: string })?.__selectPart === 'trigger') {
          React.Children.forEach(n.props.children, (inner) => {
            if (React.isValidElement(inner)) {
              const iprops = (inner as React.ReactElement<{ placeholder?: string }>).props;
              if (iprops?.placeholder) derivedPlaceholder = iprops.placeholder;
            }
          });
        }
        if ((n.type as { __selectPart?: string })?.__selectPart === 'content') {
          React.Children.forEach(n.props.children, (item) => {
            if (!React.isValidElement(item)) return;
            const it = item as React.ReactElement<{ value: string; children?: React.ReactNode }>;
            if ((it.type as { __selectPart?: string })?.__selectPart === 'item') {
              derivedOptions.push({
                value: String(it.props.value),
                label:
                  typeof it.props.children === 'string'
                    ? it.props.children
                    : String(it.props.children ?? it.props.value),
              });
            }
          });
        }
      });
    }

    const handleChange: React.ChangeEventHandler<HTMLSelectElement> = (e) => {
      onChange?.(e);
      onValueChange?.(e.target.value);
    };

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium mb-2">
            {label}
            {props.required && <span className="text-destructive ms-1">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            className={cn(
              'flex h-10 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pe-8 text-sm ring-offset-background',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-destructive focus:ring-destructive',
              className
            )}
            ref={ref}
            onChange={handleChange}
            {...props}
          >
            {derivedPlaceholder && (
              <option value="" disabled hidden>
                {derivedPlaceholder}
              </option>
            )}
            {derivedOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50 pointer-events-none" />
        </div>
        {error && <p className="text-sm text-destructive mt-1">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';

// Marker components for the compound API. They render nothing on their own;
// the root <Select> walks them to extract options. This keeps the subagent
// pages working without pulling in Radix.
const SelectTrigger: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children }) => <>{children}</>;
(SelectTrigger as unknown as { __selectPart: string }).__selectPart = 'trigger';

const SelectContent: React.FC<{ children?: React.ReactNode }> = ({ children }) => <>{children}</>;
(SelectContent as unknown as { __selectPart: string }).__selectPart = 'content';

const SelectItem: React.FC<{ value: string; children?: React.ReactNode; className?: string; disabled?: boolean }> = ({ children }) => <>{children}</>;
(SelectItem as unknown as { __selectPart: string }).__selectPart = 'item';

const SelectValue: React.FC<{ placeholder?: string }> = () => null;
(SelectValue as unknown as { __selectPart: string }).__selectPart = 'value';

export { Select, SelectTrigger, SelectContent, SelectItem, SelectValue };
