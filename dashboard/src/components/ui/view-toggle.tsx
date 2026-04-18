import React, { useState } from 'react';
import { LayoutGrid, List } from 'lucide-react';

export type ViewMode = 'table' | 'cards';

const isValidMode = (v: unknown): v is ViewMode => v === 'table' || v === 'cards';

export const useViewMode = (
  storageKey: string,
  defaultMode: ViewMode = 'table'
): [ViewMode, (m: ViewMode) => void] => {
  const [mode, setModeState] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return defaultMode;
    const stored = window.localStorage.getItem(storageKey);
    return isValidMode(stored) ? stored : defaultMode;
  });
  const setMode = (m: ViewMode) => {
    setModeState(m);
    if (typeof window !== 'undefined') window.localStorage.setItem(storageKey, m);
  };
  return [mode, setMode];
};

export const ViewToggle: React.FC<{ mode: ViewMode; onChange: (m: ViewMode) => void }> = ({ mode, onChange }) => (
  <div className="inline-flex rounded-md border bg-background p-0.5">
    <button
      type="button"
      onClick={() => onChange('cards')}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
        mode === 'cards' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
      }`}
      aria-pressed={mode === 'cards'}
    >
      <LayoutGrid className="h-3.5 w-3.5" /> Cards
    </button>
    <button
      type="button"
      onClick={() => onChange('table')}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
        mode === 'table' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
      }`}
      aria-pressed={mode === 'table'}
    >
      <List className="h-3.5 w-3.5" /> Table
    </button>
  </div>
);
