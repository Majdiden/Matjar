import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { storefrontApi } from '@matjar/theme-shared/api/client';
import CollectionView from '../components/CollectionView';

const CategoryPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [category, setCategory] = useState<any>(null);
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
