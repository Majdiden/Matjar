/**
 * CategoryPicker — searchable single-select for the product form that also
 * lets the merchant create a new category inline: typing a name that doesn't
 * match an existing category offers a "Create …" row, which POSTs /categories,
 * appends the result to the list, and selects it.
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, Loader2, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { Input } from '../../components/ui/input';
import { cn } from '../../lib/utils';
import { api } from '../../lib/api-client';
import type { Category } from '../../types';

// POST /categories — response shape; server wraps in responseObject.data.
interface CategoryCreateResponse {
  responseObject?: { data?: Category };
}

interface ApiErrorLike {
  message?: string;
}

/** Same slug rule as the Categories page; non-Latin names fall back to a generated slug. */
function buildSlug(name: string, taken: Set<string>): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    || `category-${Date.now().toString(36)}`;
  let slug = base;
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;
  return slug;
}

interface CategoryPickerProps {
  value: string;
  onChange: (id: string) => void;
  categories: Category[];
  onCategoryCreated: (category: Category) => void;
  invalid?: boolean;
}

export function CategoryPicker({ value, onChange, categories, onCategoryCreated, invalid }: CategoryPickerProps) {
  const { t } = useTranslation(['products', 'common']);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [creating, setCreating] = React.useState(false);

  const selected = categories.find(c => c._id === value);
  const trimmed = query.trim();

  const filtered = React.useMemo(() => {
    const q = trimmed.toLowerCase();
    if (!q) return categories;
    return categories.filter(c => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q));
  }, [categories, trimmed]);

  const exactMatch = categories.some(c => c.name.trim().toLowerCase() === trimmed.toLowerCase());
  const canCreate = trimmed.length > 0 && !exactMatch;

  React.useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const select = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  const handleCreate = async () => {
    if (!canCreate || creating) return;
    try {
      setCreating(true);
      const slug = buildSlug(trimmed, new Set(categories.map(c => c.slug)));
      const res = (await api.categories.create({ name: trimmed, slug })) as CategoryCreateResponse;
      const created = res.responseObject?.data;
      if (!created?._id) throw new Error(t('products.categories.toast.create_failed'));
      onCategoryCreated(created);
      toast.success(t('products.categories.toast.created'));
      select(created._id);
    } catch (err: unknown) {
      toast.error((err as ApiErrorLike)?.message || t('products.categories.toast.create_failed'));
    } finally {
      setCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    // Never let Enter submit the surrounding product form.
    e.preventDefault();
    if (filtered.length === 1 && !canCreate) select(filtered[0]._id);
    else if (canCreate && filtered.length === 0) handleCreate();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-invalid={invalid || undefined}
          className={cn(
            'flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors',
            'focus:outline-none focus:ring-1 focus:ring-ring hover:bg-muted/50',
            invalid && 'border-destructive',
          )}
        >
          <span className={cn('truncate text-start', !selected && 'text-muted-foreground')}>
            {selected ? selected.name : t('products.form.field.category.placeholder')}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('products.form.field.category.search_placeholder')}
            className="border-0 shadow-none focus-visible:ring-0 h-9 px-2"
          />
        </div>
        <div className="max-h-64 overflow-y-auto py-1">
          {filtered.length === 0 && !canCreate && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {t('products.form.field.category.empty')}
            </div>
          )}
          {filtered.map(cat => {
            const isActive = cat._id === value;
            return (
              <button
                key={cat._id}
                type="button"
                onClick={() => select(cat._id)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 px-3 py-2 text-sm text-start hover:bg-muted',
                  isActive && 'bg-muted/60',
                )}
              >
                <span className="truncate">{cat.name}</span>
                {isActive && <Check className="h-4 w-4 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="flex w-full items-center gap-2 border-t px-3 py-2 text-sm text-start text-primary hover:bg-muted disabled:opacity-50"
          >
            {creating
              ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              : <Plus className="h-4 w-4 shrink-0" />}
            <span className="truncate">{t('products.form.field.category.create', { name: trimmed })}</span>
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
