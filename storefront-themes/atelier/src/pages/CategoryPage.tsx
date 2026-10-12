import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { storefrontApi } from '@matjar/theme-shared/api/client';
import CollectionView from '../components/CollectionView';
import { localizeCategory } from '@matjar/theme-shared/hooks/useProducts';
import { useLanguage } from '@matjar/theme-shared/i18n/LanguageProvider';

const CategoryPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [rawCategory, setCategory] = useState<any>(null);
  // In the shopper's language (the API returns the store's own).
  const { lang } = useLanguage();
  const category = useMemo(() => (rawCategory ? localizeCategory(rawCategory, lang) : rawCategory), [rawCategory, lang]);
  useEffect(() => {
    let live = true;
    setCategory(null);
    storefrontApi.getCategory(slug!, { limit: 1 }).then((r: any) => { if (live) setCategory(r?.data?.category || null); }).catch(() => {});
    return () => { live = false; };
  }, [slug]);
  return (
    <CollectionView
      key={slug}
      title={category?.name || ''}
      description={category?.description}
      categorySlug={slug}
      categoryId={category?._id}
      bannerImage={category?.image}
    />
  );
};

export default CategoryPage;
