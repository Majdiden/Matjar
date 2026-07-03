import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import {
  ChevronRight, ChevronDown, Plus, Trash2, ArrowUp, ArrowDown,
  Indent, Outdent, Loader2, Save, NavigationIcon, ExternalLink,
} from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { useConfirm } from '../../components/ui/use-confirm';
import { errMsg } from '../../lib/errors';

// ── Types ──────────────────────────────────────────────────────────────────

// Supported menu item types — must mirror the enum in
// schemas/store/menu.js. "page" links to a CMS static page (About,
// Contact, …) via the page's _id stored on `resourceId`; the backend
// menu resolver converts that back to /pages/:slug at render time.
type ItemType = 'link' | 'collection' | 'product' | 'category' | 'page' | 'external';
type Target = '_self' | '_blank';

interface MenuItem {
  _id?: string;
  label: string;
  url: string;
  type: ItemType;
  resourceId: string;
  target: Target;
  icon: string;
  order: number;
  children: MenuItem[];
}

interface FlatItem extends MenuItem {
  /** Depth 0 = top level */
  depth: number;
  /** Flat index within the flat list */
  flatIndex: number;
}

interface ResourceOption {
  _id: string;
  name?: string;
  title?: string;
  handle?: string;
  slug?: string;
}

interface ResourceListResponse {
  collections?: ResourceOption[];
  products?: ResourceOption[];
  categories?: ResourceOption[];
  pages?: ResourceOption[];
}

