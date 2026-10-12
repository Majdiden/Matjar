import { api } from './api-client';
import { takePendingIdentity } from './signupIdentity';

/** Longest we hold the "store is ready" screen for the photos. */
const UPLOAD_TIMEOUT_MS = 20000;

const urlOf = (res: unknown): string | null =>
  ((res as { data?: { url?: string } } | null)?.data?.url as string | undefined) || null;

/**
 * Upload the logo and cover photo chosen at signup to the new store, with
 * the new store's token (the browser may still hold another store's
 * session). Best effort: never throws, gives up after UPLOAD_TIMEOUT_MS, and
 * whatever did not make it is asked for again by the guided setup.
 */
export async function uploadPendingIdentity(token: string): Promise<void> {
  const { logo, cover } = takePendingIdentity();
  if (!token || (!logo && !cover)) return;
  const work = Promise.allSettled([
    // POST /upload/logo also stores it as the store logo.
    logo ? api.upload.logo(logo, { token }) : null,
    cover
      ? api.upload.contentImage(cover, undefined, { token }).then((res) => {
          const url = urlOf(res);
          return url ? api.storeProfile.update({ brand: { coverImage: url } }, { token }) : null;
        })
      : null,
  ]);
  await Promise.race([work, new Promise((ok) => setTimeout(ok, UPLOAD_TIMEOUT_MS))]);
}
