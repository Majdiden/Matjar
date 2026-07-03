import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import { Plus, X, ArrowUp, ArrowDown, Search } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Product {
  _id: string;
  name: string;
  slug: string;
  price: number;
  images: string[];
  status: string;
}

// ─── Products card (manual collections) ──────────────────────────────────────

interface CollectionProductsCardProps {
  products: Product[];
  onOpenPicker: () => void;
  onMoveProduct: (index: number, direction: 'up' | 'down') => void;
  onRemoveProduct: (product: Product) => void;
}

export const CollectionProductsCard: React.FC<CollectionProductsCardProps> = ({
  products,
  onOpenPicker,
  onMoveProduct,
  onRemoveProduct,
}) => {
  const { t } = useTranslation(['products', 'common']);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t('products.collections.form.section.products')}</CardTitle>
          <Button size="sm" variant="secondary" onClick={onOpenPicker}>
            <Plus className="h-4 w-4 me-1" />{t('products.collections.form.products.add_button')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {t('products.collections.form.products.no_products')}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('products.collections.form.products.column.product')}</TableHead>
                <TableHead>{t('products.collections.form.products.column.price')}</TableHead>
                <TableHead className="w-28">{t('products.collections.form.products.column.order')}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p, i) => (
                <TableRow key={p._id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {p.images?.[0] && (
                        <img src={p.images[0]} alt={p.name} className="h-8 w-8 rounded object-cover" />
                      )}
                      <span className="text-sm font-medium">{p.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">${p.price?.toFixed(2)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        disabled={i === 0}
                        onClick={() => onMoveProduct(i, 'up')}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        disabled={i === products.length - 1}
                        onClick={() => onMoveProduct(i, 'down')}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                      onClick={() => onRemoveProduct(p)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

// ─── Product picker dialog ────────────────────────────────────────────────────

interface CollectionProductPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  search: string;
  onSearchChange: (value: string) => void;
  results: Product[];
  selected: Set<string>;
  loading: boolean;
  onToggleProduct: (pid: string) => void;
  onConfirm: () => void;
}

export const CollectionProductPickerDialog: React.FC<CollectionProductPickerDialogProps> = ({
  open,
  onOpenChange,
  search,
  onSearchChange,
  results,
  selected,
  loading,
  onToggleProduct,
  onConfirm,
}) => {
  const { t } = useTranslation(['products', 'common']);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('products.collections.picker.title')}</DialogTitle>
        </DialogHeader>
        <div className="relative mb-3">
          <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="ps-8"
            placeholder={t('products.collections.picker.search_placeholder')}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <div className="overflow-y-auto flex-1 min-h-0">
          {loading ? (
            <div className="space-y-2 p-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : results.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t('products.collections.picker.no_products')}</p>
          ) : (
            <Table>
              <TableBody>
                {results.map((p) => (
                  <TableRow
                    key={p._id}
                    className="cursor-pointer"
                    onClick={() => onToggleProduct(p._id)}
                  >
                    <TableCell className="w-8">
                      <input
                        type="checkbox"
                        checked={selected.has(p._id)}
                        readOnly
                        className="accent-primary"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {p.images?.[0] && (
                          <img src={p.images[0]} alt={p.name} className="h-8 w-8 rounded object-cover" />
                        )}
                        <span className="text-sm">{p.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      ${p.price?.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common:action.cancel')}</Button>
          <Button onClick={onConfirm} disabled={selected.size === 0}>
            {selected.size > 0
              ? t('products.collections.picker.add_button', { count: selected.size })
              : t('products.collections.picker.add_button_empty')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