interface MenuDetailResponse {
  title?: string;
  handle?: string;
  location?: string;
  isActive?: boolean;
  items?: MenuItem[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function makeItem(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    label: '',
    url: '',
    type: 'link',
    resourceId: '',
    target: '_self',
    icon: '',
    order: 0,
    children: [],
    ...overrides,
  };
}

/** Flatten nested items into a list with depth info */
function flatten(items: MenuItem[], depth = 0): FlatItem[] {
  const result: FlatItem[] = [];
  items.forEach((item, idx) => {
    result.push({ ...item, depth, flatIndex: result.length, order: idx });
    if (item.children && item.children.length > 0) {
      flatten(item.children, depth + 1).forEach(child => result.push(child));
    }
  });
  // Re-index flatIndex after the fact
  result.forEach((r, i) => (r.flatIndex = i));
  return result;
}

/** Rebuild nested structure from flat list with depth info */
function unflatten(flat: FlatItem[]): MenuItem[] {
  if (flat.length === 0) return [];

  // We rebuild by maintaining a stack of "current parent lists"
  const root: MenuItem[] = [];
  const stack: { list: MenuItem[]; depth: number }[] = [{ list: root, depth: -1 }];

  for (const item of flat) {
    const node: MenuItem = {
      label: item.label,
      url: item.url,
      type: item.type,
      resourceId: item.resourceId,
      target: item.target,
      icon: item.icon,
      order: item.order,
      children: [],
      ...(item._id ? { _id: item._id } : {}),
    };

    // Pop stack until we find a parent with depth < item.depth
    while (stack.length > 1 && stack[stack.length - 1].depth >= item.depth) {
      stack.pop();
    }

    stack[stack.length - 1].list.push(node);
    stack.push({ list: node.children, depth: item.depth });
  }

  return root;
}

// ── Resource picker sub-component ──────────────────────────────────────────

interface ResourcePickerProps {
  type: ItemType;
  value: string;
  onChange: (id: string) => void;
}

const ResourcePicker: React.FC<ResourcePickerProps> = ({ type, value, onChange }) => {
  const { t } = useTranslation(['menus']);
  const [options, setOptions] = useState<ResourceOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!['collection', 'product', 'category', 'page'].includes(type)) return;
    setLoading(true);
    // Each resource type has its own list endpoint and its own
    // response envelope key. Keep the mapping local to this effect so
    // adding a new resource type is a single place to edit.
    type ResourceEnvelope = { data?: ResourceListResponse };
    const loader: Promise<ResourceEnvelope> =
      type === 'collection' ? api.get<ResourceEnvelope>('/collections')
      : type === 'product'   ? api.get<ResourceEnvelope>('/products')
      : type === 'category'  ? api.get<ResourceEnvelope>('/categories')
                             : (api.pages.list({ limit: 100 }) as Promise<ResourceEnvelope>);
    loader
      .then((res) => {
        const data: ResourceListResponse = res.data || {};
        if (type === 'collection') setOptions(data.collections || []);
        else if (type === 'product') setOptions(data.products || []);
        else if (type === 'category') setOptions(data.categories || []);
        else setOptions(data.pages || []);
      })
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }, [type]);

  if (!['collection', 'product', 'category', 'page'].includes(type)) return null;

  return (
    <Select value={value} onValueChange={onChange} disabled={loading}>
      <SelectTrigger className="h-8 text-sm">
        <SelectValue placeholder={loading ? t('menus:form.resource_picker.loading') : t(`menus:form.resource_picker.placeholder_${type}` as const)} />
      </SelectTrigger>
      <SelectContent>
        {options.map(opt => (
          <SelectItem key={opt._id} value={opt._id}>
            {opt.name || opt.title || opt.handle || opt.slug || opt._id}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

// ── Item row ────────────────────────────────────────────────────────────────

interface ItemRowProps {
  flat: FlatItem[];
  index: number;
  onChange: (index: number, patch: Partial<MenuItem>) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onIndent: (index: number) => void;
  onOutdent: (index: number) => void;
  onDelete: (index: number) => void;
  onAddChild: (index: number) => void;
}

const ItemRow: React.FC<ItemRowProps> = ({
  flat, index, onChange, onMoveUp, onMoveDown, onIndent, onOutdent, onDelete, onAddChild,
}) => {
  const { t } = useTranslation(['menus']);
  const item = flat[index];
  const [expanded, setExpanded] = useState(true);
  const hasChildren = item.children && item.children.length > 0;

  const needsResource = ['collection', 'product', 'category', 'page'].includes(item.type);
  const needsUrl = ['link', 'external'].includes(item.type);

  return (
    <div
      className="border rounded-lg p-3 bg-card"
      style={{ marginInlineStart: `${item.depth * 24}px` }}
    >
      {/* Row 1: link name (roomy, full-width) + type */}
      <div className="flex items-start gap-2">
        {hasChildren ? (
          <Button variant="ghost" size="icon" className="h-9 w-6 shrink-0" onClick={() => setExpanded(e => !e)}>
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />}
          </Button>
        ) : (
          <span className="w-6 shrink-0" />
        )}
        <div className="flex-1 min-w-0 space-y-1">
          <Label className="text-xs text-muted-foreground">{t('menus:form.item.field.label')}</Label>
          <Input
            className="h-9 w-full text-sm"
            placeholder={t('menus:form.item.label_placeholder')}
            value={item.label}
            onChange={e => onChange(index, { label: e.target.value })}
          />
        </div>
        <div className="w-40 shrink-0 space-y-1">
          <Label className="text-xs text-muted-foreground">{t('menus:form.item.field.type')}</Label>
          <Select value={item.type} onValueChange={v => onChange(index, { type: v as ItemType, resourceId: '', url: '' })}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(['link', 'external', 'collection', 'product', 'category', 'page'] as ItemType[]).map(tp => (
                <SelectItem key={tp} value={tp} className="text-sm">{t(`menus:form.item.type.${tp}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 2: link target (URL or resource) + open-in */}
      <div className="flex items-end gap-2 mt-2 ms-8">
        <div className="flex-1 min-w-0 space-y-1">
          {needsUrl ? (
            <>
              <Label className="text-xs text-muted-foreground">
                {item.type === 'external'
                  ? t('menus:form.item.field.url_external')
                  : t('menus:form.item.field.url')}
              </Label>
              <Input
                className="h-9 w-full text-sm"
                placeholder={item.type === 'external' ? 'https://example.com' : '/path-or-url'}
                value={item.url}
                onChange={e => onChange(index, { url: e.target.value })}
              />
            </>
          ) : (
            <>
              <Label className="text-xs text-muted-foreground">{t('menus:form.item.field.resource')}</Label>
              <ResourcePicker type={item.type} value={item.resourceId} onChange={id => onChange(index, { resourceId: id })} />
            </>
          )}
        </div>
        <div className="w-36 shrink-0 space-y-1">
          <Label className="text-xs text-muted-foreground">{t('menus:form.item.field.target')}</Label>
          <Select value={item.target} onValueChange={v => onChange(index, { target: v as Target })}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_self" className="text-xs">{t('menus:form.items.target.same_tab')}</SelectItem>
              <SelectItem value="_blank" className="text-xs">
                <span className="flex items-center gap-1"><ExternalLink className="h-3 w-3" />{t('menus:form.items.target.new_tab')}</span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 3: actions */}
      <div className="flex items-center gap-0.5 mt-2 ms-8">
        <Button variant="ghost" size="icon" className="h-7 w-7" title={t('menus:form.items.action.move_up')} onClick={() => onMoveUp(index)}>
          <ArrowUp className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" title={t('menus:form.items.action.move_down')} onClick={() => onMoveDown(index)}>
          <ArrowDown className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" title={t('menus:form.items.action.indent')} onClick={() => onIndent(index)}>
          <Indent className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" title={t('menus:form.items.action.outdent')} onClick={() => onOutdent(index)}>
          <Outdent className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" title={t('menus:form.items.action.add_child')} onClick={() => onAddChild(index)}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive ms-auto"
          title={t('menus:form.items.action.delete')} onClick={() => onDelete(index)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};

// ── Preview panel ────────────────────────────────────────────────────────────

const PreviewTree: React.FC<{ items: MenuItem[]; depth?: number }> = ({ items, depth = 0 }) => {
  const { t } = useTranslation(['menus']);
  if (!items || items.length === 0) return null;
  return (
    <ul className={depth === 0 ? 'space-y-1' : 'ms-4 mt-1 space-y-0.5 border-s ps-3'}>
      {items.map((item, i) => (
        <li key={i}>
          <div className="flex items-center gap-1 text-sm py-0.5">
            <span className={item.children?.length ? 'font-medium' : ''}>{item.label || <em className="text-muted-foreground">{t('menus:form.preview.untitled')}</em>}</span>
            {item.target === '_blank' && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
            <span className="text-xs text-muted-foreground ms-auto">{item.url || item.resourceId || item.type}</span>
          </div>
          {item.children?.length > 0 && <PreviewTree items={item.children} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );
};

// ── Main form ────────────────────────────────────────────────────────────────

export const MenuForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const isNew = !id || id === 'new';

  const { t } = useTranslation(['menus', 'common']);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [handle, setHandle] = useState('');
  const [handleTouched, setHandleTouched] = useState(false);
  const [location, setLocation] = useState<string>('custom');
  const [isActive, setIsActive] = useState(true);
  const [flatItems, setFlatItems] = useState<FlatItem[]>([]);

  // Derive nested items from flat list for preview / save
  const nestedItems = useCallback(() => unflatten(flatItems), [flatItems]);

  useEffect(() => {
    if (isNew) return;
    api.get<{ data: MenuDetailResponse }>(`/menus/${id}`)
      .then((res) => {
        const m: MenuDetailResponse = res.data || {};
        setTitle(m.title || '');
        setHandle(m.handle || '');
        setHandleTouched(true);
        setLocation(m.location || 'custom');
        setIsActive(m.isActive ?? true);
        setFlatItems(flatten(m.items || []));
      })
      .catch(() => toast.error(t('menus:form.toast.error_load')))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  // Auto-slugify handle from title unless manually edited
  useEffect(() => {
    if (!handleTouched && title) setHandle(slugify(title));
  }, [title, handleTouched]);

  // ── Flat-list mutation helpers ──────────────────────────────────────────

  const updateItem = (index: number, patch: Partial<MenuItem>) => {
    setFlatItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const addTopLevel = () => {
    setFlatItems(prev => [...prev, { ...makeItem(), depth: 0, flatIndex: prev.length }]);
  };

  const addChild = (parentIndex: number) => {
    const parent = flatItems[parentIndex];
    const childDepth = parent.depth + 1;
    // Insert after the last sibling/descendant of this parent
    let insertAt = parentIndex + 1;
    while (insertAt < flatItems.length && flatItems[insertAt].depth >= childDepth) insertAt++;
    setFlatItems(prev => {
      const next = [...prev];
      next.splice(insertAt, 0, { ...makeItem(), depth: childDepth, flatIndex: insertAt });
      return next.map((item, i) => ({ ...item, flatIndex: i }));
    });
  };

  const deleteItem = (index: number) => {
    const itemDepth = flatItems[index].depth;
    // Remove item and all descendants
    let end = index + 1;
    while (end < flatItems.length && flatItems[end].depth > itemDepth) end++;
    setFlatItems(prev => {
      const next = [...prev];
      next.splice(index, end - index);
      return next.map((item, i) => ({ ...item, flatIndex: i }));
    });
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const itemDepth = flatItems[index].depth;
    // Find the previous sibling (same depth)
    let prevSiblingIdx = index - 1;
    while (prevSiblingIdx >= 0 && flatItems[prevSiblingIdx].depth > itemDepth) prevSiblingIdx--;
    if (prevSiblingIdx < 0 || flatItems[prevSiblingIdx].depth !== itemDepth) return;
    // Find end of current item block
    let end = index + 1;
    while (end < flatItems.length && flatItems[end].depth > itemDepth) end++;
    // Find start of previous sibling block
    const prevStart = prevSiblingIdx;
    setFlatItems(prev => {
      const next = [...prev];
      const currentBlock = next.splice(index, end - index);
      next.splice(prevStart, 0, ...currentBlock);
      return next.map((item, i) => ({ ...item, flatIndex: i }));
    });
  };

  const moveDown = (index: number) => {
    const itemDepth = flatItems[index].depth;
    // Find end of current block
    let end = index + 1;
    while (end < flatItems.length && flatItems[end].depth > itemDepth) end++;
    if (end >= flatItems.length || flatItems[end].depth !== itemDepth) return;
    // Find end of next sibling block
    let nextEnd = end + 1;
    while (nextEnd < flatItems.length && flatItems[nextEnd].depth > itemDepth) nextEnd++;
    setFlatItems(prev => {
      const next = [...prev];
      const currentBlock = next.splice(index, end - index);
      const insertAt = index + (nextEnd - end);
      next.splice(insertAt - (end - index), 0, ...currentBlock);
      return next.map((item, i) => ({ ...item, flatIndex: i }));
    });
  };

  const indent = (index: number) => {
    if (index === 0) return;
    const item = flatItems[index];
    // The item above at same depth becomes its parent
    let prevSiblingIdx = index - 1;
    while (prevSiblingIdx >= 0 && flatItems[prevSiblingIdx].depth > item.depth) prevSiblingIdx--;
    if (prevSiblingIdx < 0 || flatItems[prevSiblingIdx].depth !== item.depth) return;
    // Increase depth of item and all its descendants
    let end = index + 1;
    while (end < flatItems.length && flatItems[end].depth > item.depth) end++;
    setFlatItems(prev => {
      const next = [...prev];
      for (let i = index; i < end; i++) {
        next[i] = { ...next[i], depth: next[i].depth + 1 };
      }
      return next.map((it, i) => ({ ...it, flatIndex: i }));
    });
  };

  const outdent = (index: number) => {
    const item = flatItems[index];
    if (item.depth === 0) return;
    let end = index + 1;
    while (end < flatItems.length && flatItems[end].depth > item.depth) end++;
    setFlatItems(prev => {
      const next = [...prev];
      for (let i = index; i < end; i++) {
        next[i] = { ...next[i], depth: Math.max(0, next[i].depth - 1) };
      }
      return next.map((it, i) => ({ ...it, flatIndex: i }));
    });
  };

  // ── Save / delete ──────────────────────────────────────────────────────

  /**
   * Catch the common menu-item mistakes (empty name, a link with no URL,
   * a resource type with nothing selected) before the round-trip, and
   * point at the offending row by name — the backend rejects these too,
   * but a merchant should never see the raw API message.
   */
  const validateItems = (items: FlatItem[]): string | null => {
    for (const item of items) {
      if (!item.label.trim()) {
        return t('menus:form.validate.item_name_required');
      }
      const name = item.label.trim();
      if (['link', 'external'].includes(item.type) && !item.url.trim()) {
        return t('menus:form.validate.item_url_required', { name });
      }
      if (['collection', 'product', 'category', 'page'].includes(item.type) && !item.resourceId) {
        return t('menus:form.validate.item_resource_required', {
          name,
          type: t(`menus:form.item.type.${item.type}`),
        });
      }
    }
    return null;
  };

  const handleSave = async () => {
    if (!title.trim()) { toast.error(t('menus:form.toast.title_required')); return; }
    const itemError = validateItems(flatItems);
    if (itemError) { toast.error(itemError); return; }
    setSaving(true);
    const payload = {
      title: title.trim(),
      handle: handle.trim() || slugify(title),
      location,
      isActive,
      items: nestedItems(),
    };
    try {
      if (isNew) {
        await api.post('/menus', payload);
        toast.success(t('menus:form.toast.created'));
      } else {
        await api.put(`/menus/${id}`, payload);
        toast.success(t('menus:form.toast.saved'));
      }
      navigate('/dashboard/menus');
    } catch (err) {
      toast.error(errMsg(err, t('menus:form.toast.error_save')));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!(await confirm({
      title: t('menus:form.confirm.delete_title'),
      description: t('menus:form.confirm.delete_description', { title }),
      confirmText: t('common:action.delete'),
      variant: 'destructive',
    }))) return;
    try {
      await api.delete(`/menus/${id}`);
      toast.success(t('menus:form.toast.deleted'));
      navigate('/dashboard/menus');
    } catch (err) {
      toast.error(errMsg(err, t('menus:form.toast.error_delete')));
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-6xl">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  const nested = nestedItems();

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isNew ? t('menus:form.title_new') : t('menus:form.title_edit', { title })}
          </h1>
          <p className="text-muted-foreground">{t('menus:form.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          {!isNew && (
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              <Trash2 className="h-4 w-4 me-2" />{t('common:action.delete')}
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving
              ? <><Loader2 className="h-4 w-4 me-2 animate-spin" />{t('common:state.saving_ellipsis')}</>
              : <><Save className="h-4 w-4 me-2" />{t('common:action.save')}</>}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: settings + items editor */}
        <div className="xl:col-span-2 space-y-6">
          {/* Basic settings */}
          <Card>
            <CardHeader><CardTitle>{t('menus:form.section.settings.title')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t('menus:form.field.title.label')}</Label>
                <Input
                  placeholder={t('menus:form.field.title.placeholder')}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('menus:form.field.handle.label')}</Label>
                <Input
                  placeholder={t('menus:form.field.handle.placeholder')}
                  value={handle}
                  onChange={e => { setHandleTouched(true); setHandle(e.target.value); }}
                />
                <p className="text-xs text-muted-foreground">
                  {t('menus:form.field.handle.hint', { handle: handle || 'handle' })}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>{t('menus:form.field.location.label')}</Label>
                <Select value={location} onValueChange={setLocation}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="header">{t('menus:form.field.location.option.header')}</SelectItem>
                    <SelectItem value="footer">{t('menus:form.field.location.option.footer')}</SelectItem>
                    <SelectItem value="mobile">{t('menus:form.field.location.option.mobile')}</SelectItem>
                    <SelectItem value="custom">{t('menus:form.field.location.option.custom')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                <Label>{t('menus:form.field.is_active.label')}</Label>
              </div>
            </CardContent>
          </Card>

          {/* Items tree editor */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t('menus:form.section.items.title')}</CardTitle>
                <Button size="sm" variant="outline" onClick={addTopLevel}>
                  <Plus className="h-4 w-4 me-1" />{t('menus:form.items.add')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {flatItems.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <NavigationIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">{t('menus:form.items.empty')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {flatItems.map((item, i) => (
                    <ItemRow
                      key={i}
                      flat={flatItems}
                      index={i}
                      onChange={updateItem}
                      onMoveUp={moveUp}
                      onMoveDown={moveDown}
                      onIndent={indent}
                      onOutdent={outdent}
                      onDelete={deleteItem}
                      onAddChild={addChild}
                    />
                  ))}
                  <Button variant="outline" size="sm" className="w-full mt-2" onClick={addTopLevel}>
                    <Plus className="h-4 w-4 me-1" />{t('menus:form.items.add_top_level')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: preview */}
        <div>
          <Card className="sticky top-6">
            <CardHeader><CardTitle>{t('menus:form.section.preview.title')}</CardTitle></CardHeader>
            <CardContent>
              {nested.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('menus:form.preview.empty')}</p>
              ) : (
                <PreviewTree items={nested} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default MenuForm;
