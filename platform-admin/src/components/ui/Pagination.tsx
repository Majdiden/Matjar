import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

/** Prev/next footer used by the list pages. Renders nothing for a single page. */
export function Pagination({
  page,
  pages,
  total,
  loading,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  loading?: boolean;
  onPage: (p: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="text-muted-foreground">
        Page {page} of {pages} · {total} total
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="h-3.5 w-3.5" /> Prev
        </Button>
        <Button variant="outline" size="sm" disabled={page >= pages || loading} onClick={() => onPage(page + 1)}>
          Next <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
