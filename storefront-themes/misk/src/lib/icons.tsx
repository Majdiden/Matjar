import React from 'react';

type P = React.SVGProps<SVGSVGElement>;
const base = (p: P) => ({
  width: 20, height: 20, fill: 'none', stroke: 'currentColor', strokeWidth: 1.6,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, viewBox: '0 0 24 24',
  'aria-hidden': true, ...p,
});

export const I = {
  // chrome
  search: (p: P) => <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>,
  heart: (p: P) => <svg {...base(p)}><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>,
  heartFilled: (p: P) => <svg {...base({ ...p, fill: 'currentColor', stroke: 'currentColor' })}><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>,
  bag: (p: P) => <svg {...base(p)}><path d="M6 8h12l1 12H5L6 8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>,
  user: (p: P) => <svg {...base(p)}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>,
  menu: (p: P) => <svg {...base(p)}><path d="M4 7h16M4 12h16M4 17h16" /></svg>,
  close: (p: P) => <svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>,
  chevronRight: (p: P) => <svg {...base(p)}><path d="m9 6 6 6-6 6" /></svg>,
  chevronLeft: (p: P) => <svg {...base(p)}><path d="m15 6-6 6 6 6" /></svg>,
  chevronDown: (p: P) => <svg {...base(p)}><path d="m6 9 6 6 6-6" /></svg>,
  chevronUp: (p: P) => <svg {...base(p)}><path d="m6 15 6-6 6 6" /></svg>,
  arrowRight: (p: P) => <svg {...base(p)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  plus: (p: P) => <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>,
  minus: (p: P) => <svg {...base(p)}><path d="M5 12h14" /></svg>,
  check: (p: P) => <svg {...base(p)}><path d="m5 12 4 4L19 6" /></svg>,
  eye: (p: P) => <svg {...base(p)}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>,
  grid: (p: P) => <svg {...base(p)}><rect x="4" y="4" width="6" height="6" /><rect x="14" y="4" width="6" height="6" /><rect x="4" y="14" width="6" height="6" /><rect x="14" y="14" width="6" height="6" /></svg>,
  list: (p: P) => <svg {...base(p)}><path d="M4 6h16M4 12h16M4 18h16" /></svg>,
  filter: (p: P) => <svg {...base(p)}><path d="M4 6h16M7 12h10M10 18h4" /></svg>,
  star: (p: P) => <svg {...base({ ...p, fill: 'currentColor', stroke: 'none' })}><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" /></svg>,
  quote: (p: P) => <svg {...base({ ...p, fill: 'currentColor', stroke: 'none' })}><path d="M7 7h4v4H9v2h2v4H5v-6a4 4 0 0 1 2-4zm10 0h4v4h-2v2h2v4h-6v-6a4 4 0 0 1 2-4z" /></svg>,
  zoom: (p: P) => <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5M8 11h6M11 8v6" /></svg>,
  phone: (p: P) => <svg {...base(p)}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" /></svg>,
  mail: (p: P) => <svg {...base(p)}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 7 8.5 6 8.5-6" /></svg>,
  pin: (p: P) => <svg {...base(p)}><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z" /><circle cx="12" cy="10" r="2.6" /></svg>,

  // promise / feature icons (manifest ICON_OPTIONS)
  truck: (p: P) => <svg {...base(p)}><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></svg>,
  return: (p: P) => <svg {...base(p)}><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-4" /></svg>,
  clock: (p: P) => <svg {...base(p)}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>,
  transfer: (p: P) => <svg {...base(p)}><path d="M7 20l-4-4 4-4M3 16h13" /><path d="m17 4 4 4-4 4M21 8H8" /></svg>,
  wallet: (p: P) => <svg {...base(p)}><path d="M4 7h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4z" /><path d="M4 7V5.5A1.5 1.5 0 0 1 5.5 4H16" /><circle cx="16.5" cy="13" r="1.2" fill="currentColor" stroke="none" /></svg>,
  headset: (p: P) => <svg {...base(p)}><path d="M4 13v-1a8 8 0 0 1 16 0v1" /><path d="M4 13h3v5H5a1 1 0 0 1-1-1zM17 13h3v4a1 1 0 0 1-1 1h-2zM12 21h3" /></svg>,
  shield: (p: P) => <svg {...base(p)}><path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z" /><path d="m9 12 2 2 4-4" /></svg>,
  leaf: (p: P) => <svg {...base(p)}><path d="M5 19c0-8 5-13 14-14 0 9-5 14-14 14z" /><path d="M5 19c3-4 6-7 10-9" /></svg>,
  droplet: (p: P) => <svg {...base(p)}><path d="M12 3s6 6.5 6 10.5a6 6 0 0 1-12 0C6 9.5 12 3 12 3z" /></svg>,
  sparkle: (p: P) => <svg {...base(p)}><path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.8L12 18l-1.7-5.5L4.8 10.7 10.3 9z" /><path d="M18.5 4.5 19 6l1.5.5L19 7l-.5 1.5L18 7l-1.5-.5L18 6z" /></svg>,
  flask: (p: P) => <svg {...base(p)}><path d="M10 3h4M11 3v6l-5 8.5A2 2 0 0 0 7.8 21h8.4a2 2 0 0 0 1.8-3.5L13 9V3" /><path d="M8.4 15h7.2" /></svg>,
  gift: (p: P) => <svg {...base(p)}><rect x="3" y="8" width="18" height="12" rx="1.5" /><path d="M3 12h18M12 8v12" /><path d="M12 8S10.5 4 8.5 4a2 2 0 0 0 0 4zM12 8s1.5-4 3.5-4a2 2 0 0 1 0 4z" /></svg>,

  // social
  instagram: (p: P) => <svg {...base(p)}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>,
  facebook: (p: P) => <svg {...base(p)}><path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z" /></svg>,
  x: (p: P) => <svg {...base(p)}><path d="M4 4l16 16M20 4 4 20" /></svg>,
  youtube: (p: P) => <svg {...base(p)}><rect x="3" y="6" width="18" height="12" rx="3" /><path d="m11 10 4 2-4 2z" /></svg>,
  tiktok: (p: P) => <svg {...base(p)}><path d="M14 4v9.5a3.5 3.5 0 1 1-3-3.46" /><path d="M14 4c.6 2.3 2.2 3.6 4.5 3.8" /></svg>,
  whatsapp: (p: P) => <svg {...base(p)}><path d="M4 20l1.3-3.8A8 8 0 1 1 8 19.1z" /><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.5-1.5-2-1-1 1a4 4 0 0 1-2.5-2.5l1-1-1-2z" /></svg>,
};

/** Resolve a manifest `icon` select value to a component, with a safe fallback. */
export const iconFor = (name?: string): ((p: P) => JSX.Element) =>
  (name && (I as Record<string, any>)[name]) || I.sparkle;
