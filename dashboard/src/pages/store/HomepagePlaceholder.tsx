/**
 * PLACEHOLDER for /dashboard/store/homepage (registered by PBI 10-12 so the
 * "My store" hub link works). PBI 10-13 (homepage simple editor) replaces
 * this file and its route in App.tsx — delete it then, along with the
 * `homepage_placeholder.*` strings in locales/{en,ar}/storeDesign.json.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Home } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { useAuth } from '../../contexts/auth-context';
import { useSetBreadcrumbs } from '../../contexts/breadcrumb-context';

export default function HomepagePlaceholder() {
  const { t } = useTranslation(['storeDesign', 'nav']);
  const { can } = useAuth();
  useSetBreadcrumbs([
    { label: t('nav:sidebar.storefront.my_store'), href: '/dashboard/store' },
    { label: t('storeDesign:hub.homepage.title') },
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <Link
        to="/dashboard/store"
        className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="h-4 w-4 ltr:rotate-180" />
        {t('nav:sidebar.storefront.my_store')}
      </Link>
      <Card className="flex flex-col items-center gap-3 p-6 text-center shadow-sm">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Home className="h-7 w-7" />
        </span>
        <h1 className="text-xl font-semibold">{t('storeDesign:homepage_placeholder.title')}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">{t('storeDesign:homepage_placeholder.body')}</p>
        {can('themes.write') && (
          <Button asChild variant="outline" className="h-11">
            <Link to="/dashboard/themes/editor">{t('storeDesign:hub.advanced.title')}</Link>
          </Button>
        )}
      </Card>
    </div>
  );
}
