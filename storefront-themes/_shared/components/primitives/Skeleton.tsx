import React from 'react';
import { cn } from '../../utils/cn';

interface SkeletonProps {
  className?: string;
  /** Width (e.g., 'w-full', 'w-24') */
  width?: string;
  /** Height (e.g., 'h-4', 'h-48') */
  height?: string;
  /** Shape */
  variant?: 'rectangle' | 'circle' | 'text';
  /** Number of text lines */
  lines?: number;
}

export function Skeleton({ className, width, height, variant = 'rectangle', lines }: SkeletonProps) {
  if (variant === 'text' || lines) {
    const count = lines || 3;
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse',
              i === count - 1 ? 'w-2/3' : 'w-full'
            )}
          />
        ))}
      </div>
    );
  }

  if (variant === 'circle') {
    return (
      <div
        className={cn(
          'rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse',
          width || 'w-12',
          height || 'h-12',
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        'bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse',
        width || 'w-full',
        height || 'h-4',
        className
      )}
    />
  );
}

/** Pre-built skeleton for a product card */
Skeleton.ProductCard = function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('border rounded-lg overflow-hidden', className)}>
      <Skeleton height="h-48" className="rounded-none" />
      <div className="p-3 space-y-2">
        <Skeleton height="h-4" width="w-3/4" />
        <Skeleton height="h-4" width="w-1/3" />
        <div className="flex justify-between pt-1">
          <Skeleton height="h-5" width="w-16" />
          <Skeleton height="h-8" width="w-14" className="rounded-md" />
        </div>
      </div>
    </div>
  );
};

/** Pre-built skeleton for a product grid */
Skeleton.ProductGrid = function ProductGridSkeleton({
  count = 8,
  columns = 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
  className,
}: {
  count?: number;
  columns?: string;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-4', columns, className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton.ProductCard key={i} />
      ))}
    </div>
  );
};

/** Pre-built skeleton for a hero banner */
Skeleton.Hero = function HeroSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <Skeleton height="h-[400px] md:h-[500px]" className="rounded-none" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Skeleton height="h-8" width="w-64" className="mx-auto bg-gray-300/50" />
          <Skeleton height="h-4" width="w-48" className="mx-auto bg-gray-300/50" />
          <Skeleton height="h-10" width="w-32" className="mx-auto rounded-full bg-gray-300/50" />
        </div>
      </div>
    </div>
  );
};
