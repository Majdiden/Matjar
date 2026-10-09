/**
 * Shrink a phone photo before upload. A 12-megapixel camera shot is 3–6 MB;
 * on a weak connection that upload often never finishes. The server resizes
 * anyway (services/upload.js), so sending more than ~1600px is wasted data.
 *
 * Returns the original file when it is already small, not a JPEG/PNG/WebP,
 * when the browser can't decode it, or when re-encoding doesn't help.
 */
const SHRINK_MAX_SIDE_PX = 1600;
const SHRINK_MIN_BYTES = 400 * 1024;
const SHRINK_QUALITY = 0.85;

export async function shrinkImage(file: File, maxSide = SHRINK_MAX_SIDE_PX): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < SHRINK_MIN_BYTES) return file;
  if (typeof createImageBitmap !== 'function') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    // WebP keeps logo transparency and is small; browsers that can't encode
    // it hand back PNG, which the size check below usually rejects.
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', SHRINK_QUALITY),
    );
    if (!blob || blob.size >= file.size || !/^image\/(webp|png|jpeg)$/.test(blob.type)) return file;
    const ext = blob.type.split('/')[1];
    const name = file.name.replace(/\.[^.]+$/, '') + '.' + ext;
    return new File([blob], name, { type: blob.type });
  } catch {
    return file;
  }
}
