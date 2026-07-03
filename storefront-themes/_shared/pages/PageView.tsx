import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { usePage } from '../hooks/usePage';
import NotFound from './NotFound';

interface PageViewProps {
  className?: string;
}

/**
 * Storefront view for merchant-authored CMS pages at /pages/:slug.
 * Fetches the published page via usePage (unpublished/missing slugs 404),
 * sets metaTitle/metaDescription in the document head, and renders the
 * server-sanitized HTML with the same prose treatment About.tsx uses.
 */
const PageView: React.FC<PageViewProps> = ({ className = '' }) => {
  const { slug } = useParams<{ slug: string }>();
  const { page, loading } = usePage(slug);

  // Head management: About.tsx doesn't manage the head, so keep this simple —
  // set document.title (+ meta description) while the page is mounted and
  // restore the previous values on unmount.
  useEffect(() => {
    if (!page) return;
    const prevTitle = document.title;
    document.title = page.metaTitle || page.title;

    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    const prevDescription = meta ? meta.getAttribute('content') : null;
    let createdMeta = false;
    if (page.metaDescription) {
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'description');
        document.head.appendChild(meta);
        createdMeta = true;
      }
      meta.setAttribute('content', page.metaDescription);
    }

    return () => {
      document.title = prevTitle;
      if (meta && page.metaDescription) {
        if (createdMeta) meta.remove();
        else if (prevDescription != null) meta.setAttribute('content', prevDescription);
      }
    };
  }, [page]);

  if (loading) {
    return (
      <div className={`max-w-3xl mx-auto px-4 sm:px-6 py-12 ${className}`}>
        <div className="animate-pulse" aria-hidden="true">
          <div className="h-8 w-2/3 bg-gray-200 rounded mb-8" />
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded" />
            <div className="h-4 bg-gray-200 rounded w-11/12" />
            <div className="h-4 bg-gray-200 rounded w-4/5" />
            <div className="h-4 bg-gray-200 rounded w-3/5" />
          </div>
        </div>
      </div>
    );
  }

  if (!page) {
    return <NotFound className={className} />;
  }

  return (
    <div className={`max-w-3xl mx-auto px-4 sm:px-6 py-12 ${className}`}>
      <h1 className="text-3xl font-bold mb-6">{page.title}</h1>
      <div
        className="leading-relaxed [&_h2]:font-semibold [&_h2]:text-xl [&_h2]:mt-6 [&_h2]:mb-2 [&_p]:mb-4 [&_a]:underline [&_ul]:list-disc [&_ul]:ps-6 [&_ul]:mb-4"
        dangerouslySetInnerHTML={{ __html: page.content }}
      />
    </div>
  );
};

export default PageView;
