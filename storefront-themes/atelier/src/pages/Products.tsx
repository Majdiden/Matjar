import React from 'react';
import { useTranslation } from 'react-i18next';
import CollectionView from '../components/CollectionView';

const Products: React.FC = () => {
  const { t } = useTranslation(['theme']);
  return <CollectionView title={t('theme.collection.all_products')} />;
};

export default Products;
