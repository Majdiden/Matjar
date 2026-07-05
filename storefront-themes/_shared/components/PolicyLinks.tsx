import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '../contexts/StoreContext';
import { publishedPolicies } from '../lib/policies';

/**
 * A list of links to the store's published policies (privacy / returns /
 * delivery / cod). Renders nothing when the merchant hasn't published any, so
 * it's safe to drop into any footer or menu unconditionally.
 *
 * Colours inherit from the surrounding container (footers set their own text
 * colour), so this reads correctly on light and dark footers alike.
 */
export function PolicyLinks({
  className = '',
  heading,
  linkClassName = 'hover:underline opacity-80 hover:opacity-100 transition',
  onNavigate,
  inline = false,
}: {
  className?: string;
  /** Show a heading above the links. Pass `false` to hide it. */
  heading?: string | false;
  linkClassName?: string;
  onNavigate?: () => void;
  /** Render the links as a horizontal wrap (e.g. checkout) instead of a list. */
  inline?: boolean;
}) {
  const { store } = useStore();
  const { t } = useTranslation(['common']);
  const policies = publishedPolicies(store, t);
  if (!policies.length) return null;

  if (inline) {
    return (
      <div className={className}>
        {policies.map((p) => (
          <Link key={p.key} to={p.path} onClick={onNavigate} className={linkClassName}>
            {p.title}
          </Link>
        ))}
      </div>
    );
  }

  const headingText =
    heading === false
      ? null
      : heading || t('common:storefront.policies.heading', { defaultValue: 'Our Policies' });

  return (
    <div className={className}>
      {headingText && <h4 className="font-semibold mb-3">{headingText}</h4>}
      <ul className="space-y-2 text-sm">
        {policies.map((p) => (
          <li key={p.key}>
            <Link to={p.path} onClick={onNavigate} className={linkClassName}>
              {p.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default PolicyLinks;
