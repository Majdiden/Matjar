/**
 * General tab — store name + description, branding (logo, favicon).
 * State lives in settings/index.tsx (shared with the Regional tab —
 * both save through the same bulk PUT).
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Separator } from '../../components/ui/separator';
import { ImageUpload } from '../../components/ui/image-upload';
import { Save, Loader2 } from 'lucide-react';
import { api } from '../../lib/api-client';
import type { GeneralSettingsState } from './shared';

interface GeneralSettingsProps {
  general: GeneralSettingsState;
  setGeneral: React.Dispatch<React.SetStateAction<GeneralSettingsState>>;
  saving: boolean;
  onSave: () => void;
}

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({ general, setGeneral, saving, onSave }) => {
  const { t } = useTranslation(['settings', 'common']);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.section.store_info.title')}</CardTitle>
          <CardDescription>{t('settings.section.store_info.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('settings.field.store.name.label')}</Label>
            <Input
              placeholder={t('settings.field.store.name.placeholder')}
              value={general.storeName}
              onChange={e => setGeneral(g => ({ ...g, storeName: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('settings.field.store.description.label')}</Label>
            <Input
              placeholder={t('settings.field.store.description.placeholder')}
              value={general.storeDescription}
              onChange={e => setGeneral(g => ({ ...g, storeDescription: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.section.branding.title')}</CardTitle>
          <CardDescription>{t('settings.section.branding.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ImageUpload
            value={general.logo}
            onChange={v => setGeneral(g => ({ ...g, logo: v as string }))}
            multiple={false} maxSizeMB={2} label={t('settings.field.branding.logo.label')}
            description={t('settings.field.branding.logo.description')}
            accept="image/jpeg,image/png,image/webp,image/svg+xml"
            uploadFn={(file) => api.upload.logo(file) as Promise<{ data?: { url?: string } }>}
          />
          <Separator />
          <ImageUpload
            value={general.favicon}
            onChange={v => setGeneral(g => ({ ...g, favicon: v as string }))}
            multiple={false} maxSizeMB={1} label={t('settings.field.branding.favicon.label')}
            description={t('settings.field.branding.favicon.description')}
            accept="image/png,image/x-icon"
            uploadFn={(file) => api.upload.favicon(file) as Promise<{ data?: { url?: string } }>}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={saving}>
          {saving
            ? <Loader2 className="me-2 h-4 w-4 animate-spin" />
            : <Save className="me-2 h-4 w-4" />}
          {saving ? t('settings.button.saving') : t('settings.button.save_changes')}
        </Button>
      </div>
    </div>
  );
};
