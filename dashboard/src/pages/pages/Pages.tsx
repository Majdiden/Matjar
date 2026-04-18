import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { FileText, Plus, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { useConfirm } from '../../components/ui/use-confirm';

interface PageRow {
  _id: string;
  title: string;
  slug: string;
  locale: string;
  isPublished: boolean;
  publishedAt: string | null;
  updatedAt: string;
}

export const Pages: React.FC = () => {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [pages, setPages] = useState<PageRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = (await api.pages.list({ limit: 100 })) as { data?: { pages?: PageRow[] } };
      setPages(res?.data?.pages || []);
    } catch {
      setPages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (page: PageRow) => {
    if (!(await confirm({
      title: 'Delete page?',
      description: `"${page.title}" will be permanently removed.`,
      confirmText: 'Delete',
      variant: 'destructive',
    }))) return;
    try {
      await api.pages.delete(page._id);
      toast.success('Page deleted');
      setPages(prev => prev.filter(p => p._id !== page._id));
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message || 'Failed to delete page');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pages</h1>
          <p className="text-muted-foreground">Static content pages (About, Contact, Privacy…)</p>
        </div>
        <Button onClick={() => navigate('/dashboard/pages/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Add Page
        </Button>
      </div>

      {pages.length === 0 ? (
        <Card>
          <CardContent className="p-12">
            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No pages yet</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                Create static content pages your storefront can link to from navigation menus or footer.
              </p>
              <Button onClick={() => navigate('/dashboard/pages/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Page
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
                  <TableHead>Title</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Locale</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pages.map(p => (
                  <TableRow
                    key={p._id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/dashboard/pages/${p._id}/edit`)}
                  >
                    <TableCell className="font-medium">{p.title}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{p.slug}</code>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.locale}</TableCell>
                    <TableCell>
                      <Badge variant={p.isPublished ? 'default' : 'secondary'}>
                        {p.isPublished ? 'Published' : 'Draft'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(p.updatedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/dashboard/pages/${p._id}/edit`)}>
                            <Edit className="h-4 w-4 mr-2" />Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(p)}
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
    </div>
  );
};

export default Pages;
