/**
 * Building blocks of the brand-kit form (PBI 10-12): one card per field,
 * each with its own small save indicator. Fields keep what the merchant typed
 * in local state and hand it to the page's autosave (`useProfileAutosave`)
 * when they lose focus, so nothing typed is lost if a save fails.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, CloudOff, ImagePlus, Loader2, Pipette, RotateCw, Trash2 } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useConfirm } from '../../components/ui/use-confirm';
import { cn } from '../../lib/utils';
import { shrinkImage } from '../../lib/shrinkImage';
import { BRAND_COLOR_PATTERN, BRAND_COLOR_PRESETS } from '../../lib/storeProfile';
import { isRetryableError, type FieldSaveStatus } from '../../hooks/useStoreProfile';

/** Large, phone-friendly text input (16px text so Android doesn't zoom). */
export const fieldInputClass =
  'block w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

// ---------------------------------------------------------------------------

export const SaveIndicator: React.FC<{ status?: FieldSaveStatus; onRetry?: () => void }> = ({
  status,
  onRetry,
}) => {
  const { t } = useTranslation('storeDesign');
  if (!status || status.state === 'error') return null;
  if (status.state === 'saving') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" aria-live="polite">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {t('save.saving')}
      </span>
    );
  }
  if (status.state === 'saved') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400" aria-live="polite">
        <Check className="h-3.5 w-3.5" />
        {t('save.saved')}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onRetry}
      className="inline-flex min-h-[32px] items-center gap-1 text-start text-xs font-medium text-amber-700 dark:text-amber-400"
      aria-live="polite"
    >
      <CloudOff className="h-3.5 w-3.5 shrink-0" />
      {t('save.retrying')}
    </button>
  );
};

interface FieldCardProps {
  title: React.ReactNode;
  /** Label target, when the card holds a single input. */
  htmlFor?: string;
  help?: React.ReactNode;
  status?: FieldSaveStatus;
  onRetry?: () => void;
  children: React.ReactNode;
  className?: string;
}

/** One brand-kit fact per card: title, save state, one plain help line. */
export const FieldCard: React.FC<FieldCardProps> = ({ title, htmlFor, help, status, onRetry, children, className }) => (
  <Card className={cn('space-y-3 p-4 shadow-sm', className)}>
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-base font-semibold">
          {title}
        </label>
      ) : (
        <h2 className="text-base font-semibold">{title}</h2>
      )}
      <SaveIndicator status={status} onRetry={onRetry} />
    </div>
    {help && <p className="text-sm text-muted-foreground">{help}</p>}
    {children}
  </Card>
);

export const FieldError: React.FC<{ id?: string; message?: string | null }> = ({ id, message }) =>
  message ? (
    <p id={id} className="text-sm text-destructive" role="alert">
      {message}
    </p>
  ) : null;

// ---------------------------------------------------------------------------

interface ImageFieldProps {
  /** 'photo': any other picture (homepage editor, 10-13). */
  kind: 'logo' | 'cover' | 'photo';
  url: string | null | undefined;
  /** Uploads the (already shrunk) file and resolves with its URL. */
  upload: (file: File) => Promise<string>;
  /** Called after a successful upload. */
  onUploaded: (url: string) => void;
  onRemove: () => void;
  disabled?: boolean;
}

/**
 * Photo picker for the logo / cover: one big button that opens the phone's
 * gallery or camera, a preview, and Change / Remove. A failed upload keeps
 * the chosen photo and retries when the connection comes back.
 */
