import { useState, useEffect, useRef, type RefObject } from 'react';

interface UseIntersectionObserverOptions {
  threshold?: number | number[];
  rootMargin?: string;
  /** Only trigger once (default: true) */
  triggerOnce?: boolean;
  /**
   * Safety net: reveal after this many ms even if the observer never fires,
   * so scroll-reveal content can NEVER get permanently stuck invisible
   * (e.g. an observer that silently fails). Generous by default so it does
   * not defeat genuine scroll reveals. Set 0 to disable.
   */
  fallbackMs?: number;
}

interface UseIntersectionObserverResult {
  ref: RefObject<HTMLElement | null>;
  isIntersecting: boolean;
  entry: IntersectionObserverEntry | null;
}

const supportsIO =
  typeof window !== 'undefined' && 'IntersectionObserver' in window;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Scroll-reveal observer hook. Used across theme homes to fade/slide
 * sections in as they enter the viewport.
 *
 * Robustness (critical for "stable on any device"): if the user prefers
 * reduced motion, or IntersectionObserver is unavailable, it starts
 * already-revealed so content shows immediately rather than being hidden
 * behind an animation that will never run. A generous fallback timer is a
 * last-resort safety net against a stuck-invisible section.
 */
export function useIntersectionObserver(
  options: UseIntersectionObserverOptions = {}
): UseIntersectionObserverResult {
  const {
    threshold = 0,
    rootMargin = '0px 0px -8% 0px',
    triggerOnce = true,
    fallbackMs = 1500,
  } = options;
  const ref = useRef<HTMLElement | null>(null);
  // Start visible when we can't (or shouldn't) animate.
  const [isIntersecting, setIsIntersecting] = useState<boolean>(
    () => !supportsIO || prefersReducedMotion()
  );
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);

  useEffect(() => {
    if (isIntersecting) return; // already revealed — nothing to observe

    let observer: IntersectionObserver | undefined;
    let raf = 0;

    // The observed element may not exist yet when this effect first runs — it's
    // common for a section to be conditionally rendered (e.g. only after async
    // data loads: `categories.length > 0 && <Section ref={ref} />`). Refs aren't
    // reactive, so we retry on animation frames until the node attaches, then
    // observe it. Without this the observer was never created and the section
    // stayed stuck invisible (opacity-0) forever.
    const attach = () => {
      const element = ref.current;
      if (!element) {
        raf = window.requestAnimationFrame(attach);
        return;
      }
      observer = new IntersectionObserver(
        ([e]) => {
          if (e.isIntersecting) {
            setIsIntersecting(true);
            setEntry(e);
            if (triggerOnce) observer?.unobserve(element);
          } else if (!triggerOnce) {
            setIsIntersecting(false);
            setEntry(e);
          }
        },
        { threshold, rootMargin }
      );
      observer.observe(element);
    };
    attach();

    // Safety net: reveal after `fallbackMs` no matter what — set unconditionally
    // (even before the element mounts) so a never-appearing/observer-less node
    // can't stay hidden. Generous by default so it doesn't defeat real reveals.
    const timer =
      fallbackMs > 0
        ? window.setTimeout(() => setIsIntersecting(true), fallbackMs)
        : undefined;

    return () => {
      observer?.disconnect();
      if (raf) window.cancelAnimationFrame(raf);
      if (timer) window.clearTimeout(timer);
    };
  }, [threshold, rootMargin, triggerOnce, fallbackMs, isIntersecting]);

  return { ref, isIntersecting, entry };
}
