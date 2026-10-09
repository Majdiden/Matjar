import React from 'react';
import { useStore } from '../contexts/StoreContext';
import { useTranslation } from 'react-i18next';
import { usePage, type CmsPage } from '../hooks/usePage';
import { pickBrandText } from '../hooks/useContactInfo';
import { usePageFacts, type PageFactKey } from '../hooks/usePageFacts';
import { useThemeSlot } from '../theme/ThemeSlotsProvider';
import { MUTED, PAGE_SLOT, tint, usePageStyleTokens } from '../theme/pageStyle';
import { PageHero } from '../components/pages/PageHero';
import { FactGrid } from '../components/pages/FactGrid';
import { ProductShowcase } from '../components/pages/ProductShowcase';
import { ContactCta } from '../components/pages/ContactCta';
import { PageCard, PageContainer, Prose, SectionHeading } from '../components/pages/PageLayout';
import { TrustBadges } from '../components/commerce/TrustBadges';

interface AboutProps {
  className?: string;
  accentColor?: string;
  heading?: string;
  story?: string;
  values?: Array<{ title: string; description: string }>;
}

/** Facts shown on a generated About page, in order. */
const ABOUT_FACTS: readonly PageFactKey[] = ['since', 'city', 'delivery', 'returns', 'payment'];

/** The generated About text opens with the photo; the hero shows it instead. */
const stripLeadingFigure = (html: string) => html.replace(/^\s*<figure\b[^>]*>[\s\S]*?<\/figure>\s*/i, '');

/** Vertical rhythm between blocks, roomier for the editorial style. */
const useBlockGap = () => (usePageStyleTokens().style === 'editorial' ? 'py-12 sm:py-16' : 'py-8 sm:py-12');

/**
 * About page. Three cases:
 *  - written from the merchant's answers (PBI 10-9, `page.generated`): hero,
 *    the story, fact cards, products, trust badges and a WhatsApp call;
 *  - written by hand in the dashboard: the same hero and frame around the
 *    merchant's own text, untouched;
 *  - no About page: the theme's default About content in the same frame.
 * A theme can replace all of it through the `page.about` slot.
 */
const About: React.FC<AboutProps> = (props) => {
  const Slot = useThemeSlot<React.ComponentType<AboutProps>>(PAGE_SLOT.about);
  return Slot ? <Slot {...props} /> : <AboutPage {...props} />;
};

const AboutPage: React.FC<AboutProps> = ({ className = '', ...rest }) => {
  const { store } = useStore();
  const { t, i18n } = useTranslation('generated');
  const { page, loading } = usePage('about');
  const lang = i18n.language || 'ar';
  const tagline = pickBrandText(store?.brand?.tagline, lang);
  const cover = page?.generated?.photo || store?.brand?.coverImage || null;
  const hasPage = !!(page && page.content);

  return (
    <div className={`pb-12 sm:pb-16 ${className}`}>
      <PageHero
        eyebrow={store?.name}
        title={(hasPage && page!.title) || rest.heading || t('pages.about.title')}
        subtitle={tagline}
        image={cover}
      />
      {loading ? (
        <AboutSkeleton />
      ) : hasPage ? (
        page!.generated ? <GeneratedAbout page={page!} /> : <HandWrittenAbout html={page!.content} />
      ) : (
        <DefaultAbout {...rest} />
      )}
    </div>
  );
};

const AboutSkeleton: React.FC = () => (
  <PageContainer className="py-10">
    {[100, 92, 96, 60].map((w, i) => (
      <div key={i} className="h-4 mb-3 rounded animate-pulse" style={{ width: `${w}%`, background: tint(8) }} />
    ))}
  </PageContainer>
);

