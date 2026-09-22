import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { storefrontApi } from '@matjar/theme-shared/api/client';
import CollectionView from '../components/CollectionView';

/**
 * `/collections/:handle`. The SDK's generic collection page renders the
 * shared product card in its own grid; Atelier owns the route so a
 * collection uses the same hero, toolbar, filters and card as every other
 * product surface. A collection is its own entity — loading it as a
 * category returned nothing and fell back to the whole catalogue.
 */
const CollectionPage: React.FC = () => {
  const { handle } = useParams<{ handle: string }>();
  const [collection, setCollection] = useState<any>(null);
  useEffect(() => {
    let live = true;
    setCollection(null);
    storefrontApi.getCollection(handle!, { limit: 1 })
      .then((r: any) => { if (live) setCollection(r?.data?.collection || null); })
      .catch(() => {});
    return () => { live = false; };
  }, [handle]);
  const image = typeof collection?.image === 'string' ? collection.image : collection?.image?.url;
  return (
    <CollectionView
      key={handle}
      title={collection?.title || collection?.name || ''}
      description={collection?.description}
      collectionHandle={handle}
      bannerImage={image}
    />
  );
};

export default CollectionPage;
