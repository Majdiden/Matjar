import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Skeleton } from '../../components/ui/skeleton';
import { Textarea } from '../../components/ui/textarea';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '../../components/ui/collapsible';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { Select } from '../../components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { Save, Trash2, Loader2, ChevronDown, ChevronUp, MoreVertical } from 'lucide-react';
import { RichTextEditor } from '../../components/RichTextEditor';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { useConfirm } from '../../components/ui/use-confirm';

// Storefront locales offered in the Language select (audit 3.9.4).
// Sourced from tenant settings when the store declares a `languages`
// list; falls back to the platform-supported pair.
const FALLBACK_LOCALES = ['en', 'ar'];

interface PageFormData {
  title: string;
  slug: string;
  content: string;
  metaTitle: string;
  metaDescription: string;
  locale: string;
  isPublished: boolean;
  /** datetime-local input value; '' = publish immediately */
  publishAt: string;
}

const DEFAULT_FORM: PageFormData = {
  title: '',
  slug: '',
  content: '',
  metaTitle: '',
  metaDescription: '',
  locale: 'en',
  isPublished: false,
  publishAt: '',
};

/** ISO string from the API → value for <input type="datetime-local"> (local tz). */
function toDatetimeLocal(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

export const PageForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id && id !== 'new');
  const confirm = useConfirm();
  const { t, i18n } = useTranslation(['pages', 'common']);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<PageFormData>(DEFAULT_FORM);
  const [slugEdited, setSlugEdited] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);
  const [supportedLocales, setSupportedLocales] = useState<string[]>(FALLBACK_LOCALES);

  // Supported storefront locales for the Language select (audit 3.9.4).
  useEffect(() => {
    (async () => {
      try {
        const res = (await api.domains.getInfo()) as {
          data?: { settings?: { language?: string; languages?: string[] } };
          responseObject?: { data?: { settings?: { language?: string; languages?: string[] } } };
        };
        const s = res?.data?.settings || res?.responseObject?.data?.settings;
        const declared = Array.isArray(s?.languages) && s.languages.length > 0
          ? s.languages
          : FALLBACK_LOCALES;
        const withDefault = s?.language ? [s.language, ...declared] : declared;
        setSupportedLocales([...new Set(withDefault.map((l) => String(l).toLowerCase()))]);
      } catch {
        // Keep the fallback pair — the select stays usable offline.
      }
    })();
  }, []);

  // Human label for a locale code in the current dashboard language,
  // e.g. "ar" → "Arabic" / "العربية".
  const localeLabel = (code: string): string => {
    try {
      const name = new Intl.DisplayNames([i18n.language], { type: 'language' }).of(code);
      return name && name !== code ? `${name} (${code})` : code;
    } catch {
      return code;
    }
  };

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const res = (await api.pages.get(id!)) as {
          data?: Partial<PageFormData> & { _id?: string; publishAt?: string | null };
        };
        const p = res?.data;
        if (!p) return;
        setForm({
          title: p.title || '',
          slug: p.slug || '',
          content: p.content || '',
          metaTitle: p.metaTitle || '',
          metaDescription: p.metaDescription || '',
          locale: p.locale || 'en',
          isPublished: !!p.isPublished,
          publishAt: toDatetimeLocal(p.publishAt),
        });
        setSlugEdited(true);
      } catch {
        toast.error(t('pages:toast.error_load'));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit]);

  const setField = <K extends keyof PageFormData>(key: K, value: PageFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleTitleChange = (value: string) => {
    setField('title', value);
    if (!slugEdited) setField('slug', slugify(value));
  };

  const handleSlugChange = (value: string) => {
    setSlugEdited(true);
    setField('slug', slugify(value));
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error(t('pages:toast.title_required')); return; }
    try {
      setSaving(true);
      const payload = {
        ...form,
        slug: form.slug || slugify(form.title),
        // '' = no schedule → null clears any previous schedule server-side
        publishAt: form.publishAt ? new Date(form.publishAt).toISOString() : null,
      };
      if (isEdit) {
        await api.pages.update(id!, payload);
        toast.success(t('pages:toast.saved'));
      } else {
        const res = (await api.pages.create(payload)) as { data?: { _id?: string } };
        const newId = res?.data?._id;
        toast.success(t('pages:toast.created'));
        if (newId) {
          navigate(`/dashboard/pages/${newId}/edit`);
          return;
        }
      }
      navigate('/dashboard/pages');
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message || t('pages:toast.error_save'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!(await confirm({
      title: t('pages:confirm.delete_title'),
      description: t('pages:confirm.delete_description_generic'),
      confirmText: t('common:action.delete'),
      variant: 'destructive',
    }))) return;
    try {
      setDeleting(true);
      await api.pages.delete(id!);
      toast.success(t('pages:toast.deleted'));
      navigate('/dashboard/pages');
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message || t('pages:toast.error_delete'));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEdit ? t('pages:form.title_edit') : t('pages:form.title_new')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('pages:form.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving
              ? <><Loader2 className="h-4 w-4 me-2 animate-spin" />{t('common:state.saving_ellipsis')}</>
              : <><Save className="h-4 w-4 me-2" />{t('common:action.save')}</>}
          </Button>
          {isEdit && (
            // Destructive action lives in an overflow menu, away from Save
            // (audit 3.9.12); the confirm dialog still gates deletion.
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label={t('common:aria.more')} disabled={deleting}>
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={handleDelete}
                >
                  <Trash2 className="me-2 h-4 w-4" />{t('common:action.delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Basic info */}
      <Card>
        <CardHeader><CardTitle>{t('pages:form.section.basic_info.title')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>{t('pages:form.field.title.label')} <span className="text-destructive">*</span></Label>
            <Input
              value={form.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder={t('pages:form.field.title.placeholder')}
            />
          </div>
          <div className="space-y-1">
            <Label>{t('pages:form.field.slug.label')}</Label>
            <Input
              value={form.slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder={t('pages:form.field.slug.placeholder')}
            />
            <p className="text-xs text-muted-foreground">
              {t('pages:form.field.slug.hint', { slug: form.slug || 'slug' })}
            </p>
          </div>
          <div className="space-y-1">
            <Label>{t('pages:form.field.locale.label')}</Label>
            {/* Width cap lives on a wrapper: the Select shim anchors its
                chevron to its own full-width relative box. */}
            <div className="max-w-xs">
              <Select
                value={form.locale}
                onValueChange={(v) => setField('locale', v)}
                options={
                  // Always include the page's saved locale so editing a page in
                  // a language the store no longer declares doesn't lose data.
                  [...new Set([...supportedLocales, form.locale].filter(Boolean))]
                    .map((code) => ({ value: code, label: localeLabel(code) }))
                }
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t('pages:form.field.locale.hint')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Content — TipTap visual editor with a raw-HTML escape hatch
          (audit 6.3). Both tabs round-trip through `form.content`. */}
      <Card>
        <CardHeader><CardTitle>{t('pages:form.section.content.title')}</CardTitle></CardHeader>
        <CardContent>
          <Tabs defaultValue="visual">
            <TabsList>
              <TabsTrigger value="visual">{t('pages:form.field.content.tab_visual')}</TabsTrigger>
              <TabsTrigger value="html">{t('pages:form.field.content.tab_html')}</TabsTrigger>
            </TabsList>
            <TabsContent value="visual">
              <RichTextEditor
                value={form.content}
                onChange={(html) => setField('content', html)}
                placeholder={t('pages:form.field.content.placeholder')}
                dir={form.locale === 'ar' ? 'rtl' : 'ltr'}
              />
            </TabsContent>
            <TabsContent value="html">
              <Textarea
                dir="ltr"
                className="min-h-[320px] font-mono text-sm"
                value={form.content}
                onChange={(e) => setField('content', e.target.value)}
                placeholder={t('pages:form.field.content.placeholder_html')}
              />
            </TabsContent>
          </Tabs>
          <p className="text-xs text-muted-foreground mt-2">
            {t('pages:form.field.content.hint')}
          </p>
        </CardContent>
      </Card>

      {/* Visibility */}
      <Card>
        <CardHeader><CardTitle>{t('pages:form.section.visibility.title')}</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Switch
              checked={form.isPublished}
              onCheckedChange={(v) => setField('isPublished', v)}
            />
            <Label>
              {form.isPublished
                ? t('pages:form.field.is_published.label_published')
                : t('pages:form.field.is_published.label_draft')}
            </Label>
          </div>
          {form.isPublished && (
            <div className="space-y-1 mt-4">
              <Label>{t('pages:form.field.publish_at.label')}</Label>
              <Input
                type="datetime-local"
                className="max-w-xs"
                value={form.publishAt}
                onChange={(e) => setField('publishAt', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t('pages:form.field.publish_at.hint')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SEO */}
      <Card>
        <Collapsible open={seoOpen} onOpenChange={setSeoOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer select-none">
              <div className="flex items-center justify-between">
                <CardTitle>{t('pages:form.section.seo.title')}</CardTitle>
                {seoOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label>{t('pages:form.field.meta_title.label')}</Label>
                <Input
                  value={form.metaTitle}
                  onChange={(e) => setField('metaTitle', e.target.value)}
                  placeholder={form.title}
                />
              </div>
              <div className="space-y-1">
                <Label>{t('pages:form.field.meta_description.label')}</Label>
                <Textarea
                  className="min-h-20"
                  value={form.metaDescription}
                  onChange={(e) => setField('metaDescription', e.target.value)}
                  placeholder={t('pages:form.field.meta_description.placeholder')}
                />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
};

export default PageForm;
