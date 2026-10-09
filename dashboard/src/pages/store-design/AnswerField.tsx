import React from 'react';
import { BilingualField } from '../../components/BilingualField';
import type { AnswerDraft } from './answers';

interface AnswerFieldProps {
  label: string;
  value: AnswerDraft;
  onChange: (value: AnswerDraft) => void;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  error?: string | null;
  required?: boolean;
}

/**
 * One short question with an Arabic answer and an optional English one.
 * A thin adapter over the shared Arabic-first BilingualField (PBI 10-14) that
 * keeps the questionnaires' `{ ar: string, en: string }` draft shape.
 */
export const AnswerField: React.FC<AnswerFieldProps> = ({
  label, value, onChange, placeholder, multiline = false, maxLength, error, required,
}) => (
  <BilingualField
    label={label}
    value={value}
    onChange={(next) => onChange({ ar: next.ar ?? '', en: next.en ?? '' })}
    placeholder={placeholder ? { ar: placeholder } : undefined}
    multiline={multiline}
    rows={multiline ? 3 : undefined}
    maxLength={maxLength}
    error={error}
    required={required}
  />
);
