import React from 'react';

/**
 * Tiny self-contained SVG payment-badge. Authored against a 28×20 viewBox
 * and scaled up via the `size` prop while preserving that aspect ratio.
 * No external URLs, no fonts, no network — safe to render in bulk.
 *
 * Known brand codes render a recognizable mark. Unknown codes fall
 * back to a neutral tile showing the code in uppercase.
 */
type SizeToken = 'sm' | 'md' | 'lg' | 'xl';

interface Props {
  code: string;
  className?: string;
  /**
   * Optional uploaded-icon URL. When present, the component renders the
   * merchant's custom image (from their payment-provider upload) in the
   * same rounded tile, instead of the stock brand SVG. Falls back to the
   * SVG lookup if the URL fails to load.
   */
  src?: string;
  /**
   * Rendered height of the badge. Accepts a named token or an explicit
   * pixel height; width auto-scales to keep the 28:20 badge ratio.
   * Defaults to `md` (24px ≈ h-6) — a crisp, accessible badge size.
   *   sm = 20px (dense rows) · md = 24px (footers/general)
   *   lg = 28px (product page) · xl = 32px (checkout picker)
   */
  size?: SizeToken | number;
}

// Base art geometry — the SVG marks are drawn against this 28×20 viewBox.
const BASE_W = 28;
const BASE_H = 20;
const R = 3;

const SIZE_PX: Record<SizeToken, number> = {
  sm: 20,
  md: 24,
  lg: 28,
  xl: 32,
};

function resolveDims(size: Props['size']): { w: number; h: number } {
  const h = typeof size === 'number' ? size : SIZE_PX[size ?? 'md'];
  return { w: Math.round((h * BASE_W) / BASE_H), h };
}

