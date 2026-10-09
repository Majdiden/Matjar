import React from 'react';
import { FG, MUTED, usePageStyleTokens } from '../../theme/pageStyle';
import type { PageFact } from '../../hooks/usePageFacts';
import { PageIcon } from './PageIcon';

/** Values longer than this take a full row so they don't wrap into a sliver. */
const WIDE_VALUE_LENGTH = 22;

/**
 * Icon cards for short store facts ("Serving you since 2019", "We deliver
 * to …"). Two columns on phones, three on wider screens; renders nothing
 * without facts.
 */
export const FactGrid: React.FC<{ facts: PageFact[]; className?: string; label?: string }> = ({
  facts,
  className = '',
  label,
}) => {
  const tk = usePageStyleTokens();
  if (!facts.length) return null;
  const { style } = tk;
  const iconSize = style === 'bold' ? 'h-12 w-12' : style === 'clean' ? 'h-10 w-10' : 'h-7 w-7';
  const single = facts.length === 1;
  // Narrow cards pair up two per row; long values take a full row after them.
  // An odd narrow card out stretches across its row instead of leaving a hole.
  const isWide = (f: PageFact) => single || f.value.length > WIDE_VALUE_LENGTH;
  const narrow = facts.filter((f) => !isWide(f));
  const lonely = narrow.length % 2 === 1 ? narrow[narrow.length - 1].key : null;
  const paired = narrow.filter((f) => f.key !== lonely);
  const ordered = [...paired, ...facts.filter((f) => !paired.includes(f))];

  return (
    <ul
      className={`grid ${single ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3'} ${style === 'editorial' ? 'gap-x-6 gap-y-2' : 'gap-3'} ${className}`}
      aria-label={label}
    >
      {ordered.map((fact) => {
        // The odd card out spans its row (on phones), so lay it out like a wide one.
        const wide = isWide(fact) || fact.key === lonely;
        return (
          <li
            key={fact.key}
            className={`${single ? '' : fact.key === lonely ? 'col-span-2 sm:col-span-1' : wide ? 'col-span-2 sm:col-span-3' : ''} ${style === 'editorial' ? 'pt-4 pb-3' : 'p-4'} flex ${
              wide ? 'items-center gap-4' : 'flex-col gap-3'
            }`}
            style={tk.card}
          >
            <span className={`inline-flex items-center justify-center ${iconSize}`} style={tk.iconBox}>
              <PageIcon
                name={fact.icon}
                className={style === 'bold' ? 'w-6 h-6' : 'w-5 h-5'}
                strokeWidth={style === 'bold' ? 2 : style === 'editorial' ? 1.4 : 1.75}
              />
            </span>
            <span className="min-w-0">
              <span
                className={`block ${style === 'editorial' ? tk.eyebrowClass : 'text-xs sm:text-sm'} mb-1`}
                style={{ color: MUTED }}
              >
                {fact.label}
              </span>
              <span
                className={`block break-words leading-snug ${
                  style === 'bold' ? 'text-lg font-extrabold' : style === 'editorial' ? 'text-lg' : 'text-base font-semibold'
                }`}
                style={{ color: FG, ...(style === 'editorial' ? { fontFamily: tk.heading.fontFamily } : {}) }}
              >
                {fact.value}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
};

export default FactGrid;
