import React, { useState } from 'react';
import { SectionRenderer } from '@matjar/theme-shared/theme/SectionRenderer';
import { QuickView } from '@matjar/theme-shared/components/discovery/QuickView';
import { BEAUXE_SECTION_REGISTRY } from '../sections';

const Home: React.FC = () => {
  const [quick, setQuick] = useState<any>(null);
  return (
    <>
      <SectionRenderer
        template="index"
        registry={BEAUXE_SECTION_REGISTRY}
        onQuickView={(p) => setQuick(p)}
      />
      <QuickView product={quick} isOpen={!!quick} onClose={() => setQuick(null)} />
    </>
  );
};

export default Home;
