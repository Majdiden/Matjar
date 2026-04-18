import { useState, useEffect } from 'react';

type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const breakpoints: Record<Breakpoint, number> = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

interface ViewportState {
  width: number;
  height: number;
  breakpoint: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

export function useViewport(): ViewportState {
  const [state, setState] = useState<ViewportState>(() => getState());

  useEffect(() => {
    const handler = () => setState(getState());
    window.addEventListener('resize', handler, { passive: true });
    return () => window.removeEventListener('resize', handler);
  }, []);

  return state;
}

function getState(): ViewportState {
  const width = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const height = typeof window !== 'undefined' ? window.innerHeight : 768;

  let breakpoint: Breakpoint = 'xs';
  for (const [bp, min] of Object.entries(breakpoints) as [Breakpoint, number][]) {
    if (width >= min) breakpoint = bp;
  }

  return {
    width,
    height,
    breakpoint,
    isMobile: width < breakpoints.md,
    isTablet: width >= breakpoints.md && width < breakpoints.lg,
    isDesktop: width >= breakpoints.lg,
  };
}
