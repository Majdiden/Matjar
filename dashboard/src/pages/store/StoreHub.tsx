/**
 * "متجري" (My store) hub — PBI 10-12, behind `design.simpleMode`.
 * Route: /dashboard/store.
 *
 * The simple, phone-first way into everything a customer sees: one big card
 * per thing to look after, each with a one-line status in plain words. The
 * pages it links to are owned by other tasks: About / Contact / Policies
 * (10-9..10-11) and the homepage editor (10-13). The full theme editor stays
 * reachable as "Advanced options".
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BadgeCheck,
  ChevronLeft,
  ExternalLink,
  Home,
  Info,
  MessageCircle,
  Monitor,
  Palette,
  SlidersHorizontal,
  Store,
  Truck,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { ShareButton } from '../../components/ShareButton';
import { storefrontUrl } from '../../components/LiveStoreBanner';
import { useAuth } from '../../contexts/auth-context';
import { useStorefrontHost } from '../../hooks/useStorefrontHost';
import { useStoreKey, useStoreProfile } from '../../hooks/useStoreProfile';
import { readHomepageSummary } from '../../hooks/useHomepageEditor';
import { firstMissingBrandItem, type StoreProfile } from '../../lib/storeProfile';
import { cn } from '../../lib/utils';

type Tone = 'done' | 'todo' | 'neutral';

interface HubItem {
  key: string;
  href: string;
  icon: React.ElementType;
  /** Visible when the staff member holds one of these permissions. */
  permission?: string[];
  status: (profile: StoreProfile | null) => { text: string; tone: Tone };
}

export default function StoreHub() {
  const { t } = useTranslation(['storeDesign', 'common']);
  const { can } = useAuth();
  const { profile } = useStoreProfile();
  const host = useStorefrontHost();
  // Last known homepage state from the homepage editor (no extra request).
  const homepageSummary = readHomepageSummary(useStoreKey());

  const neutral = (key: string) => () => ({ text: t(key), tone: 'neutral' as Tone });

  const items: HubItem[] = [
    {
      key: 'brand',
      href: '/dashboard/store/brand',
      icon: BadgeCheck,
      permission: ['settings.read', 'settings.write'],
      status: (p) => {
        if (!p) return { text: '…', tone: 'neutral' };
        const missing = firstMissingBrandItem(p);
        return missing
          ? { text: t(`hub.brand.missing.${missing}`), tone: 'todo' }
          : { text: t('hub.done'), tone: 'done' };
      },
    },
    {
      key: 'homepage',
      href: '/dashboard/store/homepage',
      icon: Home,
      permission: ['themes.write'],
      status: () =>
        homepageSummary && homepageSummary.total > 0
          ? { text: t('hub.homepage.shown', { shown: homepageSummary.shown, total: homepageSummary.total }), tone: 'neutral' }
          : { text: t('hub.homepage.status'), tone: 'neutral' },
    },
    { key: 'about', href: '/dashboard/store/about', icon: Info, status: neutral('hub.about.status') },
    {
      key: 'contact',
      href: '/dashboard/store/contact',
      icon: MessageCircle,
      status: (p) =>
        p?.brand.whatsapp
          ? { text: t('hub.contact.ready'), tone: 'done' }
          : { text: t('hub.contact.needs_whatsapp'), tone: 'todo' },
    },
    { key: 'policies', href: '/dashboard/store/policies', icon: Truck, status: neutral('hub.policies.status') },
    {
      key: 'look',
      href: '/dashboard/themes',
      icon: Palette,
      permission: ['themes.read', 'themes.write'],
      status: neutral('hub.look.status'),
    },
  ];
  const visible = items.filter((i) => !i.permission || can(...i.permission));
  const canAdvanced = can('themes.write');

  const storeName = profile?.storeName || '';
  const url = host ? storefrontUrl(host) : '';

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 pb-24 lg:pb-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('hub.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('hub.subtitle')}</p>
      </div>

      {/* The store itself: what customers open, and the way to send it. */}
      <Card className="space-y-4 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted text-xl font-semibold text-muted-foreground">
            {profile?.logo ? (
              <img src={profile.logo} alt="" className="h-full w-full object-contain" />
            ) : (
              storeName.trim() ? <span aria-hidden>{storeName.trim().charAt(0)}</span> : <Store className="h-6 w-6" aria-hidden />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{storeName || t('hub.store_card.unnamed')}</p>
            {host && (
              <p className="truncate text-sm text-muted-foreground">
                <bdi dir="ltr">{host}</bdi>
              </p>
            )}
          </div>
        </div>
        {url && (
          <div className="grid grid-cols-2 gap-2">
            <Button asChild variant="outline" className="h-12">
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 me-2" />
                {t('hub.store_card.view')}
              </a>
            </Button>
            <ShareButton url={url} message={t('common:share.store_message')} className="h-12" />
          </div>
        )}
      </Card>

      <nav aria-label={t('hub.title')} className="space-y-3">
        {visible.map((item) => {
          const { text, tone } = item.status(profile);
          return (
            <HubCard
              key={item.key}
              to={item.href}
              icon={item.icon}
              title={t(`hub.${item.key}.title`)}
              status={text}
              tone={tone}
            />
          );
        })}

        {canAdvanced && (
          <HubCard
            to="/dashboard/themes/editor"
            icon={SlidersHorizontal}
            title={t('hub.advanced.title')}
            status={t('hub.advanced.status')}
            tone="neutral"
            muted
            trailing={<Monitor className="h-4 w-4 text-muted-foreground" aria-hidden />}
          />
        )}
      </nav>
    </div>
  );
}

interface HubCardProps {
  to: string;
  icon: React.ElementType;
  title: string;
  status: string;
  tone: Tone;
  /** Quieter styling for the advanced entry. */
  muted?: boolean;
  trailing?: React.ReactNode;
}

const TONE_CLASS: Record<Tone, string> = {
  done: 'text-green-700 dark:text-green-400',
  todo: 'text-amber-700 dark:text-amber-400',
  neutral: 'text-muted-foreground',
};

function HubCard({ to, icon: Icon, title, status, tone, muted, trailing }: HubCardProps) {
  return (
    <Link
      to={to}
      className={cn(
        'flex min-h-[72px] items-center gap-3 rounded-xl border bg-card p-3 shadow-sm transition-colors hover:bg-accent active:bg-accent',
        muted && 'bg-muted/30 shadow-none',
      )}
    >
      <span
        className={cn(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
          muted ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary',
        )}
      >
        <Icon className="h-6 w-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold">{title}</span>
        <span className={cn('mt-0.5 block text-sm', TONE_CLASS[tone])}>
          {tone === 'done' && <span aria-hidden>✓ </span>}
          {status}
        </span>
      </span>
      {trailing}
      <ChevronLeft className="h-5 w-5 shrink-0 text-muted-foreground ltr:rotate-180" aria-hidden />
    </Link>
  );
}
