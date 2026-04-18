/**
 * TechHub Home — fully data-driven. The homepage is composed entirely
 * from sections declared in the manifest's `homeVariants` (selected via
 * the `home_variant` theme setting) and resolved against the techhub
 * section registry. No hardcoded section JSX lives here anymore; to
 * change the layout, edit the manifest or pick a different variant in
 * the dashboard.
 */
import React, { useState } from 'react';
import { SectionRenderer } from '@shared/theme/SectionRenderer';
import { QuickView } from '@shared/components/discovery/QuickView';
import { TECHHUB_SECTION_REGISTRY } from '../sections';
import type { Product } from '@shared/types/commerce';

const Home: React.FC = () => {
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  return (
    <div style={{ backgroundColor: 'var(--color-background)', color: 'var(--color-foreground)' }}>
      <SectionRenderer
        template="index"
        registry={TECHHUB_SECTION_REGISTRY}
        onQuickView={setQuickViewProduct}
      />
      <QuickView
        product={quickViewProduct}
        isOpen={!!quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
      />
    </div>
  );
};

export default Home;
