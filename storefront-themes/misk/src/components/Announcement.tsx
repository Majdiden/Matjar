import React, { useEffect, useState } from 'react';

interface Props {
  messages: string[];
  interval: number;
  background?: string;
  color?: string;
}

/**
 * Single-line announcement bar that crossfades between messages. One line at a
 * fixed height so the header never shifts when a longer message rotates in,
 * and it stops rotating entirely under prefers-reduced-motion (the first
 * message stays, rather than snapping between them).
 */
export const Announcement: React.FC<Props> = ({ messages, interval, background, color }) => {
  const [idx, setIdx] = useState(0);
  const many = messages.length > 1;

  useEffect(() => {
    if (!many) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setIdx((i) => (i + 1) % messages.length), Math.max(2000, interval));
    return () => window.clearInterval(id);
  }, [many, messages.length, interval]);

  if (!messages.length) return null;

  return (
    <div
      className="relative overflow-hidden"
      style={{ background: background || 'var(--color-foreground, #14110e)', color: color || '#ffffff' }}
      aria-live="polite"
    >
      <div className="mx-auto grid h-10 max-w-[1320px] place-items-center px-4">
        {messages.map((m, i) => (
          <p
            key={i}
            className={`col-start-1 row-start-1 truncate text-center text-xs font-medium transition-opacity duration-500 ${i === idx ? 'opacity-100' : 'opacity-0'}`}
            aria-hidden={i !== idx}
          >
            {m}
          </p>
        ))}
      </div>
    </div>
  );
};

export default Announcement;
