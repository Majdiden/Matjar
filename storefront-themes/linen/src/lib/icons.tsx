import React from 'react';

type P = React.SVGProps<SVGSVGElement>;
const base = (p: P) => ({ width: 20, height: 20, fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, viewBox: '0 0 24 24', 'aria-hidden': true, ...p });

export const I = {
  search: (p: P) => <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>,
  heart: (p: P) => <svg {...base(p)}><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>,
  bag: (p: P) => <svg {...base(p)}><path d="M6 8h12l1 12H5L6 8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>,
  user: (p: P) => <svg {...base(p)}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>,
  menu: (p: P) => <svg {...base(p)}><path d="M4 7h16M4 12h16M4 17h16" /></svg>,
  close: (p: P) => <svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>,
  chevronRight: (p: P) => <svg {...base(p)}><path d="m9 6 6 6-6 6" /></svg>,
  chevronLeft: (p: P) => <svg {...base(p)}><path d="m15 6-6 6 6 6" /></svg>,
  chevronDown: (p: P) => <svg {...base(p)}><path d="m6 9 6 6 6-6" /></svg>,
  arrowRight: (p: P) => <svg {...base(p)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  plus: (p: P) => <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>,
  minus: (p: P) => <svg {...base(p)}><path d="M5 12h14" /></svg>,
  truck: (p: P) => <svg {...base(p)}><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></svg>,
  headset: (p: P) => <svg {...base(p)}><path d="M4 13v-1a8 8 0 0 1 16 0v1" /><path d="M4 13h3v5H5a1 1 0 0 1-1-1zM17 13h3v4a1 1 0 0 1-1 1h-2zM12 21h3" /></svg>,
  return: (p: P) => <svg {...base(p)}><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-4" /></svg>,
  leaf: (p: P) => <svg {...base(p)}><path d="M5 19c0-8 5-13 14-14 0 9-5 14-14 14z" /><path d="M5 19c3-4 6-7 10-9" /></svg>,
  shield: (p: P) => <svg {...base(p)}><path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z" /><path d="m9 12 2 2 4-4" /></svg>,
  share: (p: P) => <svg {...base(p)}><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.3 10.8 7.4-4.6M8.3 13.2l7.4 4.6" /></svg>,
  eye: (p: P) => <svg {...base(p)}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>,
  grid: (p: P) => <svg {...base(p)}><rect x="4" y="4" width="6" height="6" /><rect x="14" y="4" width="6" height="6" /><rect x="4" y="14" width="6" height="6" /><rect x="14" y="14" width="6" height="6" /></svg>,
  list: (p: P) => <svg {...base(p)}><path d="M4 6h16M4 12h16M4 18h16" /></svg>,
  filter: (p: P) => <svg {...base(p)}><path d="M4 6h16M7 12h10M10 18h4" /></svg>,
  instagram: (p: P) => <svg {...base(p)}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>,
  facebook: (p: P) => <svg {...base(p)}><path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z" /></svg>,
  x: (p: P) => <svg {...base(p)}><path d="M4 4l16 16M20 4 4 20" /></svg>,
  whatsapp: (p: P) => <svg {...base(p)}><path d="M4 20l1.3-3.8A8 8 0 1 1 8 19.1z" /><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.5-1.5-2-1-1 1a4 4 0 0 1-2.5-2.5l1-1-1-2z" /></svg>,
  check: (p: P) => <svg {...base(p)}><path d="m5 12 4 4L19 6" /></svg>,
  quote: (p: P) => <svg {...base({ ...p, fill: 'currentColor', stroke: 'none' })}><path d="M7 7h4v4H9v2h2v4H5v-6a4 4 0 0 1 2-4zm10 0h4v4h-2v2h2v4h-6v-6a4 4 0 0 1 2-4z" /></svg>,
  zoom: (p: P) => <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5M8 11h6M11 8v6" /></svg>,
};