const GeneratedAbout: React.FC<{ page: CmsPage }> = ({ page }) => {
  const { t } = useTranslation('generated');
  const { store } = useStore();
  const tk = usePageStyleTokens();
  const gap = useBlockGap();
  const facts = usePageFacts({ keys: ABOUT_FACTS, since: page.generated?.since, city: page.generated?.city });
  const lead =
    tk.style === 'editorial'
      ? '[&>p:first-child]:text-xl [&>p:first-child]:leading-9'
      : '[&>p:first-child]:text-lg [&>p:first-child]:font-medium';

  return (
    <>
      <PageContainer className={gap}>
        <SectionHeading eyebrow={t('pages.about.story_eyebrow')} title={t('pages.about.story_title')} />
        <Prose html={stripLeadingFigure(page.content)} className={lead} />
      </PageContainer>

      {facts.length > 0 && (
        <PageContainer className={`${gap} !pt-0`}>
          <FactGrid facts={facts} label={t('pages.facts.heading')} />
        </PageContainer>
      )}

      <ProductShowcase className={gap} />

      {store?.trust && (
        <PageContainer className="pb-8 sm:pb-12">
          <div className="flex flex-col items-center text-center gap-3">
            <p className={tk.eyebrowClass} style={{ color: MUTED }}>{t('trust.heading')}</p>
            <TrustBadges className="[&_ul]:justify-center" />
          </div>
        </PageContainer>
      )}

      <ContactCta />
    </>
  );
};

const HandWrittenAbout: React.FC<{ html: string }> = ({ html }) => {
  const gap = useBlockGap();
  return (
    <>
      <PageContainer className={gap}>
        <Prose html={html} />
      </PageContainer>
      <ContactCta />
    </>
  );
};

/** No About page yet: the theme's default About text, framed like the others. */
const DefaultAbout: React.FC<Omit<AboutProps, 'className'>> = ({ accentColor, story, values }) => {
  const { store } = useStore();
  const { t } = useTranslation(['footer']);
  const tk = usePageStyleTokens();
  const gap = useBlockGap();

  const resolvedValues = values || [
    { title: t('footer.about.value.quality_first_title'), description: t('footer.about.value.quality_first_description') },
    { title: t('footer.about.value.customer_focus_title'), description: t('footer.about.value.customer_focus_description') },
    { title: t('footer.about.value.transparency_title'), description: t('footer.about.value.transparency_description') },
  ];
  // Contact strip only with real details — never invented stats.
  const contacts = [
    { key: 'email', label: t('footer.about.contact_email'), value: store?.contact?.email },
    { key: 'phone', label: t('footer.about.contact_phone'), value: store?.contact?.phone },
    { key: 'visit', label: t('footer.about.contact_visit'), value: store?.contact?.address },
  ].filter((c) => c.value);

  return (
    <>
      <PageContainer className={gap}>
        <p className="text-lg leading-relaxed text-center max-w-2xl mx-auto" style={{ color: MUTED }}>
          {story || store?.description || t('footer.about.default_story', { name: store?.name || 'Our store' })}
        </p>
      </PageContainer>

      <PageContainer wide className={`${gap} !pt-0`}>
        <ul className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-5">
          {resolvedValues.map((value, i) => (
            <li key={i} className="text-center">
              <PageCard className="p-6 h-full">
                <span
                  className="inline-flex w-11 h-11 mb-4 items-center justify-center font-bold"
                  style={{ ...tk.iconBox, ...(accentColor ? { color: accentColor } : {}), borderRadius: 'var(--radius-pill, 9999px)', background: tint(12) }}
                >
                  {i + 1}
                </span>
                <h3 className="font-semibold mb-2" style={{ fontFamily: tk.heading.fontFamily }}>{value.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{value.description}</p>
              </PageCard>
            </li>
          ))}
        </ul>
      </PageContainer>

      {contacts.length > 0 && (
        <PageContainer className="pb-10">
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center py-8" style={{ borderTop: `1px solid ${tint(14)}`, borderBottom: `1px solid ${tint(14)}` }}>
            {contacts.map((c) => (
              <div key={c.key}>
                <dt className="text-xs uppercase tracking-wider mb-1" style={{ color: MUTED }}>{c.label}</dt>
                <dd className="text-sm font-medium break-words">{c.value}</dd>
              </div>
            ))}
          </dl>
        </PageContainer>
      )}
    </>
  );
};

export default About;
