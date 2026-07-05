import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '../contexts/StoreContext';
import { POLICY_KEYS, policyLabel, type PolicyKey } from '../lib/policies';

/**
 * Renders a single merchant-authored store policy (privacy / returns /
 * delivery / cod) at `/policies/:key`. The body is server-sanitised HTML, so
 * it's safe to inject. Unknown keys redirect home; a known-but-unpublished
 * policy shows a short empty state.
 */
const PolicyPage: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { key } = useParams<{ key: string }>();
  const { store } = useStore();
  const { t } = useTranslation(['common']);

  if (!key || !POLICY_KEYS.includes(key as PolicyKey)) {
    return <Navigate to="/" replace />;
  }

  const policy = store?.policies?.[key];
  const title = (policy?.title && policy.title.trim()) || policyLabel(key as PolicyKey, t);

  return (
    <div className={`max-w-3xl mx-auto px-4 sm:px-6 py-12 ${className}`}>
      <h1 className="text-3xl font-bold mb-6" style={{ color: 'var(--color-foreground)' }}>
        {title}
      </h1>
      {policy?.body ? (
        <div
          className="leading-relaxed [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-2 [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_p]:mb-4 [&_a]:underline [&_ul]:list-disc [&_ul]:ps-6 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:ps-6 [&_ol]:mb-4 [&_li]:mb-1 [&_blockquote]:border-s-4 [&_blockquote]:ps-4 [&_blockquote]:italic [&_blockquote]:opacity-80"
          style={{ color: 'var(--color-foreground)' }}
          dangerouslySetInnerHTML={{ __html: policy.body }}
        />
      ) : (
        <p className="opacity-70" style={{ color: 'var(--color-foreground)' }}>
          {t('common:storefront.policies.empty', { defaultValue: "This policy hasn't been published yet." })}
        </p>
      )}
    </div>
  );
};

export default PolicyPage;
