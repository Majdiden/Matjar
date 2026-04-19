import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation(['pages', 'common']);
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
      title: t('pages:confirm.delete_title'),
      description: t('pages:confirm.delete_description', { title: page.title }),
      confirmText: t('common:action.delete'),
      variant: 'destructive',
    }))) return;
    try {
      await api.pages.delete(page._id);
      toast.success(t('pages:toast.deleted'));
      setPages(prev => prev.filter(p => p._id !== page._id));
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message || t('pages:toast.error_delete'));
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
          <h1 className="text-3xl font-bold tracking-tight">{t('pages:list.title')}</h1>
          <p className="text-muted-foreground">{t('pages:list.subtitle')}</p>
        </div>
        <Button onClick={() => navigate('/dashboard/pages/new')}>
          <Plus className="h-4 w-4 me-2" />
          {t('pages:list.action.add')}
        </Button>
      </div>

      {pages.length === 0 ? (
        <Card>
          <CardContent className="p-12">
            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t('pages:list.empty.title')}</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                {t('pages:list.empty.hint')}
              </p>
              <Button onClick={() => navigate('/dashboard/pages/new')}>
                <Plus className="h-4 w-4 me-2" />
                {t('pages:list.empty.action')}
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
                  <TableHead>{t('pages:list.column.title')}</TableHead>
                  <TableHead>{t('pages:list.column.slug')}</TableHead>
                  <TableHead>{t('pages:list.column.locale')}</TableHead>
                  <TableHead>{t('pages:list.column.status')}</TableHead>
                  <TableHead>{t('pages:list.column.updated')}</TableHead>
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
                        {p.isPublished ? t('pages:form.status.published') : t('pages:form.status.draft')}
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
                            <Edit className="h-4 w-4 me-2" />{t('common:action.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(p)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 me-2" />{t('common:action.delete')}
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
