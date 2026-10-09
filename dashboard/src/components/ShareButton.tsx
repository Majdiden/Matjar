import React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Copy, Facebook, Send, Share2 } from 'lucide-react';
import { Button, type ButtonProps } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { SHARE_TARGETS, shareIntentUrl, type ShareTarget } from '../lib/share';

// =============================================================================
// General "Share" button. On phones (and any browser with the Web Share API)
// it opens the device's own share sheet, so the merchant can send the link to
// WhatsApp, Facebook, Telegram, SMS — whatever is installed. Elsewhere it
// falls back to a small menu of the main channels plus "Copy link".
// =============================================================================

export interface ShareButtonProps extends Omit<ButtonProps, 'onClick' | 'asChild'> {
  /** Absolute URL to share. */
  url: string;
  /** Short message sent with the link (WITHOUT the url — targets add it). */
  message?: string;
  /** Title for the native share sheet. */
  title?: string;
}

// Lucide dropped brand icons; WhatsApp is the main sales channel in our
// market, so we inline its mark.
const WhatsAppIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.82 9.82 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.82 11.82 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.88 11.88 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 0 0-3.48-8.413Z" />
  </svg>
);

const TARGET_ICONS: Record<ShareTarget, React.FC<{ className?: string }>> = {
  whatsapp: WhatsAppIcon,
  facebook: Facebook,
  telegram: Send,
};

const hasNativeShare = () =>
  typeof navigator !== 'undefined' && typeof navigator.share === 'function';

export const ShareButton: React.FC<ShareButtonProps> = ({
  url,
  message = '',
  title,
  children,
  ...buttonProps
}) => {
  const { t } = useTranslation('common');

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('share.copied'));
    } catch {
      // Clipboard can be blocked (insecure context, permissions) — show the
      // link so it can still be copied by hand.
      toast.message(url);
    }
  };

  const label = children ?? (
    <>
      <Share2 className="h-4 w-4 me-1.5" />
      {t('share.button')}
    </>
  );

  if (hasNativeShare()) {
    const shareNatively = async () => {
      try {
        await navigator.share({ title, text: message || undefined, url });
      } catch (err) {
        // Dismissing the sheet is not an error; anything else (unsupported
        // payload, permission) falls back to copying.
        if ((err as DOMException)?.name !== 'AbortError') await copyLink();
      }
    };
    return (
      <Button type="button" {...buttonProps} onClick={shareNatively}>
        {label}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" {...buttonProps}>
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[12rem]">
        {SHARE_TARGETS.map((target) => {
          const Icon = TARGET_ICONS[target];
          return (
            <DropdownMenuItem key={target} asChild>
              <a href={shareIntentUrl(target, url, message)} target="_blank" rel="noopener noreferrer">
                <Icon className="h-4 w-4" />
                {t(`share.targets.${target}`)}
              </a>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={copyLink}>
          <Copy className="h-4 w-4" />
          {t('share.copy_link')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
