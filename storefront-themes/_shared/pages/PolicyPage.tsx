import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '../contexts/StoreContext';
import { POLICY_KEYS, policyLabel, publishedPolicy, type PolicyKey } from '../lib/policies';
import { usePageFacts, type PageFactKey } from '../hooks/usePageFacts';
import { useThemeSlot } from '../theme/ThemeSlotsProvider';
import { FG, MUTED, PAGE_SLOT, usePageStyleTokens } from '../theme/pageStyle';
import { PageHero } from '../components/pages/PageHero';
import { FactGrid } from '../components/pages/FactGrid';
import { ContactCta } from '../components/pages/ContactCta';
import { PageContainer, Prose } from '../components/pages/PageLayout';
import type { PageIconName } from '../components/pages/PageIcon';

const POLICY_ICONS: Record<PolicyKey, PageIconName> = {
  privacy: 'lock',
  returns: 'returns',
  delivery: 'truck',
  cod: 'cash',
};

/**
 * Summary facts above a policy written from the merchant's answers (PBI
 * 10-11; mirrors GENERATED_POLICY_KEYS in services/generatedPages.js).
 * Privacy is never generated, so it has none.
 */
const POLICY_FACTS: Partial<Record<PolicyKey, readonly PageFactKey[]>> = {
  delivery: ['delivery', 'deliveryTime', 'payment'],
  returns: ['returns', 'delivery'],
  cod: ['payment', 'delivery', 'deliveryTime'],
};

/**
 * A single merchant-authored store policy (privacy / returns / delivery /
 * cod) at `/policies/:key`: a header band with the policy's icon, the facts
 * from the merchant's policy answers at a glance (`store.trust`), the body
 * in a readable card, then "Questions? Message us on WhatsApp". The body is
 * server-sanitised HTML, so it's safe to inject. Unknown keys redirect home;
 * a known-but-unpublished policy shows a short empty state.
 * A theme can replace it through the `page.policy` slot.
 */
const PolicyPage: React.FC<{ className?: string }> = (props) => {
  const Slot = useThemeSlot<React.ComponentType<{ className?: string }>>(PAGE_SLOT.policy);
  return Slot ? <Slot {...props} /> : <StorePolicyPage {...props} />;
};

const NO_FACTS: readonly PageFactKey[] = [];

const StorePolicyPage: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { key } = useParams<{ key: string }>();
  const { store } = useStore();
  const { t } = useTranslation(['common', 'generated']);
  const tk = usePageStyleTokens();
  const known = !!key && POLICY_KEYS.includes(key as PolicyKey);
  const policyKey = key as PolicyKey;
  const factKeys = (known && store?.trust && POLICY_FACTS[policyKey]) || NO_FACTS;
  const facts = usePageFacts({ keys: factKeys });

  if (!known) return <Navigate to="/" replace />;

  // The shopper's language for generated policies (lib/policies.ts).
  const policy = publishedPolicy(store, policyKey, t);
  const title = policy?.title || policyLabel(policyKey, t);
  const editorial = tk.style === 'editorial';

  return (
    <div className={`pb-12 sm:pb-16 ${className}`}>
      <PageHero compact eyebrow={store?.name} title={title} icon={POLICY_ICONS[policyKey]} />

      <PageContainer className={editorial ? 'py-10 sm:py-14' : 'py-8 sm:py-10'}>
        {facts.length > 0 && (
          <div className="mb-8">
            <p className={`${tk.eyebrowClass} mb-3`} style={{ color: MUTED }}>
              {t('generated:pages.policy.summary')}
            </p>
            <FactGrid facts={facts} label={t('generated:pages.policy.summary')} />
          </div>
        )}

        {policy?.body ? (
          // Privacy is plain prose; the shopping policies sit in a card under their facts.
          <article
            className={policyKey === 'privacy' ? '' : editorial ? 'pt-8' : 'p-5 sm:p-8'}
            style={policyKey === 'privacy' ? undefined : editorial ? { borderTop: tk.card.borderTop } : tk.card}
          >
            <Prose html={policy.body} />
          </article>
        ) : (
          <p className="text-center py-10" style={{ color: FG, opacity: 0.7 }}>
            {t('common:storefront.policies.empty', { defaultValue: "This policy hasn't been published yet." })}
          </p>
        )}
      </PageContainer>

      <ContactCta title={t('generated:pages.policy.questions_title')} text={t('generated:pages.policy.questions_text')} />
    </div>
  );
};

export default PolicyPage;
