/**
 * The top strip's bottom sheet in the homepage editor: show/hide and its
 * text (Arabic first, English optional). The strip is a theme-level setting
 * shown above the header on every page, so it is saved with a `theme` op
 * (useHomepageEditor) rather than as a homepage section. Typing updates the
 * preview at once; the text saves when the merchant leaves the field.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Switch } from '../../components/ui/switch';
import { BilingualField } from '../../components/BilingualField';
import { useFieldValue } from '../../hooks/useFieldValue';
import { sameBilingual } from '../../lib/bilingual';
import { bilingualThemeValues, isTopStripShown, readBilingual, TOP_STRIP_KEYS, type HomepageOp } from '../../lib/homepageEditor';

/** Same cap as other short theme texts. */
const TOP_STRIP_MAX_LENGTH = 120;

interface TopStripSheetProps {
  open: boolean;
  /** Theme-level values (show flag, text and its Arabic twin). */
  values: Record<string, unknown>;
  onClose: () => void;
  onChange: (op: HomepageOp) => void;
  onPreview: (settings: Record<string, unknown>) => void;
  status?: React.ReactNode;
}

export default function TopStripSheet({ open, values, onClose, onChange, onPreview, status }: TopStripSheetProps) {
  const { t } = useTranslation('storeDesign');
  const saved = readBilingual(values, TOP_STRIP_KEYS.text);
  const [text, setText] = useFieldValue(saved);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()} modal={false}>
      <DialogContent
        className="max-h-[52dvh] gap-3 shadow-[0_-8px_30px_rgba(0,0,0,0.18)] sm:!max-h-[85vh] sm:overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="pe-8 text-start">
          <DialogTitle className="text-lg">{t('homepage.top_strip.name')}</DialogTitle>
          <DialogDescription>{t('homepage.top_strip.help')}</DialogDescription>
        </DialogHeader>

        <label className="flex min-h-[52px] cursor-pointer items-center justify-between gap-3 rounded-lg border px-3">
          <span className="text-base font-medium">{t('homepage.show_part')}</span>
          <Switch
            checked={isTopStripShown(values)}
            onCheckedChange={(visible) => onChange({ kind: 'theme', settings: { [TOP_STRIP_KEYS.show]: visible } })}
            className="scale-125"
          />
        </label>

        <BilingualField
          id="hp-top-strip-text"
          label={t('homepage.top_strip.text_label')}
          help={t('homepage.top_strip.text_help')}
          value={text}
          maxLength={TOP_STRIP_MAX_LENGTH}
          placeholder={{ ar: t('homepage.top_strip.placeholder') }}
          onChange={(v) => {
            setText(v);
            onPreview(bilingualThemeValues(TOP_STRIP_KEYS.text, v));
          }}
          onCommit={(v) => {
            if (sameBilingual(v, saved)) return;
            onChange({ kind: 'theme', settings: bilingualThemeValues(TOP_STRIP_KEYS.text, v) });
          }}
        />

        <div className="sticky -bottom-4 -mx-4 -mb-4 space-y-2 border-t bg-background p-4 pt-3 sm:-bottom-6 sm:-mx-6 sm:-mb-6 sm:px-6 sm:pb-6">
          {status}
          <Button className="h-12 w-full text-base" onClick={onClose}>
            <Check className="h-5 w-5 me-2" />
            {t('homepage.done')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
