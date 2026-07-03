import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';

/**
 * Real 404 for unmatched /dashboard/* paths (audit 3.6). Rendered inside
 * the dashboard shell so the sidebar/topbar stay, with a link home.
 */
export const NotFound: React.FC = () => {
  const { t } = useTranslation('common');
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-6xl font-bold tracking-tight text-muted-foreground tabular-nums">404</p>
      <h1 className="mt-4 text-xl font-semibold">{t('not_found.title')}</h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm">{t('not_found.description')}</p>
      <Button asChild className="mt-6">
        <Link to="/dashboard">{t('not_found.back')}</Link>
      </Button>
    </div>
  );
};

export default NotFound;
