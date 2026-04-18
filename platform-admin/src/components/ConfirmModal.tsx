import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input, Label, Textarea } from './ui/Input';

export interface ConfirmField {
  name: string;
  label: string;
  type?: 'text' | 'textarea' | 'number';
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  minLength?: number;
  help?: string;
}

export interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  fields?: ConfirmField[];
  confirmLabel?: string;
  confirmVariant?: 'default' | 'destructive';
  confirmPhrase?: string; // type-to-confirm phrase, e.g. slug
  onConfirm: (values: Record<string, string>) => Promise<void> | void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  onClose,
  title,
  description,
  fields = [],
  confirmLabel = 'Confirm',
  confirmVariant = 'default',
  confirmPhrase,
  onConfirm,
}) => {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of fields) init[f.name] = f.defaultValue ?? '';
    return init;
  });
  const [phraseInput, setPhraseInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset values whenever the modal reopens.
  React.useEffect(() => {
    if (open) {
      const init: Record<string, string> = {};
      for (const f of fields) init[f.name] = f.defaultValue ?? '';
      setValues(init);
      setPhraseInput('');
      setError(null);
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const canSubmit = (() => {
    for (const f of fields) {
      const v = (values[f.name] || '').trim();
      if (f.required && !v) return false;
      if (f.minLength && v.length < f.minLength) return false;
    }
    if (confirmPhrase && phraseInput.trim() !== confirmPhrase) return false;
    return true;
  })();

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(values);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? () => {} : onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant={confirmVariant}
            onClick={handleConfirm}
            loading={submitting}
            disabled={!canSubmit}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">
            {error}
          </div>
        )}
        {fields.map((f) => (
          <div key={f.name} className="space-y-1.5">
            <Label htmlFor={f.name}>
              {f.label}
              {f.required && <span className="ml-1 text-destructive">*</span>}
            </Label>
            {f.type === 'textarea' ? (
              <Textarea
                id={f.name}
                value={values[f.name] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                placeholder={f.placeholder}
              />
            ) : (
              <Input
                id={f.name}
                type={f.type || 'text'}
                value={values[f.name] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                placeholder={f.placeholder}
              />
            )}
            {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
          </div>
        ))}
        {confirmPhrase && (
          <div className="space-y-1.5">
            <Label htmlFor="__phrase">
              Type <code className="rounded bg-muted px-1 py-0.5 text-xs">{confirmPhrase}</code> to confirm
            </Label>
            <Input
              id="__phrase"
              value={phraseInput}
              onChange={(e) => setPhraseInput(e.target.value)}
              autoComplete="off"
            />
          </div>
        )}
      </div>
    </Modal>
  );
};
