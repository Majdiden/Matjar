import React from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useFeatures } from '../contexts/features-context';
import type { FeatureKey } from '../lib/features';
import { Card, CardContent } from './ui/card';
import { Sparkles } from 'lucide-react';

interface RequireFeatureProps {
  feature: FeatureKey;
  children: React.ReactNode;
  // If true, render a "not available" card instead of redirecting (used
  // inside a layout so the surrounding chrome stays visible). Defaults to true.
  inline?: boolean;
}

export const RequireFeature: React.FC<RequireFeatureProps> = ({
  feature,
  children,
  inline = true,
}) => {
  const { hasFeature, isLoading } = useFeatures();
  const { t } = useTranslation(['errors']);

  // Wait until the first /features fetch resolves (no cache yet). Otherwise a
  // brief default-restrictive window would flash the "not available" state
  // before the real flags land.
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!hasFeature(feature)) {
    if (!inline) return <Navigate to="/dashboard" replace />;
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Sparkles className="h-10 w-10 text-muted-foreground mb-3" />
            <h2 className="text-lg font-semibold">{t('errors:feature.unavailable_title')}</h2>
            <p className="text-sm text-muted-foreground max-w-md mt-1">
              {t('errors:feature.unavailable_body')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};

export default RequireFeature;
