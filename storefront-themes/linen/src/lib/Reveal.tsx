import React, { useEffect, useRef, useState } from 'react';

interface RevealProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Stagger step (0–3) → 120ms increments. */
  delay?: 0 | 1 | 2 | 3;
  as?: keyof JSX.IntrinsicElements;
}

/**
 * Entrance reveal: fades + rises 16px over 1.2s once the element is 10% into
 * the viewport (rootMargin -10% bottom, threshold 0.1, fires once). Falls
 * back to visible after 1.5s in case the observer never fires (print, very
 * short pages) and is a no-op under prefers-reduced-motion via CSS.
 */
export const Reveal: React.FC<RevealProps> = ({ delay = 0, className = '', children, as = 'div', ...rest }) => {
  const ref = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) { setInView(true); io.disconnect(); } },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.1 }
    );
    io.observe(el);
    const fallback = window.setTimeout(() => setInView(true), 1500);
    return () => { io.disconnect(); window.clearTimeout(fallback); };
  }, [inView]);
  const Tag = as as any;
  return (
    <Tag ref={ref} data-delay={delay || undefined} className={`linen-reveal ${inView ? 'is-in' : ''} ${className}`} {...rest}>
      {children}
    </Tag>
  );
};

export default Reveal;
