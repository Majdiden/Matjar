import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { Save, Trash2, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { useConfirm } from '../../components/ui/use-confirm';

interface PageFormData {
  title: string;
  slug: string;
  content: string;
  metaTitle: string;
  metaDescription: string;
  locale: string;
  isPublished: boolean;
}

const DEFAULT_FORM: PageFormData = {
  title: '',
  slug: '',
  content: '',
  metaTitle: '',
  metaDescription: '',
  locale: 'en',
  isPublished: false,
};

// Keep the dashboard slugifier in lockstep with the backend regex in
// services/page.js (normaliseSlug). Both collapse whitespace and non-
// alphanumerics to single hyphens, lowercase, and strip edges.
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

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<PageFormData>(DEFAULT_FORM);
  const [slugEdited, setSlugEdited] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const res = (await api.pages.get(id!)) as {
          data?: Partial<PageFormData> & { _id?: string };
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
        });
        // On edit, the slug is already set — don't auto-regenerate it
        // from title changes and break live URLs.
        setSlugEdited(true);
      } catch {
        toast.error('Failed to load page');
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
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    try {
      setSaving(true);
      const payload = {
        ...form,
        slug: form.slug || slugify(form.title),
      };
      if (isEdit) {
        await api.pages.update(id!, payload);
        toast.success('Page saved');
      } else {
        const res = (await api.pages.create(payload)) as { data?: { _id?: string } };
        const newId = res?.data?._id;
        toast.success('Page created');
        if (newId) {
          navigate(`/dashboard/pages/${newId}/edit`);
          return;
        }
      }
      navigate('/dashboard/pages');
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message || 'Failed to save page');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!(await confirm({
      title: 'Delete page?',
      description: 'This action cannot be undone.',
      confirmText: 'Delete',
      variant: 'destructive',
    }))) return;
    try {
      setDeleting(true);
      await api.pages.delete(id!);
      toast.success('Page deleted');
      navigate('/dashboard/pages');
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message || 'Failed to delete page');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEdit ? 'Edit Page' : 'New Page'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Static content pages (About, Contact, Privacy…)
          </p>
        </div>
        <div className="flex gap-2">
          {isEdit && (
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : <><Save className="h-4 w-4 mr-2" />Save</>}
          </Button>
        </div>
      </div>

      {/* Basic info */}
      <Card>
        <CardHeader><CardTitle>Basic info</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Title <span className="text-destructive">*</span></Label>
            <Input
              value={form.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g. About Us"
            />
          </div>
          <div className="space-y-1">
            <Label>Slug (URL path)</Label>
            <Input
              value={form.slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="about-us"
            />
            <p className="text-xs text-muted-foreground">
              /pages/{form.slug || 'slug'}
            </p>
          </div>
          <div className="space-y-1">
            <Label>Locale</Label>
            <Input
              value={form.locale}
              onChange={(e) => setField('locale', e.target.value.toLowerCase())}
              placeholder="en"
            />
            <p className="text-xs text-muted-foreground">
              The storefront language this page is written for (e.g. "en", "ar", "fr"). Create one page per locale.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      <Card>
        <CardHeader><CardTitle>Content</CardTitle></CardHeader>
        <CardContent>
          <Textarea
            className="min-h-[320px] font-mono text-sm"
            value={form.content}
            onChange={(e) => setField('content', e.target.value)}
            placeholder="<p>Page content as HTML…</p>"
          />
          <p className="text-xs text-muted-foreground mt-2">
            HTML body rendered by the storefront page template. Max 100KB.
          </p>
        </CardContent>
      </Card>

      {/* Visibility */}
      <Card>
        <CardHeader><CardTitle>Visibility</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Switch
              checked={form.isPublished}
              onCheckedChange={(v) => setField('isPublished', v)}
            />
            <Label>{form.isPublished ? 'Published' : 'Draft (hidden from storefront)'}</Label>
          </div>
        </CardContent>
      </Card>

      {/* SEO */}
      <Card>
        <Collapsible open={seoOpen} onOpenChange={setSeoOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer select-none">
              <div className="flex items-center justify-between">
                <CardTitle>SEO</CardTitle>
                {seoOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label>Meta title</Label>
                <Input
                  value={form.metaTitle}
                  onChange={(e) => setField('metaTitle', e.target.value)}
                  placeholder={form.title}
                />
              </div>
              <div className="space-y-1">
                <Label>Meta description</Label>
                <Textarea
                  className="min-h-20"
                  value={form.metaDescription}
                  onChange={(e) => setField('metaDescription', e.target.value)}
                  placeholder="Brief description for search engines…"
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
