/**
 * MediaLibrary (audit 6.6) — full-page browse/manage of uploaded assets.
 * Grid + upload dropzone + search + preset filter + alt editing +
 * copy-URL + delete all live in the shared MediaGrid; this page is the
 * chrome around it. Route: /dashboard/media (Storefront group).
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { MediaGrid } from '../../components/media/MediaGrid';

export const MediaLibrary: React.FC = () => {
  const { t } = useTranslation(['media']);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('media:title')}</h1>
        <p className="text-muted-foreground">{t('media:subtitle')}</p>
      </div>
      <MediaGrid mode="manage" />
    </div>
  );
};

export default MediaLibrary;
