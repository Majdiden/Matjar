import React, { useState } from 'react';
import { logoHeightFactor, splitHeightClasses } from '../theme/logoScale';

interface StoreLogoProps {
  src: string;
  alt: string;
  /**
   * The theme's classes as for a plain <img>: its height classes (`h-9
   * md:h-12`) set the slot a square logo fills; the rest (max width, radius,
   * object-fit) style the image.
   */
  className?: string;
}

/**
 * The store logo in a header or menu, sized for its shape (theme/logoScale.ts):
 * the slot keeps the theme's height and the image is scaled inside it, so a
 * tall, square or wide logo all read clearly.
 */
export function StoreLogo({ src, alt, className = '' }: StoreLogoProps) {
  const [factor, setFactor] = useState(1);
  const { height, rest } = splitHeightClasses(className);
  return (
    <span className={`inline-flex shrink-0 items-center ${height}`}>
      <img
        src={src}
        alt={alt}
        className={rest}
        style={{ height: `${factor * 100}%`, width: 'auto' }}
        onLoad={(e) => {
          const img = e.currentTarget;
          if (img.naturalWidth && img.naturalHeight) setFactor(logoHeightFactor(img.naturalWidth / img.naturalHeight));
        }}
      />
    </span>
  );
}

export default StoreLogo;
