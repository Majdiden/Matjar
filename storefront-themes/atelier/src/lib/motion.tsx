import React, { useEffect, useId, useRef, useState } from 'react';

/** True when the visitor prefers reduced motion (evaluated on the client only). */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Reveal-on-scroll wrapper. IntersectionObserver with a 10% bottom
 * margin and a 0.1 threshold, fires once; falls back to visible when the
 * page bottom is reached (short pages) or when IO is unavailable.
 */
export const Reveal: React.FC<{ children: React.ReactNode; delay?: number; className?: string; as?: keyof JSX.IntrinsicElements; style?: React.CSSProperties }> = ({
  children, delay = 0, className = '', as = 'div', style,
}) => {
  const ref = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setInView(true); io.disconnect(); }
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
    io.observe(el);
    const onScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 50) { setInView(true); io.disconnect(); }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { io.disconnect(); window.removeEventListener('scroll', onScroll); };
  }, []);
  const Tag = as as any;
  return (
    <Tag ref={ref} className={`at-reveal ${inView ? 'is-in' : ''} ${className}`} style={{ ...style, animationDelay: delay ? `${delay}ms` : undefined }}>
      {children}
    </Tag>
  );
};

/** Counts from 0 to `value` over `duration` ms (linear) once in view; keeps the decimals of the input. */
export const CountUp: React.FC<{ value: string; duration?: number; className?: string }> = ({ value, duration = 2000, className }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState('0');
  const target = parseFloat(String(value).replace(/,/g, ''));
  const decimals = (String(value).split('.')[1] || '').length;
  const useGrouping = /,/.test(String(value)) || (decimals === 0 && target >= 10000);
  useEffect(() => {
    const el = ref.current;
    if (!el || !Number.isFinite(target)) { setDisplay(String(value)); return; }
    const fmt = (n: number) => (useGrouping ? n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : n.toFixed(decimals));
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') { setDisplay(fmt(target)); return; }
    let raf = 0;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / duration);
        setDisplay(fmt(target * p));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.3 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [target, decimals, duration, useGrouping, value]);
  return <span ref={ref} className={className}>{display}</span>;
};

/** Continuous marquee: the track is rendered twice; animation starts 500ms after mount. */
export const Marquee: React.FC<{ items: React.ReactNode[]; duration?: number; className?: string; itemClassName?: string }> = ({ items, duration = 10, className = '', itemClassName = '' }) => {
  const [running, setRunning] = useState(false);
  useEffect(() => { const t = setTimeout(() => setRunning(true), 500); return () => clearTimeout(t); }, []);
  const row = (key: string, hidden = false) => (
    <div key={key} className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {items.map((it, i) => (
        <span key={i} className={`flex items-center whitespace-nowrap ${itemClassName}`}>
          {it}
          <span className="mx-6 sm:mx-10 inline-block h-1.5 w-1.5 rounded-full bg-current opacity-60" aria-hidden />
        </span>
      ))}
    </div>
  );
  return (
    <div className={`at-marquee overflow-hidden ${className}`}>
      <div className={`at-marquee-track flex w-max ${running ? 'is-running' : ''}`} style={{ ['--at-marquee-duration' as any]: `${duration}s` }}>
        {row('a')}{row('b', true)}
      </div>
    </div>
  );
};

/** Types `text` out one character at a time (70ms/char); returns the current slice. */
export function useTypewriter(text: string, active: boolean, speed = 70): string {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active) { setN(0); return; }
    if (prefersReducedMotion()) { setN(text.length); return; }
    setN(0);
    let i = 0;
    const id = setInterval(() => { i += 1; setN(i); if (i >= text.length) clearInterval(id); }, speed);
    return () => clearInterval(id);
  }, [text, active, speed]);
  return text.slice(0, n);
}

/**
 * Reveal-on-scroll-up header state. Deltas under 10px are ignored; hides on
 * any downward scroll past the threshold, shows on upward scroll.
 */
export function useStickyReveal(enabled: boolean, threshold: number) {
  const [shown, setShown] = useState(false);
  const [past, setPast] = useState(false);
  useEffect(() => {
    if (!enabled) { setShown(false); setPast(false); return; }
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - last;
      const isPast = y > threshold;
      setPast(isPast);
      if (Math.abs(delta) < 10) return;
      if (delta > 0 || !isPast) setShown(false);
      else setShown(true);
      last = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [enabled, threshold]);
  return { shown: enabled && shown && past, past };
}

/** Locks body scroll while `locked` is true (reference counted across overlays). */
let lockCount = 0;
export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    lockCount += 1;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { lockCount = Math.max(0, lockCount - 1); if (lockCount === 0) document.body.style.overflow = prev; };
  }, [locked]);
}

/** Escape closes; focus moves into the panel and is trapped while open. */
export function useOverlayA11y(open: boolean, onClose: () => void, ref: React.RefObject<HTMLElement>) {
  useScrollLock(open);
  useEffect(() => {
    if (!open) return;
    const panel = ref.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(panel?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])') || []).filter((el) => el.offsetParent !== null);
    const first = focusables()[0];
    (first || panel)?.focus?.();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (!list.length) return;
      const firstEl = list[0]; const lastEl = list[list.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previouslyFocused?.focus?.(); };
  }, [open, onClose, ref]);
}

