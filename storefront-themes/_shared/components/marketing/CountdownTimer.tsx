import React, { useState, useEffect } from 'react';
import { cn } from '../../utils/cn';
import { useThemeSlot } from '../../theme/ThemeSlotsProvider';

export const SLOT_KEY = 'countdownTimer';

interface CountdownTimerProps {
  /** Target date/time (ISO string or Date) */
  endDate: string | Date;
  /** Label shown above the timer */
  label?: string;
  className?: string;
  /** Style variant */
  variant?: 'boxes' | 'inline' | 'minimal';
  onExpired?: () => void;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

function calcTimeLeft(endDate: Date): TimeLeft {
  const diff = endDate.getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    expired: false,
  };
}

export function CountdownTimer(props: CountdownTimerProps) {
  const Override = useThemeSlot<React.ComponentType<CountdownTimerProps>>(SLOT_KEY);
  if (Override) return <Override {...props} />;
  const {
    endDate,
    label,
    className,
    variant = 'boxes',
    onExpired,
  } = props;
  const target = typeof endDate === 'string' ? new Date(endDate) : endDate;
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(calcTimeLeft(target));

  useEffect(() => {
    const interval = setInterval(() => {
      const tl = calcTimeLeft(target);
      setTimeLeft(tl);
      if (tl.expired) {
        clearInterval(interval);
        onExpired?.();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [target, onExpired]);

  if (timeLeft.expired) {
    return <span className={cn('text-sm text-gray-500', className)}>Sale ended</span>;
  }

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (variant === 'minimal') {
    return (
      <span className={cn('font-mono text-sm font-medium', className)}>
        {label && <span className="mr-1">{label}</span>}
        {timeLeft.days > 0 && `${timeLeft.days}d `}
        {pad(timeLeft.hours)}:{pad(timeLeft.minutes)}:{pad(timeLeft.seconds)}
      </span>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={cn('flex items-center gap-1 text-sm', className)}>
        {label && <span className="font-medium mr-2">{label}</span>}
        <span className="font-mono font-bold">{timeLeft.days}d</span>
        <span className="text-gray-400">:</span>
        <span className="font-mono font-bold">{pad(timeLeft.hours)}h</span>
        <span className="text-gray-400">:</span>
        <span className="font-mono font-bold">{pad(timeLeft.minutes)}m</span>
        <span className="text-gray-400">:</span>
        <span className="font-mono font-bold">{pad(timeLeft.seconds)}s</span>
      </div>
    );
  }

  // boxes variant
  const units = [
    { label: 'Days', value: timeLeft.days },
    { label: 'Hours', value: timeLeft.hours },
    { label: 'Minutes', value: timeLeft.minutes },
    { label: 'Seconds', value: timeLeft.seconds },
  ];

  return (
    <div className={cn('text-center', className)}>
      {label && <p className="text-sm font-medium mb-3">{label}</p>}
      <div className="flex items-center justify-center gap-3">
        {units.map((unit, i) => (
          <React.Fragment key={unit.label}>
            {i > 0 && <span className="text-2xl font-bold text-gray-300">:</span>}
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 flex items-center justify-center bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-2xl font-bold font-mono">
                {pad(unit.value)}
              </div>
              <span className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">{unit.label}</span>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
