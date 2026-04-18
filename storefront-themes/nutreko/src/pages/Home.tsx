import React, { useState } from 'react';
import { SectionRenderer } from '@shared/theme/SectionRenderer';
import { QuickView } from '@shared/components/discovery/QuickView';
import { NUTREKO_SECTION_REGISTRY } from '../sections';

const Home: React.FC = () => {
  const [quick, setQuick] = useState<any>(null);
  return (
    <>
      <SectionRenderer
        template="index"
        registry={NUTREKO_SECTION_REGISTRY}
        onQuickView={(p) => setQuick(p)}
      />
      <QuickView product={quick} isOpen={!!quick} onClose={() => setQuick(null)} />
    </>
  );
};

export default Home;