/** Drag comparison. One CSS variable drives the clip, the handle and the label opacity. */
export const BeforeAfter: React.FC<{ before: string; after: string; beforeLabel: string; afterLabel: string; className?: string }> = ({ before, after, beforeLabel, afterLabel, className = '' }) => {
  const wrap = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(50);
  const dragging = useRef(false);
  const rect = useRef<DOMRect | null>(null);
  const id = useId();
  const update = (clientX: number) => {
    const r = rect.current; if (!r) return;
    const rtl = document.documentElement.dir === 'rtl';
    let p = ((clientX - r.left) / r.width) * 100;
    if (rtl) p = 100 - p;
    setPos(Math.max(0, Math.min(100, p)));
  };
  const onDown = (e: React.PointerEvent) => {
    rect.current = wrap.current?.getBoundingClientRect() || null; // recomputed on every drag start
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    update(e.clientX);
  };
  const onMove = (e: React.PointerEvent) => { if (dragging.current) update(e.clientX); };
  const onUp = () => { dragging.current = false; };
  return (
    <div
      ref={wrap}
      className={`relative select-none overflow-hidden at-card touch-none ${className}`}
      style={{ ['--pos' as any]: `${pos}%` }}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
    >
      <img src={after} alt="" className="block w-full h-full object-cover" draggable={false} />
      <img
        src={before} alt="" draggable={false}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ clipPath: document?.documentElement?.dir === 'rtl' ? 'inset(0 0 0 calc(100% - var(--pos)))' : 'inset(0 calc(100% - var(--pos)) 0 0)' }}
      />
      <span className="absolute top-4 start-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#1c1c1c]" style={{ opacity: 'calc(var(--pos) / 100%)' as any }}>{beforeLabel}</span>
      <span className="absolute top-4 end-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#1c1c1c]" style={{ opacity: 'calc(1 - var(--pos) / 100%)' as any }}>{afterLabel}</span>
      <div className="absolute top-0 bottom-0 w-0.5 bg-white" style={{ insetInlineStart: 'var(--pos)', transform: 'translateX(-50%)' }} aria-hidden>
        <span className="absolute top-1/2 start-1/2 -translate-x-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#1c1c1c] shadow-[0_2px_10px_#0000001a]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 7l-5 5 5 5M16 7l5 5-5 5" /></svg>
        </span>
      </div>
      <label htmlFor={id} className="sr-only">{beforeLabel} / {afterLabel}</label>
      <input id={id} type="range" min={0} max={100} value={Math.round(pos)} onChange={(e) => setPos(Number(e.target.value))} className="sr-only" />
    </div>
  );
};

/** Countdown to `endDate`; optional daily restart (local end-of-day) once expired. Invalid dates render null. */
export function useCountdown(endDate: string | undefined, repeatDaily: boolean) {
  const [left, setLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);
  useEffect(() => {
    if (!endDate) { setLeft(null); return; }
    const parsed = new Date(endDate);
    if (Number.isNaN(parsed.getTime())) { setLeft(null); return; }
    const endOfToday = () => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0); };
    let target = parsed;
    const tick = () => {
      let diff = target.getTime() - Date.now();
      if (diff <= 0) {
        if (repeatDaily) { target = endOfToday(); diff = target.getTime() - Date.now(); }
        else { setLeft({ d: 0, h: 0, m: 0, s: 0 }); return; }
      }
      const s = Math.floor(diff / 1000);
      setLeft({ d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endDate, repeatDaily]);
  return left;
}

/** Small inline icon set used by icon blocks. */
export const Icon: React.FC<{ name: string; className?: string }> = ({ name, className = 'w-6 h-6' }) => {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const paths: Record<string, React.ReactNode> = {
    leaf: <path d="M5 21c0-9 5-14 14-16-1 9-6 14-14 16zM5 21c3-5 6-8 10-11" />,
    droplet: <path d="M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z" />,
    shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM9 12l2 2 4-4" />,
    heart: <path d="M12 21s-8-5-8-11a4 4 0 018-1 4 4 0 018 1c0 6-8 11-8 11z" />,
    sparkle: <path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2zM19 15l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" />,
    truck: <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7zM7 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM17 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />,
    return: <path d="M4 10h11a4 4 0 010 8H9M4 10l4-4M4 10l4 4" />,
    wallet: <path d="M3 7h16a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM3 7a2 2 0 012-2h11v2M16 13h5" />,
    headset: <path d="M4 14v-2a8 8 0 0116 0v2M4 14h3v5H5a1 1 0 01-1-1v-4zM20 14h-3v5h2a1 1 0 001-1v-4zM12 21h3" />,
    check: <path d="M20 6L9 17l-5-5" />,
    sun: <path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4M12 8a4 4 0 100 8 4 4 0 000-8z" />,
    flask: <path d="M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3M8 15h8" />,
  };
  return <svg className={className} viewBox="0 0 24 24" {...p} aria-hidden>{paths[name] || paths.sparkle}</svg>;
};
