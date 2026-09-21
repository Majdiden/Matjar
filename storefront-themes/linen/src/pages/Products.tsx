import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Collection } from '../components/Collection';

const Products: React.FC = () => {
  const { t } = useTranslation(['theme']);
  const [params] = useSearchParams();
  const search = params.get('search');
  return <Collection title={search ? t('theme.collection.search_title', { term: search }) : t('theme.collection.all_products')} />;
};

export default Products;
