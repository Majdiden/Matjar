import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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

const errMsg = (err: unknown, fallback: string): string => {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  if (typeof err === 'string') return err;
  return fallback;
};

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
        <SelectValue placeholder={loading ? 'Loading…' : `Select ${type}`} />
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
  const item = flat[index];
  const [expanded, setExpanded] = useState(true);
  const hasChildren = item.children && item.children.length > 0;

  const needsResource = ['collection', 'product', 'category', 'page'].includes(item.type);
  const needsUrl = ['link', 'external'].includes(item.type);

  return (
    <div
      className="border rounded-lg p-3 bg-card"
      style={{ marginLeft: `${item.depth * 24}px` }}
    >
      <div className="flex items-center gap-2 mb-2">
        {hasChildren && (
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setExpanded(e => !e)}>
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </Button>
        )}
        {!hasChildren && <span className="w-5" />}
        <Input
          className="h-7 text-sm flex-1"
          placeholder="Label"
          value={item.label}
          onChange={e => onChange(index, { label: e.target.value })}
        />
        <Select value={item.type} onValueChange={v => onChange(index, { type: v as ItemType, resourceId: '', url: '' })}>
          <SelectTrigger className="h-7 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(['link', 'external', 'collection', 'product', 'category', 'page'] as ItemType[]).map(t => (
              <SelectItem key={t} value={t} className="text-xs capitalize">{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={item.target} onValueChange={v => onChange(index, { target: v as Target })}>
          <SelectTrigger className="h-7 w-24 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_self" className="text-xs">Same tab</SelectItem>
            <SelectItem value="_blank" className="text-xs">
              <span className="flex items-center gap-1"><ExternalLink className="h-3 w-3" />New tab</span>
            </SelectItem>
          </SelectContent>
        </Select>
        {/* Actions */}
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Move up" onClick={() => onMoveUp(index)}>
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Move down" onClick={() => onMoveDown(index)}>
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Indent (make child)" onClick={() => onIndent(index)}>
            <Indent className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Outdent (promote)" onClick={() => onOutdent(index)}>
            <Outdent className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Add child" onClick={() => onAddChild(index)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
            title="Delete" onClick={() => onDelete(index)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* URL / Resource fields */}
      {needsUrl && (
        <div className="ml-7 mt-1">
          <Input
            className="h-7 text-xs"
            placeholder={item.type === 'external' ? 'https://example.com' : '/path-or-url'}
            value={item.url}
            onChange={e => onChange(index, { url: e.target.value })}
          />
        </div>
      )}
      {needsResource && (
        <div className="ml-7 mt-1">
          <ResourcePicker type={item.type} value={item.resourceId} onChange={id => onChange(index, { resourceId: id })} />
        </div>
      )}
    </div>
  );
};

// ── Preview panel ────────────────────────────────────────────────────────────

const PreviewTree: React.FC<{ items: MenuItem[]; depth?: number }> = ({ items, depth = 0 }) => {
  if (!items || items.length === 0) return null;
  return (
    <ul className={depth === 0 ? 'space-y-1' : 'ml-4 mt-1 space-y-0.5 border-l pl-3'}>
      {items.map((item, i) => (
        <li key={i}>
          <div className="flex items-center gap-1 text-sm py-0.5">
            <span className={item.children?.length ? 'font-medium' : ''}>{item.label || <em className="text-muted-foreground">untitled</em>}</span>
            {item.target === '_blank' && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
            <span className="text-xs text-muted-foreground ml-auto">{item.url || item.resourceId || item.type}</span>
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
      .catch(() => toast.error('Failed to load menu'))
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

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Title is required'); return; }
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
        toast.success('Menu created');
      } else {
        await api.put(`/menus/${id}`, payload);
        toast.success('Menu saved');
      }
      navigate('/dashboard/menus');
    } catch (err) {
      toast.error(errMsg(err, 'Failed to save menu'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!(await confirm({
      title: 'Delete menu?',
      description: `"${title}" will be permanently removed.`,
      confirmText: 'Delete',
      variant: 'destructive',
    }))) return;
    try {
      await api.delete(`/menus/${id}`);
      toast.success('Menu deleted');
      navigate('/dashboard/menus');
    } catch (err) {
      toast.error(errMsg(err, 'Failed to delete'));
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
            {isNew ? 'New Menu' : `Edit: ${title}`}
          </h1>
          <p className="text-muted-foreground">Configure navigation items and structure</p>
        </div>
        <div className="flex gap-2">
          {!isNew && (
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              <Trash2 className="h-4 w-4 mr-2" />Delete
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</>
              : <><Save className="h-4 w-4 mr-2" />Save</>}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: settings + items editor */}
        <div className="xl:col-span-2 space-y-6">
          {/* Basic settings */}
          <Card>
            <CardHeader><CardTitle>Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input
                  placeholder="e.g. Main Menu"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Handle</Label>
                <Input
                  placeholder="main-menu"
                  value={handle}
                  onChange={e => { setHandleTouched(true); setHandle(e.target.value); }}
                />
                <p className="text-xs text-muted-foreground">
                  Used in API: <code className="bg-muted px-1 rounded">/storefront/menus/{handle || 'handle'}</code>
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Select value={location} onValueChange={setLocation}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="header">Header</SelectItem>
                    <SelectItem value="footer">Footer</SelectItem>
                    <SelectItem value="mobile">Mobile</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                <Label>Active</Label>
              </div>
            </CardContent>
          </Card>

          {/* Items tree editor */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Menu Items</CardTitle>
                <Button size="sm" variant="outline" onClick={addTopLevel}>
                  <Plus className="h-4 w-4 mr-1" />Add item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {flatItems.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <NavigationIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No items yet. Click "Add item" to start building your menu.</p>
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
                    <Plus className="h-4 w-4 mr-1" />Add top-level item
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: preview */}
        <div>
          <Card className="sticky top-6">
            <CardHeader><CardTitle>Preview</CardTitle></CardHeader>
            <CardContent>
              {nested.length === 0 ? (
                <p className="text-sm text-muted-foreground">Add items to see a preview.</p>
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
