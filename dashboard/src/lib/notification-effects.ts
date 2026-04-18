let audioCtx: AudioContext | null = null;

// Safari historically only exposes the constructor as `webkitAudioContext`.
// AudioContext is a global constructor in lib.dom but isn't on the Window
// interface; we read both via a structural cast rather than `any`.
interface AudioContextHolder {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

export function playNotificationChime() {
  try {
    const w = window as unknown as AudioContextHolder;
    const Ctor: typeof AudioContext | undefined =
      w.AudioContext || w.webkitAudioContext;
    if (!Ctor) return;
    if (!audioCtx) audioCtx = new Ctor();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    const ctx = audioCtx;
    const playNote = (freq: number, startAt: number, duration: number, peak: number, type: OscillatorType = 'triangle') => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      const t0 = ctx.currentTime + startAt;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + duration + 0.02);
    };
    playNote(1318.5, 0.00, 0.18, 0.22);
    playNote(1760.0, 0.09, 0.35, 0.22);
    playNote(2637.0, 0.09, 0.35, 0.10, 'sine');
  } catch {
    // Audio is a nice-to-have; never let it break the notification path.
  }
}

export function fireNativeNotification(
  title: string,
  body: string,
  linkPath?: string,
) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body,
      icon: '/favicon.ico',
      tag: 'matjar-notification',
      requireInteraction: false,
      data: linkPath ? { linkPath } : undefined,
    });
    n.onclick = () => {
      try {
        window.focus();
      } catch {
        /* noop */
      }
      if (linkPath) {
        window.location.href = linkPath;
      }
      n.close();
    };
  } catch (err) {
    console.warn('[notifications] native Notification failed:', err);
  }
}
