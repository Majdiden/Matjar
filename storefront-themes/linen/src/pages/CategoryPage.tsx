import React from 'react';
import { useParams } from 'react-router-dom';
import { useCategories } from '@matjar/theme-shared/hooks/useProducts';
import { Collection } from '../components/Collection';

const CategoryPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { categories } = useCategories();
  const cat: any = categories.find((c: any) => c.slug === slug);
  return <Collection key={slug} categorySlug={slug} title={cat?.name || ''} bannerImage={cat?.image} description={cat?.description} />;
};

export default CategoryPage;
