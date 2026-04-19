import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/cn';
import type { MegaMenuCategory } from '../../types/components';
import { useThemeSlot } from '../../theme/ThemeSlotsProvider';

export const SLOT_KEY = 'megaMenu';

interface MegaMenuProps {
  categories: MegaMenuCategory[];
  className?: string;
}

export function MegaMenu(props: MegaMenuProps) {
  const Override = useThemeSlot<React.ComponentType<MegaMenuProps>>(SLOT_KEY);
  if (Override) return <Override {...props} />;
  const { t } = useTranslation('nav');
  const { categories, className } = props;
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  return (
    <nav aria-label={t('megamenu.aria')} className={cn('relative', className)}>
      <ul className="flex items-center gap-1">
        {categories.map(cat => (
          <li
            key={cat.slug}
            onMouseEnter={() => setActiveCategory(cat.slug)}
            onMouseLeave={() => setActiveCategory(null)}
            className="relative"
          >
            <Link
              to={`/categories/${cat.slug}`}
              className={cn(
                'px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                activeCategory === cat.slug
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              )}
            >
              {cat.name}
            </Link>

            {/* Mega dropdown */}
            {cat.children && cat.children.length > 0 && activeCategory === cat.slug && (
              <div
                className="absolute start-0 top-full pt-2 z-50"
                onMouseEnter={() => setActiveCategory(cat.slug)}
                onMouseLeave={() => setActiveCategory(null)}
              >
                <div className="bg-white dark:bg-gray-900 border rounded-xl shadow-xl p-6 min-w-[500px] grid grid-cols-3 gap-6">
                  {/* Subcategories */}
                  <div className="col-span-2">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                      {cat.name}
                    </h3>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                      {cat.children.map(sub => (
                        <Link
                          key={sub.slug}
                          to={`/categories/${sub.slug}`}
                          className="py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                        >
                          {sub.name}
                        </Link>
                      ))}
                    </div>
                    <Link
                      to={`/categories/${cat.slug}`}
                      className="inline-block mt-4 text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                      {t('megamenu.view_all', { name: cat.name })}
                    </Link>
                  </div>

                  {/* Featured image */}
                  {cat.image && (
                    <div className="col-span-1">
                      <Link to={`/categories/${cat.slug}`} className="block">
                        <img
                          src={cat.image}
                          alt={cat.name}
                          className="w-full h-40 object-cover rounded-lg"
                        />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
