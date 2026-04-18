import React, { useState, createContext, useContext } from 'react';
import { cn } from '../../utils/cn';

interface AccordionContextValue {
  openItems: Set<string>;
  toggle: (id: string) => void;
}

const AccordionContext = createContext<AccordionContextValue | null>(null);

interface AccordionProps {
  children: React.ReactNode;
  className?: string;
  /** Allow multiple items open at once */
  multiple?: boolean;
  /** Default open item IDs */
  defaultOpen?: string[];
}

export function Accordion({ children, className, multiple = false, defaultOpen = [] }: AccordionProps) {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set(defaultOpen));

  const toggle = (id: string) => {
    setOpenItems(prev => {
      const next = new Set(multiple ? prev : []);
      if (prev.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <AccordionContext.Provider value={{ openItems, toggle }}>
      <div className={cn('divide-y', className)}>{children}</div>
    </AccordionContext.Provider>
  );
}

function useAccordionContext() {
  const ctx = useContext(AccordionContext);
  if (!ctx) throw new Error('Accordion.Item must be used within <Accordion>');
  return ctx;
}

Accordion.Item = function AccordionItem({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={className} data-accordion-item={id}>{children}</div>;
};

Accordion.Trigger = function AccordionTrigger({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { openItems, toggle } = useAccordionContext();
  const isOpen = openItems.has(id);

  return (
    <button
      onClick={() => toggle(id)}
      className={cn(
        'flex w-full items-center justify-between py-4 text-left font-medium transition-colors hover:text-gray-600',
        className
      )}
      aria-expanded={isOpen}
      aria-controls={`accordion-content-${id}`}
    >
      {children}
      <svg
        className={cn('w-4 h-4 shrink-0 transition-transform duration-200', isOpen && 'rotate-180')}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
};

Accordion.Content = function AccordionContent({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { openItems } = useAccordionContext();
  const isOpen = openItems.has(id);

  return (
    <div
      id={`accordion-content-${id}`}
      role="region"
      className={cn(
        'overflow-hidden transition-all duration-300',
        isOpen ? 'max-h-[2000px] opacity-100 pb-4' : 'max-h-0 opacity-0'
      )}
    >
      <div className={className}>{children}</div>
    </div>
  );
};
