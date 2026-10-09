import React from 'react';
import { FG, MUTED, PRIMARY_INK, usePageStyleTokens, type PageStyle } from '../../theme/pageStyle';

/** Readable column for the generated pages' content blocks. */
export const PageContainer: React.FC<{ className?: string; wide?: boolean; children: React.ReactNode }> = ({
  className = '',
  wide = false,
  children,
}) => <div className={`${wide ? 'max-w-5xl' : 'max-w-3xl'} mx-auto px-4 sm:px-6 ${className}`}>{children}</div>;

/** Eyebrow + h2 in the page style. */
export const SectionHeading: React.FC<{
  eyebrow?: string | null;
  title: string;
  center?: boolean;
  id?: string;
  className?: string;
}> = ({ eyebrow, title, center, id, className = '' }) => {
  const tk = usePageStyleTokens();
  const centered = center ?? tk.style === 'editorial';
  return (
    <div className={`${centered ? 'text-center' : ''} mb-5 sm:mb-6 ${className}`}>
      {eyebrow && (
        <p className={`${tk.eyebrowClass} mb-2`} style={{ color: tk.style === 'editorial' ? MUTED : PRIMARY_INK }}>
          {eyebrow}
        </p>
      )}
      <h2 id={id} className={`${tk.headingClass} leading-tight`} style={tk.heading}>
        {title}
      </h2>
      {tk.style === 'editorial' && (
        <span aria-hidden="true" className={`block h-px w-10 mt-4 ${centered ? 'mx-auto' : ''}`} style={{ background: FG, opacity: 0.35 }} />
      )}
    </div>
  );
};

/** Prose for server-sanitised page HTML, tuned per page style. */
const PROSE_BASE =
  'leading-relaxed break-words [&_p]:mb-4 [&_a]:underline [&_ul]:list-disc [&_ul]:ps-6 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:ps-6 [&_ol]:mb-4 [&_li]:mb-1.5 [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2 [&_blockquote]:border-s-4 [&_blockquote]:ps-4 [&_blockquote]:italic [&_blockquote]:opacity-80 [&_img]:max-w-full [&_img]:h-auto [&_figure]:my-6 [&_>*:last-child]:mb-0';

const PROSE_BY_STYLE: Record<PageStyle, string> = {
  editorial:
    'text-[1.0625rem] leading-8 [&_h1]:text-3xl [&_h1]:mt-10 [&_h1]:mb-4 [&_h2]:text-2xl [&_h2]:font-normal [&_h2]:mt-10 [&_h2]:mb-3 [&_h1]:[font-family:var(--font-family-heading,inherit)] [&_h2]:[font-family:var(--font-family-heading,inherit)]',
  bold: '[&_h1]:text-2xl [&_h1]:font-extrabold [&_h1]:mt-8 [&_h1]:mb-3 [&_h2]:text-xl [&_h2]:font-extrabold [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-[color:var(--page-ink)]',
  clean: '[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-8 [&_h1]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-2',
};

export const Prose: React.FC<{ html: string; className?: string }> = ({ html, className = '' }) => {
  const { style } = usePageStyleTokens();
  return (
    <div
      className={`${PROSE_BASE} ${PROSE_BY_STYLE[style]} ${className}`}
      style={{ color: FG, ['--page-ink' as string]: PRIMARY_INK }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

/** A card in the page style (body text, CTA, channel). */
export const PageCard: React.FC<{ className?: string; children: React.ReactNode; as?: 'div' | 'section' }> = ({
  className = '',
  children,
  as: Tag = 'div',
}) => {
  const tk = usePageStyleTokens();
  return (
    <Tag className={className} style={tk.card}>
      {children}
    </Tag>
  );
};
