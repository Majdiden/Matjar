import React, { useState, useRef } from 'react';
import { cn } from '../../utils/cn';
import { useThemeSlot } from '../../theme/ThemeSlotsProvider';

export const SLOT_KEY = 'imageZoom';

interface ImageZoomProps {
  src: string;
  alt?: string;
  className?: string;
  zoomScale?: number;
  /** Show lens cursor on hover */
  showLens?: boolean;
  /** Image fit mode — 'contain' shows the whole image with padding (default for PDP),
   *  'cover' fills and crops. */
  fit?: 'cover' | 'contain';
}

export function ImageZoom(props: ImageZoomProps) {
  const Override = useThemeSlot<React.ComponentType<ImageZoomProps>>(SLOT_KEY);
  if (Override) return <Override {...props} />;
  const {
    src,
    alt = '',
    className,
    zoomScale = 2.5,
    showLens = true,
    fit = 'contain',
  } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const [zooming, setZooming] = useState(false);
  const [position, setPosition] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPosition({ x, y });
  };

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-hidden rounded-lg', showLens && 'cursor-zoom-in', className)}
      onMouseEnter={() => setZooming(true)}
      onMouseLeave={() => setZooming(false)}
      onMouseMove={handleMouseMove}
    >
      <img
        src={src}
        alt={alt}
        className={cn(
          'w-full h-full',
          fit === 'contain' ? 'object-contain p-6 sm:p-8' : 'object-cover'
        )}
        draggable={false}
      />

      {/* Zoomed overlay */}
      {zooming && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `url(${src})`,
            backgroundSize: `${zoomScale * 100}%`,
            backgroundPosition: `${position.x}% ${position.y}%`,
            backgroundRepeat: 'no-repeat',
            backgroundColor: fit === 'contain' ? '#fff' : undefined,
          }}
        />
      )}
    </div>
  );
}
