import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api-client';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';
import { FilterPills } from '../../components/ui/filter-pills';
import { Star, Check, X, Trash2, MessageSquare, Inbox, Clock, CheckCircle2, Search } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import { toast } from 'sonner';
import { useConfirm } from '../../components/ui/use-confirm';
import { useViewMode, ViewToggle } from '../../components/ui/view-toggle';

interface Review {
  _id: string;
  rating: number;
  title?: string;
  comment: string;
  isApproved: boolean;
  isVerifiedPurchase?: boolean;
  user?: { firstName: string; lastName: string; email: string };
  product?: { _id: string; name: string; slug: string; images?: string[] };
  createdAt: string;
}

interface ReviewsQuery {
  page: number;
  limit: number;
  status?: string;
  search?: string;
}

interface ReviewsListResponse {
  reviews: Review[];
  pagination: { pages: number; total: number };
}

const errMsg = (err: unknown, fallback: string): string => {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  if (typeof err === 'string') return err;
  return fallback;
};

export default function Reviews() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useViewMode('reviews.viewMode', 'cards');
  const confirm = useConfirm();

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const params: ReviewsQuery = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      if (search.trim()) params.search = search.trim();
      const res = await api.get<{ data: ReviewsListResponse }>('/reviews', { params });
      setReviews(res.data.reviews);
      setTotalPages(res.data.pagination.pages);
      setTotal(res.data.pagination.total);
    } catch (err) {
      toast.error(errMsg(err, 'Failed to fetch reviews'));
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selected.size === reviews.length) setSelected(new Set());
    else setSelected(new Set(reviews.map((r) => r._id)));
  };

  const handleBulkApprove = async (approve: boolean) => {
    if (selected.size === 0) return;
    try {
      await Promise.all([...selected].map((id) =>
        api.patch(`/reviews/${id}/${approve ? 'approve' : 'reject'}`)
      ));
      toast.success(`${selected.size} review${selected.size === 1 ? '' : 's'} ${approve ? 'approved' : 'rejected'}`);
      setSelected(new Set());
      fetchReviews();
    } catch (err) {
      toast.error(errMsg(err, 'Bulk update failed'));
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!(await confirm({
      title: `Delete ${selected.size} review${selected.size === 1 ? '' : 's'}?`,
      description: 'This cannot be undone.',
      confirmText: 'Delete',
      variant: 'destructive',
    }))) return;
    try {
      await Promise.all([...selected].map((id) => api.delete(`/reviews/${id}`)));
      toast.success(`${selected.size} deleted`);
      setSelected(new Set());
      fetchReviews();
    } catch (err) {
      toast.error(errMsg(err, 'Bulk delete failed'));
    }
  };

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const handleApprove = async (id: string) => {
    try {
      await api.patch(`/reviews/${id}/approve`);
      toast.success('Review approved');
      setReviews(prev => prev.map(r => r._id === id ? { ...r, isApproved: true } : r));
    } catch (err) { toast.error(errMsg(err, 'Failed to approve')); }
  };

  const handleReject = async (id: string) => {
    try {
      await api.patch(`/reviews/${id}/reject`);
      toast.success('Review rejected');
      setReviews(prev => prev.map(r => r._id === id ? { ...r, isApproved: false } : r));
    } catch (err) { toast.error(errMsg(err, 'Failed to reject')); }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm({
      title: 'Delete review?',
      description: 'This permanently removes the review. This cannot be undone.',
      confirmText: 'Delete',
      variant: 'destructive',
    }))) return;
    try {
      await api.delete(`/reviews/${id}`);
      toast.success('Review deleted');
      setReviews(prev => prev.filter(r => r._id !== id));
      setTotal(t => t - 1);
    } catch (err) { toast.error(errMsg(err, 'Failed to delete')); }
  };

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`h-4 w-4 ${i <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reviews</h1>
        <p className="text-muted-foreground">{total} total reviews</p>
      </div>

      <FilterPills
        items={[
          { id: '', label: 'All', icon: Inbox },
          { id: 'pending', label: 'Pending', icon: Clock },
          { id: 'approved', label: 'Approved', icon: CheckCircle2 },
        ]}
        value={statusFilter}
        onChange={(v) => { setStatusFilter(v); setPage(1); }}
      />

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search review title or comment..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="ml-auto">
          <ViewToggle mode={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center justify-between p-3 rounded-lg border bg-primary/5">
          <p className="text-sm font-medium">{selected.size} selected</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkApprove(true)}>
              <Check className="h-3.5 w-3.5 mr-1.5" />Approve
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkApprove(false)}>
              <X className="h-3.5 w-3.5 mr-1.5" />Reject
            </Button>
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />Delete
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : reviews.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No reviews found</h3>
            <p className="text-sm text-muted-foreground">Reviews from customers will appear here.</p>
          </CardContent>
        </Card>
      ) : viewMode === 'table' ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <input
                    type="checkbox"
                    checked={selected.size === reviews.length && reviews.length > 0}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Excerpt</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-[120px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviews.map((review) => {
                const isSel = selected.has(review._id);
                return (
                  <TableRow key={review._id} className={isSel ? 'bg-primary/5' : ''}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => toggleSelect(review._id)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </TableCell>
                    <TableCell className="text-sm font-medium max-w-[160px] truncate">
                      {review.product?.name || 'Unknown product'}
                    </TableCell>
                    <TableCell>{renderStars(review.rating)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {review.user ? `${review.user.firstName} ${review.user.lastName}` : 'Anonymous'}
                    </TableCell>
                    <TableCell className="text-sm max-w-[280px] truncate">
                      {review.title ? <span className="font-medium mr-1">{review.title}</span> : null}
                      <span className="text-muted-foreground">{review.comment}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={review.isApproved ? 'default' : 'secondary'} className="text-[10px] h-5">
                        {review.isApproved ? 'Approved' : 'Pending'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        {!review.isApproved && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleApprove(review._id)} title="Approve">
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                        {review.isApproved && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleReject(review._id)} title="Reject">
                            <X className="h-4 w-4 text-yellow-600" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(review._id)} title="Delete">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="space-y-4">
          <label className="flex items-center gap-3 px-2 text-xs uppercase tracking-wider font-medium text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={selected.size === reviews.length && reviews.length > 0}
              onChange={toggleSelectAll}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span>Select all</span>
          </label>
          {reviews.map(review => (
            <Card key={review._id} className={selected.has(review._id) ? 'border-primary/50 bg-primary/5' : ''}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(review._id)}
                    onChange={() => toggleSelect(review._id)}
                    className="h-4 w-4 rounded border-gray-300 mt-1 flex-shrink-0"
                  />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      {renderStars(review.rating)}
                      <Badge variant={review.isApproved ? 'default' : 'secondary'}>
                        {review.isApproved ? 'Approved' : 'Pending'}
                      </Badge>
                      {review.isVerifiedPurchase && (
                        <Badge variant="outline">Verified Purchase</Badge>
                      )}
                    </div>
                    {review.title && <h3 className="font-semibold">{review.title}</h3>}
                    <p className="text-sm text-muted-foreground">{review.comment}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                      <span>By {review.user ? `${review.user.firstName} ${review.user.lastName}` : 'Anonymous'}</span>
                      <span>on {review.product?.name || 'Unknown product'}</span>
                      <span>{new Date(review.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 ml-4">
                    {!review.isApproved && (
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleApprove(review._id)} title="Approve">
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                    )}
                    {review.isApproved && (
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleReject(review._id)} title="Reject">
                        <X className="h-4 w-4 text-yellow-600" />
                      </Button>
                    )}
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleDelete(review._id)} title="Delete">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
