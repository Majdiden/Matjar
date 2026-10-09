import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Skeleton } from '../../components/ui/skeleton';
import { STORE_HUB_PATH } from './answers';

interface StoreScreenProps {
  title: string;
  intro?: string;
  loading?: boolean;
  children: React.ReactNode;
}

/**
 * Phone-first frame for the simple store-design screens: a back link to
 * "My store", a title, one plain sentence of explanation, then the content
 * in a single narrow column.
 */
export const StoreScreen: React.FC<StoreScreenProps> = ({ title, intro, loading = false, children }) => {
  const { t, i18n } = useTranslation(['storePages']);
  const Back = i18n.dir() === 'rtl' ? ChevronRight : ChevronLeft;
  return (
    <div className="mx-auto w-full max-w-xl space-y-6 pb-16">
      <div className="space-y-2">
        <Link
          to={STORE_HUB_PATH}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <Back className="h-4 w-4" />
          {t('storePages:common.back')}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {intro && <p className="text-muted-foreground">{intro}</p>}
      </div>
      {loading ? (
        <div className="space-y-4" aria-hidden="true">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        children
      )}
    </div>
  );
};

export default StoreScreen;
