import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api-client';
import { formatCurrency } from '../../lib/format';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import { Heart, ImageOff } from 'lucide-react';
import { errMsg } from '../../lib/errors';
import { toast } from 'sonner';

interface TopWishlistedItem {
  count: number;
  product: {
    _id: string;
    name: string;
    slug?: string;
    price?: number;
    image?: string;
  };
}

export default function Wishlists() {
  const { t } = useTranslation(['wishlists', 'common']);
  const [items, setItems] = useState<TopWishlistedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = (await api.analytics.getTopWishlisted(20)) as {
        data?: { items?: TopWishlistedItem[] };
        responseObject?: { items?: TopWishlistedItem[] };
      };
      setItems(res.data?.items || res.responseObject?.items || []);
    } catch (err) {
      toast.error(errMsg(err, t('common:errors.generic', 'Something went wrong')));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            {t('most_wishlisted')}
          </CardTitle>
          <CardDescription>{t('most_wishlisted_desc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-md" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Heart className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t('empty')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">{t('rank')}</TableHead>
                  <TableHead>{t('product')}</TableHead>
                  <TableHead className="text-end">{t('price')}</TableHead>
                  <TableHead className="text-end">{t('wishlist_count')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => (
                  <TableRow key={item.product._id}>
                    <TableCell className="font-medium text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                          {item.product.image ? (
                            <img
                              src={item.product.image}
                              alt={item.product.name}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <ImageOff className="h-5 w-5 text-muted-foreground/50" />
                          )}
                        </div>
                        <span className="font-medium">{item.product.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {item.product.price != null ? formatCurrency(item.product.price) : '—'}
                    </TableCell>
                    <TableCell className="text-end">
                      <Badge variant="secondary" className="tabular-nums">
                        <Heart className="me-1 h-3 w-3" />
                        {item.count}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
