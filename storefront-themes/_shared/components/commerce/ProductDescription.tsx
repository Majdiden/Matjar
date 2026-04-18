import React from 'react';
import { useThemeSlot } from '../../theme/ThemeSlotsProvider';

export const SLOT_KEY = 'productDescription';

/**
 * Theme-neutral product description block. Shows shortDescription as a lead
 * paragraph followed by the long description (rendered as HTML). Falls back
 * to a graceful "no description" notice when both are empty.
 *
 * Themes drop this inside their own Description tab. Styling inherits from
 * the surrounding container (color, font).
 */

interface ProductDescriptionProps {
  product: {
    description?: string;
    shortDescription?: string;
  };
  className?: string;
}

const ProductDescription: React.FC<ProductDescriptionProps> = (props) => {
  const Override = useThemeSlot<React.ComponentType<ProductDescriptionProps>>(SLOT_KEY);
  if (Override) return <Override {...props} />;
  const { product, className = '' } = props;
  const hasAny = !!(product.description || product.shortDescription);

  if (!hasAny) {
    return <p className={`opacity-60 text-sm ${className}`}>No description available.</p>;
  }

  return (
    <div className={className}>
      {product.shortDescription && (
        <p className="text-base font-medium mb-4 leading-relaxed">{product.shortDescription}</p>
      )}
      {product.description && (
        <div
          className="prose prose-sm max-w-none leading-relaxed"
          dangerouslySetInnerHTML={{ __html: product.description }}
        />
      )}
    </div>
  );
};

export default ProductDescription;
