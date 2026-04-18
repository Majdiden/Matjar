import React from 'react';
import { cn } from '../../utils/cn';
import { useThemeSlot } from '../../theme/ThemeSlotsProvider';

export const SLOT_KEY = 'ratingStars';

interface RatingStarsProps {
  rating: number;
  maxRating?: number;
  reviewCount?: number;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
  showNumber?: boolean;
  className?: string;
  starClassName?: string;
}

const sizeClasses = {
  sm: { star: 'w-3 h-3', text: 'text-xs' },
  md: { star: 'w-4 h-4', text: 'text-sm' },
  lg: { star: 'w-5 h-5', text: 'text-base' },
};

export function RatingStars(props: RatingStarsProps) {
  const Override = useThemeSlot<React.ComponentType<RatingStarsProps>>(SLOT_KEY);
  if (Override) return <Override {...props} />;
  const {
    rating,
    maxRating = 5,
    reviewCount,
    size = 'md',
    showCount = true,
    showNumber = false,
    className,
    starClassName,
  } = props;
  const styles = sizeClasses[size];

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <div className="flex" aria-label={`${rating} out of ${maxRating} stars`}>
        {Array.from({ length: maxRating }).map((_, i) => {
          const fill = Math.min(1, Math.max(0, rating - i));
          return (
            <svg
              key={i}
              className={cn(styles.star, starClassName)}
              viewBox="0 0 20 20"
              fill="none"
            >
              {/* Background star (gray) */}
              <path
                d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                className="fill-gray-200 dark:fill-gray-600"
              />
              {/* Filled star (yellow) — uses clip for partial fills */}
              {fill > 0 && (
                <path
                  d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                  className="fill-yellow-400"
                  clipPath={fill < 1 ? `inset(0 ${(1 - fill) * 100}% 0 0)` : undefined}
                />
              )}
            </svg>
          );
        })}
      </div>
      {showNumber && (
        <span className={cn(styles.text, 'font-medium text-gray-700 dark:text-gray-300')}>
          {rating.toFixed(1)}
        </span>
      )}
      {showCount && reviewCount !== undefined && (
        <span className={cn(styles.text, 'text-gray-500')}>
          ({reviewCount})
        </span>
      )}
    </div>
  );
}
