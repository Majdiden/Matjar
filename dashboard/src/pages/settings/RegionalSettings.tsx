/**
 * Regional tab — currency, timezone, language.
 * State lives in settings/index.tsx (shared with the General tab —
 * both save through the same bulk PUT).
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { CurrencyPicker, TimezonePicker, LanguagePicker } from '../../components/ui/pickers';
import { Save, Loader2 } from 'lucide-react';
import type { GeneralSettingsState } from './shared';

interface RegionalSettingsProps {
  general: GeneralSettingsState;
  setGeneral: React.Dispatch<React.SetStateAction<GeneralSettingsState>>;
  saving: boolean;
  onSave: () => void;
}

export const RegionalSettings: React.FC<RegionalSettingsProps> = ({ general, setGeneral, saving, onSave }) => {
  const { t } = useTranslation(['settings', 'common']);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.section.regional.title')}</CardTitle>
          <CardDescription>{t('settings.section.regional.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>{t('settings.field.regional.currency.label')}</Label>
              <CurrencyPicker
                value={general.currency}
                onChange={v => setGeneral(g => ({ ...g, currency: v }))}
              />
              <p className="text-xs text-muted-foreground">{t('settings.field.regional.currency.help')}</p>
            </div>
            <div className="space-y-2">
              <Label>{t('settings.field.regional.timezone.label')}</Label>
              <TimezonePicker
                value={general.timezone}
                onChange={v => setGeneral(g => ({ ...g, timezone: v }))}
              />
              <p className="text-xs text-muted-foreground">{t('settings.field.regional.timezone.help')}</p>
            </div>
            <div className="space-y-2">
              <Label>{t('settings.field.regional.language.label')}</Label>
              <LanguagePicker
                value={general.language}
                onChange={v => setGeneral(g => ({ ...g, language: v }))}
              />
              <p className="text-xs text-muted-foreground">{t('settings.field.regional.language.help')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
          {saving ? t('settings.button.saving') : t('settings.button.save_changes')}
        </Button>
      </div>
    </div>
  );
};
