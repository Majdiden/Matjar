/**
 * LinkSlugField — read-only preview of an item's public link
 * ("https://nile.matjar.to/products/atr-alord") with the editable slug tucked
 * behind a small "Edit link" control.
 *
 * Merchants should never have to invent a slug: the parent derives it from
 * the name (lib/storeLink.ts `slugifyLink`, mirrored by the server's
 * utils/slugify.js), and only someone who opens "Edit link" types one.
 * Strings come from the caller so each page keeps its own copy.
 */
import * as React from 'react';
import { Pencil, RotateCcw } from 'lucide-react';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { storefrontUrl } from './LiveStoreBanner';
import { slugifyLink } from '../lib/storeLink';

interface LinkSlugFieldProps {
  label: string;
  /** Storefront hostname, '' when unknown (shows the path alone). */
  host: string;
  /** URL path before the slug, e.g. "/products/". */
  pathPrefix: string;
  /** Slug the item has / will get when not editing. */
  autoSlug: string;
  /** Slug input value while editing (raw — normalised for the preview). */
  value: string;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onChange: (value: string) => void;
  /** Shown in place of the slug while there's nothing to derive it from. */
  emptyText: string;
  helpText: string;
  editLabel: string;
  /** Present → a "back to automatic" button while editing. */
  resetLabel?: string;
  editHelp: string;
  placeholder?: string;
  /** Extra note under the input (e.g. "the old link will forward"). */
  note?: string;
  error?: string;
}

export function LinkSlugField({
  label, host, pathPrefix, autoSlug, value, editing, onEditingChange, onChange,
  emptyText, helpText, editLabel, resetLabel, editHelp, placeholder, note, error,
}: LinkSlugFieldProps) {
  const inputId = React.useId();
  const slug = editing ? slugifyLink(value) || autoSlug : autoSlug;
  const base = `${host ? storefrontUrl(host) : ''}${pathPrefix}`;

  return (
    <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={editing ? inputId : undefined}>{label}</Label>
        {editing ? (
          resetLabel && (
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onEditingChange(false)}>
              <RotateCcw className="h-3.5 w-3.5 me-1" /> {resetLabel}
            </Button>
          )
        ) : (
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onEditingChange(true)}>
            <Pencil className="h-3.5 w-3.5 me-1" /> {editLabel}
          </Button>
        )}
      </div>
      {/* URLs read left-to-right even on an Arabic page. */}
      <p className="text-sm break-all text-start">
        <bdi dir="ltr" className="font-mono">
          <span className="text-muted-foreground">{base}</span>
          {slug ? <span className="font-medium">{slug}</span> : <span className="text-muted-foreground italic">…</span>}
        </bdi>
        {!slug && <span className="ms-2 text-xs text-muted-foreground">{emptyText}</span>}
      </p>
      {editing ? (
        <div className="space-y-1">
          <Input
            id={inputId}
            dir="ltr"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">{editHelp}</p>
          {note && <p className="text-xs text-amber-700 dark:text-amber-400">{note}</p>}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{helpText}</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
