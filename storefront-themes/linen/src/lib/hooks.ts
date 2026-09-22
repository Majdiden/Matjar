import { useEffect, useRef, useState } from 'react';

/**
 * Header visibility: hide on downward scroll, reveal on upward scroll once
 * the page is scrolled past `threshold` px. Scroll deltas under 10px are
 * ignored so tiny jitters never flip it.
 */
export function useHideOnScroll(threshold = 80) {
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const last = useRef(0);
  useEffect(() => {
    last.current = window.scrollY;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY;
        const delta = y - last.current;
        setScrolled(y > 8);
        if (Math.abs(delta) < 10) return;
        if (delta > 0 && y > threshold) setHidden(true);
        else if (delta < 0) setHidden(false);
        last.current = y;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [threshold]);
  return { hidden, scrolled };
}

/** Types `text` out one character every `speed` ms; restarts when `text` changes. */
export function useTypewriter(text: string, speed = 70, active = true) {
  const [out, setOut] = useState('');
  useEffect(() => {
    if (!active) { setOut(text); return; }
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setOut(text); return; }
    setOut('');
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setOut(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, speed);
    return () => window.clearInterval(id);
  }, [text, speed, active]);
  return out;
}

/** Locks body scroll while `locked`; restores the previous value on release. */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [locked]);
}

/** Calls `onEscape` when Escape is pressed while `active`. */
export function useEscape(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onEscape(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [active, onEscape]);
}

/** Keeps Tab focus inside `ref` while `active`; focuses the first focusable on open. */
export function useFocusTrap(ref: React.RefObject<HTMLElement>, active: boolean) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const root = ref.current;
    const q = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';
    const previouslyFocused = document.activeElement as HTMLElement | null;
    // Focus the panel itself (not its first button): a tap-opened drawer
    // must not show a keyboard focus ring on the close button.
    if (!root.hasAttribute('tabindex')) root.setAttribute('tabindex', '-1');
    root.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const nodes = Array.from(root.querySelectorAll<HTMLElement>(q)).filter((n) => n.offsetParent !== null);
      if (!nodes.length) return;
      const a = nodes[0], z = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    root.addEventListener('keydown', onKey);
    return () => { root.removeEventListener('keydown', onKey); previouslyFocused?.focus?.(); };
  }, [ref, active]);
}

/** Small localStorage-backed state (per browser). */
export function useStoredState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : initial; } catch { return initial; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }, [key, value]);
  return [value, setValue] as const;
}
