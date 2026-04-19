import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { Switch } from '../../components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { NavigationIcon, Plus, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { useConfirm } from '../../components/ui/use-confirm';

interface Menu {
  _id: string;
  title: string;
  handle: string;
  location: 'header' | 'footer' | 'mobile' | 'custom';
  items: unknown[];
  isActive: boolean;
  updatedAt: string;
}

const LOCATION_COLORS: Record<string, string> = {
  header: 'bg-blue-100 text-blue-800',
  footer: 'bg-purple-100 text-purple-800',
  mobile: 'bg-orange-100 text-orange-800',
  custom: 'bg-gray-100 text-gray-700',
};

interface MenuItemNode {
  children?: MenuItemNode[];
}

function countItems(items: unknown[]): number {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum: number, item: unknown) => {
    const node = item as MenuItemNode;
    return sum + 1 + countItems(node?.children || []);
  }, 0);
}

const errMsg = (err: unknown, fallback: string): string => {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  if (typeof err === 'string') return err;
  return fallback;
};

interface MenusListResponse {
  menus?: Menu[];
}

export const Menus: React.FC = () => {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { t } = useTranslation(['menus', 'common']);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadMenus(); }, []);

  const loadMenus = async () => {
    try {
      setLoading(true);
      const response = await api.get<MenusListResponse>('/menus') as { data?: MenusListResponse; responseObject?: MenusListResponse };
      setMenus(response.data?.menus || response.responseObject?.menus || []);
    } catch {
      setMenus([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (menu: Menu) => {
    try {
      await api.patch(`/menus/${menu._id}`, { isActive: !menu.isActive });
      setMenus(prev => prev.map(m => m._id === menu._id ? { ...m, isActive: !m.isActive } : m));
      toast.success(menu.isActive ? t('menus:list.toast.deactivated') : t('menus:list.toast.activated'));
    } catch (err) {
      toast.error(errMsg(err, t('menus:list.toast.error_toggle')));
    }
  };

  const handleDelete = async (menu: Menu) => {
    if (!(await confirm({
      title: t('menus:list.confirm.delete_title'),
      description: t('menus:list.confirm.delete_description', { title: menu.title }),
      confirmText: t('common:action.delete'),
      variant: 'destructive',
    }))) return;
    try {
      await api.delete(`/menus/${menu._id}`);
      toast.success(t('menus:list.toast.deleted'));
      setMenus(prev => prev.filter(m => m._id !== menu._id));
    } catch (err) {
      toast.error(errMsg(err, t('menus:list.toast.error_delete')));
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
          <h1 className="text-3xl font-bold tracking-tight">{t('menus:list.title')}</h1>
          <p className="text-muted-foreground">{t('menus:list.subtitle')}</p>
        </div>
        <Button onClick={() => navigate('/dashboard/menus/new')}>
          <Plus className="h-4 w-4 mr-2" />
          {t('menus:list.action.add')}
        </Button>
      </div>

      {menus.length === 0 ? (
        <Card>
          <CardContent className="p-12">
            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <NavigationIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t('menus:list.empty.title')}</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                {t('menus:list.empty.hint')}
              </p>
              <Button onClick={() => navigate('/dashboard/menus/new')}>
                <Plus className="h-4 w-4 mr-2" />
                {t('menus:list.empty.action')}
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
                  <TableHead>{t('menus:list.column.title')}</TableHead>
                  <TableHead>{t('menus:list.column.handle')}</TableHead>
                  <TableHead>{t('menus:list.column.location')}</TableHead>
                  <TableHead>{t('menus:list.column.items')}</TableHead>
                  <TableHead>{t('menus:list.column.active')}</TableHead>
                  <TableHead>{t('menus:list.column.updated')}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {menus.map(menu => (
                  <TableRow
                    key={menu._id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/dashboard/menus/${menu._id}/edit`)}
                  >
                    <TableCell className="font-medium">{menu.title}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{menu.handle}</code>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${LOCATION_COLORS[menu.location] || LOCATION_COLORS.custom}`}
                      >
                        {menu.location}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{countItems(menu.items as unknown[])}</Badge>
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Switch
                        checked={menu.isActive}
                        onCheckedChange={() => handleToggle(menu)}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(menu.updatedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/dashboard/menus/${menu._id}/edit`)}>
                            <Edit className="h-4 w-4 mr-2" />{t('common:action.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(menu)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />{t('common:action.delete')}
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

export default Menus;
