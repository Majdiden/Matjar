import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { storefrontApi } from '@matjar/theme-shared/api/client';
import { Collection } from '../components/Collection';

/**
 * `/collections/:handle`. The theme owns this route so a collection gets the
 * same banner, toolbar, filters and card as every other product surface.
 * A collection is its own entity — loading it through the category endpoint
 * returns nothing and silently falls back to the whole catalogue.
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
    <Collection
      key={handle}
      collectionHandle={handle}
      title={collection?.title || collection?.name || ''}
      description={collection?.description}
      bannerImage={image}
    />
  );
};

export default CollectionPage;