export const ImageField: React.FC<ImageFieldProps> = ({ kind, url, upload, onUploaded, onRemove, disabled }) => {
  const { t } = useTranslation('storeDesign');
  const confirm = useConfirm();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [failedFile, setFailedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const uploaded = await upload(await shrinkImage(file));
      setFailedFile(null);
      onUploaded(uploaded);
    } catch (err) {
      if (isRetryableError(err)) {
        setFailedFile(file);
        setError(t('image.upload_failed'));
      } else {
        setFailedFile(null);
        setError(typeof err === 'string' ? err : (err as { message?: string })?.message || t('errors.generic'));
      }
    } finally {
      setUploading(false);
    }
  };

  // Retry a failed upload as soon as the phone is back online.
  useEffect(() => {
    if (!failedFile) return;
    const onOnline = () => void send(failedFile);
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
    // `send` is recreated every render; the listener only needs the file.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failedFile]);

  const remove = async () => {
    const ok = await confirm({
      title: t(`image.${kind}.remove_title`),
      confirmText: t('image.remove'),
      cancelText: t('image.keep'),
      variant: 'destructive',
    });
    if (ok) onRemove();
  };

  const pick = () => inputRef.current?.click();

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void send(file);
        }}
      />

      {url ? (
        <div className={cn('overflow-hidden rounded-lg border bg-muted', kind === 'logo' ? 'h-28 w-28' : 'aspect-[16/9] w-full max-w-lg')}>
          <img
            src={url}
            alt={t(`image.${kind}.alt`)}
            className={cn('h-full w-full', kind === 'logo' ? 'object-contain' : 'object-cover')}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={pick}
          disabled={disabled || uploading}
          className={cn(
            'flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/40 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-60',
            kind === 'logo' ? 'min-h-[7rem]' : 'aspect-[16/9] max-w-lg',
          )}
        >
          {uploading ? <Loader2 className="h-7 w-7 animate-spin" /> : <ImagePlus className="h-7 w-7" />}
          <span className="text-base font-medium text-foreground">
            {uploading ? t('image.uploading') : t(`image.${kind}.add`)}
          </span>
        </button>
      )}

      {url && !disabled && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="h-11 flex-1 sm:flex-none" onClick={pick} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <ImagePlus className="h-4 w-4 me-2" />}
            {uploading ? t('image.uploading') : t('image.change')}
          </Button>
          <Button type="button" variant="ghost" className="h-11 text-muted-foreground" onClick={remove} disabled={uploading}>
            <Trash2 className="h-4 w-4 me-2" />
            {t('image.remove')}
          </Button>
        </div>
      )}

      {error && (
        <div className="space-y-2">
          <FieldError message={error} />
          {failedFile && !uploading && (
            <Button type="button" variant="outline" className="h-11" onClick={() => void send(failedFile)}>
              <RotateCw className="h-4 w-4 me-2" />
              {t('image.try_again')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------

/** Wait after the last custom-colour change before saving (the native picker fires continuously while dragging). */
const CUSTOM_COLOR_SAVE_DELAY_MS = 700;

interface ColorFieldProps {
  value: string | null | undefined;
  onSave: (color: string | null) => void;
  disabled?: boolean;
}

/** Preset swatches plus the phone's own colour picker; "Use the look's colour" clears it. */
export const ColorField: React.FC<ColorFieldProps> = ({ value, onSave, disabled }) => {
  const { t } = useTranslation('storeDesign');
  const [current, setCurrent] = useState<string | null>(value || null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => setCurrent(value || null), [value]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const choose = (color: string | null) => {
    clearTimeout(timer.current);
    setCurrent(color);
    if ((color || null) !== (value || null)) onSave(color);
  };

  const isPreset = !!current && (BRAND_COLOR_PRESETS as readonly string[]).includes(current.toLowerCase());
  const customValue = current && BRAND_COLOR_PATTERN.test(current) ? current : '#888888';

  return (
    <div className="space-y-3">
      <div className="grid max-w-sm grid-cols-5 gap-3" role="radiogroup" aria-label={t('brand.color.title')}>
        {BRAND_COLOR_PRESETS.map((color) => {
          const selected = current?.toLowerCase() === color;
          return (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={color}
              disabled={disabled}
              onClick={() => choose(color)}
              className={cn(
                'relative flex aspect-square w-full items-center justify-center rounded-full border-2 transition-transform active:scale-95',
                selected ? 'border-foreground ring-2 ring-offset-2 ring-foreground/30' : 'border-transparent',
              )}
              style={{ backgroundColor: color }}
            >
              {selected && <Check className="h-5 w-5 text-white drop-shadow" strokeWidth={3} />}
            </button>
          );
        })}

        {/* Custom colour: the native picker is the friendliest on Android. */}
        <label
          className={cn(
            'relative flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 transition-transform active:scale-95',
            current && !isPreset ? 'border-foreground ring-2 ring-offset-2 ring-foreground/30' : 'border-dashed border-muted-foreground/40',
          )}
          style={current && !isPreset ? { backgroundColor: current } : undefined}
          title={t('brand.color.custom')}
        >
          <Pipette className={cn('h-5 w-5', current && !isPreset ? 'text-white drop-shadow' : 'text-muted-foreground')} />
          <span className="sr-only">{t('brand.color.custom')}</span>
          <input
            type="color"
            value={customValue}
            disabled={disabled}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            onChange={(e) => {
              const color = e.target.value.toLowerCase();
              setCurrent(color);
              clearTimeout(timer.current);
              timer.current = setTimeout(() => choose(color), CUSTOM_COLOR_SAVE_DELAY_MS);
            }}
          />
        </label>
      </div>

      {current && !disabled && (
        <button
          type="button"
          onClick={() => choose(null)}
          className="inline-flex min-h-[44px] items-center text-sm font-medium text-primary hover:underline"
        >
          {t('brand.color.reset')}
        </button>
      )}
    </div>
  );
};