const PaymentLogo: React.FC<Props> = ({ code, className, src, size }) => {
  const c = (code || '').toLowerCase();
  const [imgFailed, setImgFailed] = React.useState(false);
  const { w, h } = resolveDims(size);

  // Local wrapper captures the resolved dimensions so the SVG art scales
  // with the requested `size` instead of being stuck at the base 28×20.
  const Wrap: React.FC<{ fill: string; children?: React.ReactNode; stroke?: string; className?: string }> = ({
    fill,
    stroke,
    children,
    className: wrapClassName,
  }) => (
    <span
      className={wrapClassName}
      style={{ display: 'inline-flex', verticalAlign: 'middle', lineHeight: 0 }}
      aria-hidden="true"
    >
      <svg width={w} height={h} viewBox={`0 0 ${BASE_W} ${BASE_H}`} xmlns="http://www.w3.org/2000/svg">
        <rect
          x="0.5"
          y="0.5"
          width={BASE_W - 1}
          height={BASE_H - 1}
          rx={R}
          ry={R}
          fill={fill}
          stroke={stroke || 'rgba(0,0,0,0.08)'}
        />
        {children}
      </svg>
    </span>
  );

  if (src && /^(https?:|\/)/.test(src) && !imgFailed) {
    return (
      <span
        className={className}
        style={{ display: 'inline-flex', verticalAlign: 'middle', lineHeight: 0 }}
        aria-hidden="true"
      >
        <span
          style={{
            width: w,
            height: h,
            borderRadius: R,
            border: '1px solid rgba(0,0,0,0.08)',
            background: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <img
            src={src}
            alt={code || ''}
            onError={() => setImgFailed(true)}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        </span>
      </span>
    );
  }

  switch (c) {
    case 'visa':
      return (
        <Wrap fill="#1a1f71" className={className}>
          <text x="14" y="14" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="9" fontStyle="italic" fill="#fff">
            VISA
          </text>
        </Wrap>
      );
    case 'mastercard':
    case 'mc':
      return (
        <Wrap fill="#fff" className={className}>
          <circle cx="11" cy="10" r="5.5" fill="#eb001b" />
          <circle cx="17" cy="10" r="5.5" fill="#f79e1b" />
          <path d="M14 5.6a5.5 5.5 0 0 0 0 8.8 5.5 5.5 0 0 0 0-8.8z" fill="#ff5f00" />
        </Wrap>
      );
    case 'amex':
      return (
        <Wrap fill="#2e77bc" className={className}>
          <text x="14" y="13" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="6" fill="#fff">
            AMEX
          </text>
        </Wrap>
      );
    case 'paypal':
      return (
        <Wrap fill="#fff" className={className}>
          <text x="14" y="13" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontStyle="italic" fontSize="7">
            <tspan fill="#003087">Pay</tspan>
            <tspan fill="#009cde">Pal</tspan>
          </text>
        </Wrap>
      );
    case 'applepay':
    case 'apple':
      return (
        <Wrap fill="#000" className={className}>
          <path d="M8.4 8.1c.4-.5.7-1.2.6-1.9-.6 0-1.3.4-1.7.9-.4.4-.7 1.1-.6 1.8.7.1 1.3-.3 1.7-.8z" fill="#fff" />
          <path d="M9 9c-.9 0-1.7.5-2.1.5s-1.1-.5-1.8-.5c-.9 0-1.8.5-2.3 1.4-1 1.7-.3 4.2.7 5.6.5.7 1 1.4 1.8 1.4s1-.5 1.9-.5 1.1.5 1.9.5 1.3-.7 1.7-1.3c.5-.8.8-1.5.8-1.6-.1 0-1.5-.6-1.5-2.3 0-1.4 1.2-2.1 1.2-2.1-.7-1-1.7-1.1-2.3-1.1z" fill="#fff" transform="translate(4.5 0)" />
          <text x="20" y="14" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="7" fill="#fff">
            Pay
          </text>
        </Wrap>
      );
    case 'gpay':
    case 'googlepay':
      return (
        <Wrap fill="#fff" className={className}>
          <text x="9" y="13.5" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="8">
            <tspan fill="#4285f4">G</tspan>
          </text>
          <text x="14" y="13.5" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="6" fill="#5f6368">
            Pay
          </text>
        </Wrap>
      );
    case 'stripe':
      return (
        <Wrap fill="#635bff" className={className}>
          <text x="14" y="14" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontStyle="italic" fontSize="7" fill="#fff">
            stripe
          </text>
        </Wrap>
      );
    case 'discover':
      return (
        <Wrap fill="#fff" className={className}>
          <text x="12" y="13" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="5" fill="#231f20">
            DISCOVER
          </text>
          <circle cx="23" cy="13" r="3" fill="#f68121" />
        </Wrap>
      );
    case 'jcb':
      return (
        <Wrap fill="#fff" className={className}>
          <rect x="3" y="5" width="6" height="10" fill="#0071c5" />
          <rect x="11" y="5" width="6" height="10" fill="#e60012" />
          <rect x="19" y="5" width="6" height="10" fill="#00a651" />
          <text x="14" y="13" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="7" fill="#fff">
            JCB
          </text>
        </Wrap>
      );
    case 'cod':
      return (
        <Wrap fill="#e6f4ea" stroke="#137333" className={className}>
          <rect x="5" y="7" width="18" height="6" rx="1" fill="#137333" />
          <circle cx="14" cy="10" r="1.5" fill="#e6f4ea" />
          <text x="14" y="18" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="4" fill="#137333">
            COD
          </text>
        </Wrap>
      );
    case 'bank':
    case 'banktransfer':
      return (
        <Wrap fill="#f5f5f5" stroke="#333" className={className}>
          <path d="M4 8 L14 4 L24 8 L24 9 L4 9 Z" fill="#444" />
          <rect x="6" y="10" width="2" height="5" fill="#444" />
          <rect x="10" y="10" width="2" height="5" fill="#444" />
          <rect x="14" y="10" width="2" height="5" fill="#444" />
          <rect x="18" y="10" width="2" height="5" fill="#444" />
          <rect x="4" y="15.5" width="20" height="1.5" fill="#444" />
        </Wrap>
      );
    case 'card':
    case 'creditcard':
      return (
        <Wrap fill="#e5e7eb" stroke="#9ca3af" className={className}>
          <rect x="2" y="6" width="24" height="3" fill="#6b7280" />
          <rect x="5" y="12" width="6" height="2" rx="0.5" fill="#6b7280" />
        </Wrap>
      );
    default:
      return (
        <Wrap fill="#f3f4f6" stroke="#9ca3af" className={className}>
          <text
            x="14"
            y="13"
            textAnchor="middle"
            fontFamily="Arial, sans-serif"
            fontWeight="700"
            fontSize="8"
            fill="#374151"
          >
            {(code || '?').toUpperCase().slice(0, 5)}
          </text>
        </Wrap>
      );
  }
};

export default PaymentLogo;
