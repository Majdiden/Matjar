import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import {
  Layers, Plus, MoreHorizontal, Edit, Trash2, Search, X, Eye, EyeOff,
} from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { useConfirm } from '../../components/ui/use-confirm';

interface Collection {
  _id: string;
  title: string;
  handle: string;
  type: 'manual' | 'smart';
  productIds: string[];
  isPublished: boolean;
  updatedAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// The `/collections` list endpoint wraps its payload in either `data`
// or `responseObject.data` depending on tenant/version, so we narrow
// both shapes. `CollectionsListPayload` is the inner object.
interface CollectionsListPayload {
  collections?: Collection[];
  pagination?: Pagination;
}
interface CollectionsListResponse {
  data?: CollectionsListPayload;
  responseObject?: { data?: CollectionsListPayload };
}

interface ApiErrorLike { message?: string; error?: string }

export const Collections: React.FC = () => {
  const navigate = useNavigate();
  const confirm = useConfirm();

  const [collections, setCollections] = useState<Collection[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'manual' | 'smart'>('all');
  const [publishedFilter, setPublishedFilter] = useState<'all' | 'published' | 'unpublished'>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selected.size === collections.length) setSelected(new Set());
    else setSelected(new Set(collections.map((c) => c._id)));
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!(await confirm({
      title: `Delete ${selected.size} collection${selected.size === 1 ? '' : 's'}?`,
      description: 'This cannot be undone.',
      confirmText: 'Delete',
      variant: 'destructive',
    }))) return;
    const ids = [...selected];
    const results = await Promise.allSettled(ids.map((id) => api.delete(`/collections/${id}`)));
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - ok;
    if (ok) toast.success(`${ok} deleted`);
    if (failed) toast.error(`${failed} failed`);
    setSelected(new Set());
    loadCollections();
  };

  const handleBulkPublish = async (isPublished: boolean) => {
    if (selected.size === 0) return;
    const ids = [...selected];
    const results = await Promise.allSettled(ids.map((id) => api.patch(`/collections/${id}`, { isPublished })));
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - ok;
    if (ok) toast.success(`${ok} ${isPublished ? 'published' : 'unpublished'}`);
    if (failed) toast.error(`${failed} failed`);
    setSelected(new Set());
    loadCollections();
  };

  useEffect(() => {
    loadCollections();
    // loadCollections is defined inside the component and closes over
    // exactly these four pieces of state — adding it to the deps would
    // cause an infinite re-fetch loop since it's reassigned each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, typeFilter, publishedFilter]);

  const loadCollections = async () => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = { page, limit: 20 };
      if (search) params.search = search;
      if (publishedFilter === 'published') params.published = 'true';
      if (publishedFilter === 'unpublished') params.published = 'false';

      const res = (await api.get('/collections', { params })) as CollectionsListResponse;
      const data: CollectionsListPayload = res?.data || res?.responseObject?.data || {};
      const cols: Collection[] = data.collections || [];
      const pag: Pagination = data.pagination || { page: 1, limit: 20, total: 0, pages: 1 };

      // Client-side type filter since backend doesn't expose it as a query param
      const filtered = typeFilter === 'all' ? cols : cols.filter((c) => c.type === typeFilter);
      setCollections(filtered);
      setPagination(pag);
    } catch {
      setCollections([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (collection: Collection) => {
    if (!(await confirm({
      title: 'Delete collection?',
      description: `"${collection.title}" will be permanently removed.`,
      confirmText: 'Delete',
      variant: 'destructive',
    }))) return;
    try {
      await api.delete(`/collections/${collection._id}`);
      toast.success('Collection deleted');
      loadCollections();
    } catch (err: unknown) {
      const e = err as ApiErrorLike;
      toast.error(e?.message || 'Failed to delete collection');
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadCollections();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Collections</h1>
          <p className="text-muted-foreground">Curated groups of products — manual or rule-based</p>
        </div>
        <Button onClick={() => navigate('/dashboard/collections/new')}>
          <Plus className="h-4 w-4 mr-2" />
          New Collection
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search collections..."
              className="pl-8 w-60"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">Search</Button>
        </form>

        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v as 'all' | 'manual' | 'smart'); setPage(1); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="smart">Smart</SelectItem>
          </SelectContent>
        </Select>

        <Select value={publishedFilter} onValueChange={(v) => { setPublishedFilter(v as 'all' | 'published' | 'unpublished'); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Published" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="unpublished">Unpublished</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center justify-between p-3 rounded-lg border bg-primary/5">
          <p className="text-sm font-medium">{selected.size} selected</p>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
              <X className="h-3.5 w-3.5 mr-1.5" />Clear
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkPublish(true)}>
              <Eye className="h-3.5 w-3.5 mr-1.5" />Publish
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkPublish(false)}>
              <EyeOff className="h-3.5 w-3.5 mr-1.5" />Unpublish
            </Button>
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />Delete
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      {collections.length === 0 ? (
        <Card>
          <CardContent className="p-12">
            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Layers className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No collections yet</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                Collections let you organize products into groups for your storefront
              </p>
              <Button onClick={() => navigate('/dashboard/collections/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Create Collection
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <input
                      type="checkbox"
                      checked={selected.size === collections.length && collections.length > 0}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Handle</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {collections.map((col) => (
                  <TableRow
                    key={col._id}
                    className={`cursor-pointer hover:bg-muted/50 ${selected.has(col._id) ? 'bg-primary/5' : ''}`}
                    onClick={() => navigate(`/dashboard/collections/${col._id}/edit`)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(col._id)}
                        onChange={() => toggleSelect(col._id)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </TableCell>
                    <TableCell className="font-medium">{col.title}</TableCell>
                    <TableCell>
                      <code className="text-xs text-muted-foreground">{col.handle}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={col.type === 'smart' ? 'default' : 'secondary'}>
                        {col.type === 'smart' ? 'Smart' : 'Manual'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {col.type === 'manual' ? (col.productIds?.length ?? 0) : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={col.isPublished ? 'default' : 'outline'}>
                        {col.isPublished ? 'Published' : 'Hidden'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(col.updatedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/dashboard/collections/${col._id}/edit`)}>
                            <Edit className="h-4 w-4 mr-2" />Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(col)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{pagination.total} total collections</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="py-1">Page {page} of {pagination.pages}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Collections;
