/**
 * Reference-counted body scroll lock shared by every overlay (dialogs, the
 * mobile nav drawer). Each overlay independently saving and restoring
 * `body.style.overflow` breaks as soon as two overlap: the last one to close
 * restores "hidden" and the page stays frozen until a reload.
 */
let locks = 0;
let previousOverflow = '';

export function lockBodyScroll(): () => void {
  if (locks === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  locks += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks = Math.max(0, locks - 1);
    if (locks === 0) document.body.style.overflow = previousOverflow;
  };
}
