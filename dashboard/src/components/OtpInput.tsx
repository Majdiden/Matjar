import React, { useRef, useEffect, useCallback } from 'react';

/**
 * Segmented one-time-code input: N single-character boxes with auto-advance,
 * backspace-to-previous, full-value paste, and numeric mobile keypad.
 *
 * Auto-submit: when every box is filled the component fires `onComplete(code)`
 * so the caller never needs a separate "verify" button press (though one can
 * still be kept as a fallback — `onComplete` is idempotent-safe on the caller).
 *
 * RTL: the boxes are laid out in normal document flow, so the first digit sits
 * at the logical START of the line (right edge under `dir="rtl"`, left under
 * LTR) and they fill start→end. Each box is `dir="ltr"` internally so a single
 * digit's caret behaviour is stable regardless of page direction. Spacing uses
 * logical `gap` (direction-agnostic).
 */
export interface OtpInputProps {
  /** Number of boxes / expected code length. */
  length?: number;
  /** Controlled value — the concatenated digits entered so far. */
  value: string;
  /** Called with the new concatenated value on every edit. */
  onChange: (value: string) => void;
  /** Fired once when all `length` boxes are filled (auto-submit). */
  onComplete?: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Applies error styling to every box. */
  hasError?: boolean;
  /** aria-label for the group. */
  ariaLabel?: string;
  /** id prefix for the boxes (label `htmlFor` should point at `${id}-0`). */
  id?: string;
}

export const OtpInput: React.FC<OtpInputProps> = ({
  length = 4,
  value,
  onChange,
  onComplete,
  disabled = false,
  autoFocus = false,
  hasError = false,
  ariaLabel,
  id = 'otp',
}) => {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  // Guard so the auto-submit only fires once per fully-entered code, not on
  // every re-render while the code stays complete.
  const completedRef = useRef(false);

  const digits = value.split('').slice(0, length);
  while (digits.length < length) digits.push('');

  const focusBox = useCallback((i: number) => {
    const el = inputsRef.current[i];
    if (el) {
      el.focus();
      el.select();
    }
  }, []);

  useEffect(() => {
    if (autoFocus) focusBox(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus]);

  // Fire onComplete exactly once when the value reaches full length.
  useEffect(() => {
    const full = value.length === length && /^\d+$/.test(value);
    if (full && !completedRef.current) {
      completedRef.current = true;
      onComplete?.(value);
    } else if (!full) {
      completedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, length]);

  const setDigit = (index: number, digit: string) => {
    const next = digits.slice();
    next[index] = digit;
    onChange(next.join('').slice(0, length));
  };

  const handleChange = (index: number, raw: string) => {
    const only = raw.replace(/\D/g, '');
    if (!only) {
      setDigit(index, '');
      return;
    }
    // If the user typed/pasted multiple chars into one box, distribute them
    // across this and the following boxes.
    if (only.length > 1) {
      const next = digits.slice();
      let cursor = index;
      for (const ch of only.split('')) {
        if (cursor >= length) break;
        next[cursor] = ch;
        cursor += 1;
      }
      onChange(next.join('').slice(0, length));
      focusBox(Math.min(cursor, length - 1));
      return;
    }
    setDigit(index, only);
    if (index < length - 1) focusBox(index + 1);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        // Clear current box first.
        setDigit(index, '');
      } else if (index > 0) {
        // Already empty — step back and clear the previous box.
        setDigit(index - 1, '');
        focusBox(index - 1);
      }
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      focusBox(index - 1);
      e.preventDefault();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      focusBox(index + 1);
      e.preventDefault();
    }
  };

  const handlePaste = (index: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '');
    if (!pasted) return;
    const next = digits.slice();
    let cursor = index;
    for (const ch of pasted.split('')) {
      if (cursor >= length) break;
      next[cursor] = ch;
      cursor += 1;
    }
    onChange(next.join('').slice(0, length));
    focusBox(Math.min(cursor, length - 1));
  };

  return (
    <div
      className="flex items-center gap-2 sm:gap-3"
      role="group"
      aria-label={ariaLabel}
    >
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputsRef.current[i] = el; }}
          id={`${id}-${i}`}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          pattern="[0-9]*"
          maxLength={1}
          dir="ltr"
          disabled={disabled}
          value={digits[i]}
          aria-invalid={hasError}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={(e) => handlePaste(i, e)}
          onFocus={(e) => e.target.select()}
          className={[
            'h-14 w-12 sm:w-14 rounded-xl border-2 bg-background text-center text-2xl font-semibold font-mono',
            'outline-none transition-colors',
            'focus:border-primary focus:ring-2 focus:ring-primary/20',
            hasError ? 'border-destructive text-destructive' : 'border-input',
            disabled ? 'opacity-50 cursor-not-allowed' : '',
          ].join(' ')}
        />
      ))}
    </div>
  );
};

export default OtpInput;
