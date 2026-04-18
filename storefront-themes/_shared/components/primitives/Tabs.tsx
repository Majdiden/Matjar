import React, { useState, createContext, useContext } from 'react';
import { cn } from '../../utils/cn';

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (id: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

interface TabsProps {
  defaultTab?: string;
  children: React.ReactNode;
  className?: string;
  onChange?: (tabId: string) => void;
}

export function Tabs({ defaultTab, children, className, onChange }: TabsProps) {
  const [activeTab, setActiveTabState] = useState(defaultTab || '');

  const setActiveTab = (id: string) => {
    setActiveTabState(id);
    onChange?.(id);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

function useTabsContext() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Tabs subcomponents must be used within <Tabs>');
  return ctx;
}

Tabs.List = function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex border-b', className)} role="tablist">
      {children}
    </div>
  );
};

Tabs.Tab = function Tab({
  id,
  children,
  className,
  activeClassName,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
  activeClassName?: string;
}) {
  const { activeTab, setActiveTab } = useTabsContext();
  const isActive = activeTab === id;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      aria-controls={`panel-${id}`}
      onClick={() => setActiveTab(id)}
      className={cn(
        'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
        isActive
          ? cn('border-current text-gray-900 dark:text-white', activeClassName)
          : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400',
        className
      )}
    >
      {children}
    </button>
  );
};

Tabs.Panel = function TabPanel({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { activeTab } = useTabsContext();
  if (activeTab !== id) return null;

  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={id} className={cn('py-4', className)}>
      {children}
    </div>
  );
};
