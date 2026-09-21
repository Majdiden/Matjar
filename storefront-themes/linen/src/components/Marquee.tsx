import React from 'react';

/**
 * Announcement marquee: the messages scroll continuously (30s linear), the
 * track is rendered twice for a seamless loop, hover pauses it, and under
 * prefers-reduced-motion the CSS turns the animation off so the row reads
 * as a static, centred list.
 */
export const Marquee: React.FC<{ messages: string[] }> = ({ messages }) => {
  const list = messages.map((m) => m.trim()).filter(Boolean);
  if (!list.length) return null;
  const Track = ({ hidden }: { hidden?: boolean }) => (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {list.map((m, i) => (
        <li key={i} className="linen-eyebrow flex items-center whitespace-nowrap px-8 text-[0.7rem] text-white/85">
          {m}
          <span className="ms-8 inline-block h-1 w-1 rounded-full bg-bronze" aria-hidden />
        </li>
      ))}
    </ul>
  );
  return (
    <div className="linen-marquee overflow-hidden bg-ink py-2.5" role="region" aria-label="Announcements">
      <div className="linen-marquee-track motion-reduce:w-full motion-reduce:justify-center">
        <Track />
        <Track hidden />
      </div>
    </div>
  );
};

export default Marquee;
