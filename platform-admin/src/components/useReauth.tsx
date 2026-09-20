import { useState } from 'react';
import { ReauthModal } from './ReauthModal';
import { hasFreshReauth } from '../lib/api';

/**
 * Hook: `ensure()` resolves immediately when a fresh reauth token exists,
 * otherwise opens the modal and resolves once the operator confirms
 * (rejects if they cancel). Render `<reauth.modal />` once in the page.
 */
export function useReauth() {
  const [open, setOpen] = useState(false);
  const [resolver, setResolver] = useState<{ resolve: () => void; reject: (e: Error) => void } | null>(null);

  const ensure = () =>
    new Promise<void>((resolve, reject) => {
      if (hasFreshReauth()) return resolve();
      setResolver({ resolve, reject });
      setOpen(true);
    });

  const modal = (
    <ReauthModal
      open={open}
      onClose={() => {
        setOpen(false);
        resolver?.reject(new Error('Cancelled'));
        setResolver(null);
      }}
      onConfirmed={() => {
        resolver?.resolve();
        setResolver(null);
      }}
    />
  );
  return { ensure, modal };
}
