import React, { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import { Button } from '../../components/ui/button';
import type { AnswerDraft } from './answers';

interface AnswerFieldProps {
  label: string;
  value: AnswerDraft;
  onChange: (value: AnswerDraft) => void;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  error?: string | null;
}

/**
 * One short question with an Arabic answer and an optional English one
 * (PBI 10 copy rule: Arabic first, English always optional). The English
 * input stays hidden behind "+ English (optional)" until asked for, or
 * when an English answer already exists.
 */
export const AnswerField: React.FC<AnswerFieldProps> = ({
  label, value, onChange, placeholder, multiline = false, maxLength, error,
}) => {
  const { t } = useTranslation(['storePages']);
  const id = useId();
  const [showEnglish, setShowEnglish] = useState(Boolean(value.en));
  const englishOpen = showEnglish || Boolean(value.en);

  const Field = multiline ? Textarea : Input;
  const fieldProps = multiline ? { rows: 3 } : {};

  return (
    <div className="space-y-2">
      <Label htmlFor={`${id}-ar`} className="text-base font-medium">{label}</Label>
      <Field
        id={`${id}-ar`}
        dir="rtl"
        lang="ar"
        value={value.ar}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...value, ar: e.target.value })}
        className={error ? 'border-destructive' : undefined}
        {...fieldProps}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      {englishOpen ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={`${id}-en`} className="text-sm text-muted-foreground">{t('storePages:common.english_label')}</Label>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-muted-foreground"
              onClick={() => { setShowEnglish(false); onChange({ ...value, en: '' }); }}
            >
              {t('storePages:common.remove_english')}
            </Button>
          </div>
          <Field
            id={`${id}-en`}
            dir="ltr"
            lang="en"
            value={value.en}
            maxLength={maxLength}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...value, en: e.target.value })}
            {...fieldProps}
          />
        </div>
      ) : (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0"
          onClick={() => setShowEnglish(true)}
        >
          {t('storePages:common.add_english')}
        </Button>
      )}
    </div>
  );
};

export default AnswerField;
