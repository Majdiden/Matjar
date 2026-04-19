import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../../components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import {
  Plus, FolderTree, Edit, Trash2, AlertCircle, Loader2, Save, MoreHorizontal,
  Search, X,
} from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import type { Category, CategoryFormData } from '../../types';
import { useConfirm } from '../../components/ui/use-confirm';

// Shape of the `GET /categories` list response as returned by the backend.
// The server wraps the payload in `responseObject.data`; the optional
// `productCount` field is a server-computed aggregate used in the grid.
type CategoryListItem = Category & { productCount?: number };
interface CategoryListResponse {
  responseObject: { data: CategoryListItem[] };
}
// Shape of errors thrown by the api-client interceptor — either an
// axios-normalized error body or a plain message string.
interface ApiErrorLike { message?: string; error?: string }

export const Categories: React.FC = () => {
  const { t } = useTranslation(['products', 'common']);
  const [categories, setCategories] = useState<CategoryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const confirm = useConfirm();

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((c) => c._id)));
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!(await confirm({
      title: t('products.categories.confirm.delete_bulk.title', { count: selected.size }),
      description: t('products.categories.confirm.delete_bulk.description'),
      confirmText: t('common.action.delete'),
      variant: 'destructive',
    }))) return;
    const ids = [...selected];
    const results = await Promise.allSettled(ids.map((id) => api.categories.delete(id)));
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - ok;
    if (ok) toast.success(t('products.categories.bulk.deleted_count', { count: ok }));
    if (failed) toast.error(t('products.categories.bulk.failed_count', { count: failed }));
    setSelected(new Set());
    loadCategories();
  };

  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
    description: '',
    slug: '',
  });

  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CategoryFormData, string>>>({});

  useEffect(() => { loadCategories(); }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      setError('');
      const response = (await api.categories.getAll()) as CategoryListResponse;
      setCategories(response.responseObject.data || []);
    } catch (err: unknown) {
      const e = err as ApiErrorLike;
      setError(e?.message || t('products.categories.toast.load_failed'));
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return categories;
    const q = search.toLowerCase();
    return categories.filter(
      (c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q)
    );
  }, [categories, search]);

  const openAddDialog = () => {
    setEditingCategory(null);
    setFormData({ name: '', description: '', slug: '' });
    setFormErrors({});
    setDialogOpen(true);
  };

  const openEditDialog = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      slug: category.slug,
    });
    setFormErrors({});
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingCategory(null);
    setFormData({ name: '', description: '', slug: '' });
    setFormErrors({});
  };

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof CategoryFormData, string>> = {};
    if (!formData.name.trim()) errors.name = t('products.categories.form.field.name.error.required');
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setSaving(true);
      setError('');
      if (editingCategory) {
        await api.categories.update(editingCategory._id, formData);
        toast.success(t('products.categories.toast.updated'));
      } else {
        await api.categories.create(formData);
        toast.success(t('products.categories.toast.created'));
      }
      await loadCategories();
      closeDialog();
    } catch (err: unknown) {
      const e = err as ApiErrorLike;
      const msg = e?.message || t(editingCategory ? 'products.categories.toast.update_failed' : 'products.categories.toast.create_failed');
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!(await confirm({
      title: t('products.categories.confirm.delete.title', { name }),
      description: t('products.categories.confirm.delete.description'),
      confirmText: t('common.action.delete'),
      variant: 'destructive',
    }))) return;
    try {
      await api.categories.delete(id);
      toast.success(t('products.categories.toast.deleted'));
      await loadCategories();
    } catch (err: unknown) {
      const e = err as ApiErrorLike;
      toast.error(e?.message || t('products.categories.toast.delete_failed'));
    }
  };

  const handleChange = (field: keyof CategoryFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (field === 'name' && !editingCategory) {
      const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      setFormData((prev) => ({ ...prev, slug }));
    }
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('products.categories.list.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('products.categories.list.subtitle')}
          </p>
        </div>
        <Button onClick={openAddDialog} className="shadow-sm">
          <Plus className="h-4 w-4 me-2" /> {t('products.categories.list.new_category')}
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm p-4 rounded-xl flex items-start gap-2 border border-destructive/20">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('products.categories.list.search_placeholder')}
          className="ps-9 h-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {selected.size > 0 && (
        <div className="flex items-center justify-between p-3 rounded-lg border bg-primary/5">
          <p className="text-sm font-medium">{t('products.categories.list.selected_count', { count: selected.size })}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
              <X className="h-3.5 w-3.5 me-1.5" />{t('common.action.close')}
            </Button>
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <Trash2 className="h-3.5 w-3.5 me-1.5" />{t('common.action.delete')}
            </Button>
          </div>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FolderTree className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">
              {search ? t('products.categories.list.empty.title_search') : t('products.categories.list.empty.title')}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto mb-5">
              {search
                ? t('products.categories.list.empty.description_search')
                : t('products.categories.list.empty.description')}
            </p>
            {!search && (
              <Button onClick={openAddDialog}>
                <Plus className="h-4 w-4 me-2" /> {t('products.categories.list.empty.action')}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <label className="flex items-center gap-3 px-1 text-xs uppercase tracking-wider font-medium text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={selected.size === filtered.length && filtered.length > 0}
              onChange={toggleSelectAll}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span>{t('products.categories.list.select_all')}</span>
          </label>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((category) => (
            <Card
              key={category._id}
              className={`hover:shadow-md transition-shadow overflow-hidden group ${selected.has(category._id) ? 'border-primary/50 ring-1 ring-primary/40' : ''}`}
            >
              {/* Image / icon header */}
              <div className="relative h-32 bg-muted overflow-hidden">
                <div className="absolute top-2 start-2 z-10">
                  <input
                    type="checkbox"
                    checked={selected.has(category._id)}
                    onChange={() => toggleSelect(category._id)}
                    className="h-4 w-4 rounded border-gray-300 shadow-sm"
                  />
                </div>
                {category.image ? (
                  <img
                    src={category.image}
                    alt={category.name}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <FolderTree className="h-10 w-10 text-muted-foreground" />
                  </div>
                )}
                {/* Action menu */}
                <div className="absolute top-2 end-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8 shadow-sm"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(category)}>
                        <Edit className="me-2 h-4 w-4" /> {t('common.action.edit')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(category._id, category.name)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="me-2 h-4 w-4" /> {t('common.action.delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {/* Product count badge */}
                {typeof category.productCount === 'number' && (
                  <div className="absolute bottom-2 start-2">
                    <Badge variant="secondary" className="shadow-sm">
                      {t(`products.categories.list.product_count_${category.productCount === 1 ? 'one' : 'other'}`, { count: category.productCount })}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Body */}
              <CardContent className="p-4">
                <h3 className="font-semibold text-base truncate">{category.name}</h3>
                <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                  /{category.slug}
                </p>
                {category.description ? (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2 min-h-[2rem]">
                    {category.description}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground/60 italic mt-2 min-h-[2rem]">
                    {t('products.categories.list.no_description')}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
          </div>
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? t('products.categories.form.title.edit') : t('products.categories.form.title.create')}</DialogTitle>
            <DialogDescription>
              {editingCategory
                ? t('products.categories.form.subtitle.edit')
                : t('products.categories.form.subtitle.create')}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="py-4 space-y-4">
              <Input
                label={t('products.categories.form.field.name.label')}
                placeholder={t('products.categories.form.field.name.placeholder')}
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                error={formErrors.name}
                required
              />
              <div>
                <Input
                  label={t('products.categories.form.field.slug.label')}
                  placeholder={t('products.categories.form.field.slug.placeholder')}
                  value={formData.slug}
                  onChange={(e) => handleChange('slug', e.target.value)}
                  disabled={!!editingCategory}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {editingCategory ? t('products.categories.form.field.slug.help_edit') : t('products.categories.form.field.slug.help_create')}
                </p>
              </div>
              <Textarea
                label={t('products.categories.form.field.description.label')}
                placeholder={t('products.categories.form.field.description.placeholder')}
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog} disabled={saving}>
                {t('common.action.cancel')}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <><Loader2 className="h-4 w-4 me-2 animate-spin" /> {t('common.state.saving_ellipsis')}</>
                ) : (
                  <><Save className="h-4 w-4 me-2" /> {editingCategory ? t('common.action.update') : t('common.action.create')}</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
