import React, { createContext, useContext, useMemo } from 'react';

// Generalized theme-override registry. Any shared SDK component can expose a
// slot key; a theme wraps <App> in <ThemeSlotsProvider slots={{...}}> to swap
// in its own implementation for that slot. Slots that aren't registered fall
// back to the SDK's built-in component.
//
// Keep the slot map open-ended (string → any renderer/component) so new SDK
// components can register slots without changing this file. Themes and SDK
// consumers share string keys — document them where the consuming component
// lives, not here.

export type ThemeSlotMap = Record<string, unknown>;

const ThemeSlotsContext = createContext<ThemeSlotMap>({});

export function ThemeSlotsProvider({
  slots,
  children,
}: {
  slots: ThemeSlotMap;
  children: React.ReactNode;
}) {
  // Merge with any outer provider so nested wrappers (e.g. a section-level
  // override inside an app-level provider) compose instead of clobbering.
  const outer = useContext(ThemeSlotsContext);
  const merged = useMemo(() => ({ ...outer, ...slots }), [outer, slots]);
  return <ThemeSlotsContext.Provider value={merged}>{children}</ThemeSlotsContext.Provider>;
}

/** Returns the theme's override for `key`, or null when none registered. */
export function useThemeSlot<T = unknown>(key: string): T | null {
  const slots = useContext(ThemeSlotsContext);
  const value = slots[key];
  return (value == null ? null : (value as T));
}
