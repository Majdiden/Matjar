import { Fragment, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, Check, Store } from 'lucide-react';
import { api } from '../lib/api-client';
import { useAuth } from '../contexts/auth-context';

type Phase = 'setup' | 'ready';

type StepKey = 'domain_registration' | 'theme_installation' | 'data_seeding' | 'finalization';
type StepState = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';

const STEP_ORDER: StepKey[] = [
  'domain_registration',
  'theme_installation',
  'data_seeding',
  'finalization',
];

const COUNTDOWN_FROM = 5;
// Pacing constants — every animation gets a minimum on-screen time so a
// fast backend can't make the setup blink past, but the step swap itself
// is driven by real backend state (a slow step keeps its spinner).
const TITLE_INTRO_MS = 2000;         // Title letter cascade + breath before first step
const STEP_MIN_DISPLAY_MS = 1200;    // Each step stays at least this long even if backend finishes it instantly
const POST_LAST_STEP_HOLD_MS = 1600; // After the last step lands, before exit
const STACK_OUT_MS = 600;            // Setup list slide-down-out animation
const READY_INTRO_MS = 2000;         // Ready title cascade + breath
const READY_HOLD_MS = 1600;          // "Your store is ready" sits before counting

const AnimatedTitle: React.FC<{ text: string; perLetter?: number; className?: string }> = ({
  text,
  perLetter = 55,
  className = '',
}) => {
  // Arabic ligatures are shaped by the browser across adjacent characters in
  // the same text node \u2014 wrapping each glyph in its own inline-block <span>
  // forces every letter into isolated form and breaks the connection. Detect
  // Arabic and fall back to per-word animation so each word stays intact;
  // English continues to cascade letter-by-letter.
  const hasArabic = /[\u0600-\u06FF]/.test(text);
  const titleClass = `font-bold leading-[1.02] whitespace-nowrap text-[clamp(1.75rem,6vw,5rem)] px-4 ${
    hasArabic ? '' : 'tracking-tight'
  } ${className}`;

  if (hasArabic) {
    const words = text.split(' ');
    return (
      <h1 className={titleClass}>
        {words.map((word, i) => (
          <Fragment key={i}>
            {i > 0 && <span className="onb-letter-space" />}
            <span
              className="onb-letter"
              style={{ animationDelay: `${i * perLetter * 4}ms` }}
            >
              {word}
            </span>
          </Fragment>
        ))}
      </h1>
    );
  }

  const letters = text.split('');
  return (
    <h1 className={titleClass}>
      {letters.map((ch, i) => (
        <span
          key={i}
          className={`onb-letter${ch === ' ' ? ' onb-letter-space' : ''}`}
          style={{ animationDelay: `${i * perLetter}ms` }}
        >
          {ch === ' ' ? '\u00A0' : ch}
        </span>
      ))}
    </h1>
  );
};

export default function SetupInProgress() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useTranslation(['errors']);

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [setupToken, setSetupToken] = useState<string | null>(null);
  const [steps, setSteps] = useState<Record<StepKey, StepState>>({
    domain_registration: 'pending',
    theme_installation: 'pending',
    data_seeding: 'pending',
    finalization: 'pending',
  });
  const [phase, setPhase] = useState<Phase>('setup');
  const [setupExiting, setSetupExiting] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_FROM);
  const [countdownStarted, setCountdownStarted] = useState(false);
  const [readyExiting, setReadyExiting] = useState(false);
  // Paced reveal counter — independent of how fast the backend streams
  // step updates. We tick this up on a wall-clock so every step gets the
  // full slide-in animation even when the whole setup completes in one poll.
  const [revealedCount, setRevealedCount] = useState(0);
  const mountedAtRef = useRef<number>(Date.now());
  const currentShownAtRef = useRef<number>(Date.now());
  const loginStartedRef = useRef(false);

  // Rehydrate tenant + token from the query string / session
  useEffect(() => {
    const id = searchParams.get('tenantId');
    const token = sessionStorage.getItem('setupToken');
    if (!id || !token) {
      navigate('/login');
      return;
    }
    setTenantId(id);
    setSetupToken(token);
  }, [searchParams, navigate]);

  // Auto-login is deferred until the countdown actually finishes — the
  // login() call can do a cross-host `window.location.href` swap for
  // subdomain-bound tenants, which would otherwise yank the user out of
  // this page before any of the animations play.
  const doLoginAndNavigate = async () => {
    if (loginStartedRef.current) return;
    loginStartedRef.current = true;
    try {
      const email = sessionStorage.getItem('setupEmail');
      const password = sessionStorage.getItem('setupPassword');
      const id = tenantId || searchParams.get('tenantId') || undefined;
      if (!email || !password) {
        navigate('/login');
        return;
      }
      sessionStorage.removeItem('setupEmail');
      sessionStorage.removeItem('setupPassword');
      sessionStorage.removeItem('setupDomain');
      sessionStorage.removeItem('setupToken');
      await login({ email, password, tenantId: id });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error('Auto-login failed:', err);
      navigate('/login');
    }
  };

  // Poll setup status
  useEffect(() => {
    if (!tenantId || !setupToken) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    interface SetupStatusBody {
      status?: string;
      steps?: Partial<Record<StepKey, { status?: StepState }>>;
    }

    const tick = async () => {
      try {
        const res = (await api.storeSetup.getStatus(tenantId, setupToken)) as {
          responseObject?: SetupStatusBody;
        };
        if (cancelled) return;
        const body = res?.responseObject;
        if (body?.steps) {
          setSteps((prev) => {
            const next = { ...prev };
            STEP_ORDER.forEach((k) => {
              const s = body.steps?.[k]?.status;
              if (s) next[k] = s;
            });
            return next;
          });
        }
        if (body?.status === 'completed') {
          setSteps((prev) => {
            const next = { ...prev } as Record<StepKey, StepState>;
            STEP_ORDER.forEach((k) => {
              if (next[k] !== 'completed' && next[k] !== 'skipped' && next[k] !== 'failed') {
                next[k] = 'completed';
              }
            });
            return next;
          });
          api.storeSetup.clearStatus(tenantId, setupToken).catch(() => {});
          return; // stop polling
        }
      } catch {
        // swallow — retry on next tick
      }
      if (!cancelled) timer = setTimeout(tick, 1200);
    };

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [tenantId, setupToken]);

  // Step progression is driven by real backend state with a per-step
  // minimum display time. We advance the current index only when:
  //   (a) the title intro has finished (for the first reveal), and
  //   (b) the current step has been on screen at least STEP_MIN_DISPLAY_MS, and
  //   (c) the current step is terminal (completed/skipped/failed), and
  //   (d) the next step has actually started on the backend (or the whole
  //       setup reported `completed`, in which case we sweep remaining rows).
  useEffect(() => {
    if (phase !== 'setup') return;
    if (revealedCount === 0) {
      // First reveal — wait for title intro, then show the first step regardless
      // of whether it has started (it'll sit on the spinner until the backend moves).
      const sinceMount = Date.now() - mountedAtRef.current;
      const wait = Math.max(0, TITLE_INTRO_MS - sinceMount);
      const t = setTimeout(() => {
        setRevealedCount(1);
        currentShownAtRef.current = Date.now();
      }, wait);
      return () => clearTimeout(t);
    }

    if (revealedCount >= STEP_ORDER.length) return;

    const currentKey = STEP_ORDER[revealedCount - 1];
    const currentState = steps[currentKey];
    const currentTerminal =
      currentState === 'completed' || currentState === 'skipped' || currentState === 'failed';
    if (!currentTerminal) return; // Keep the spinner — backend hasn't finished this step

    const nextKey = STEP_ORDER[revealedCount];
    const nextStarted = steps[nextKey] !== 'pending';
    if (!nextStarted) return; // Wait for the next step to actually begin

    const shownFor = Date.now() - currentShownAtRef.current;
    const wait = Math.max(0, STEP_MIN_DISPLAY_MS - shownFor);
    const timer = setTimeout(() => {
      setRevealedCount((c) => Math.min(c + 1, STEP_ORDER.length));
      currentShownAtRef.current = Date.now();
    }, wait);
    return () => clearTimeout(timer);
  }, [steps, revealedCount, phase]);

  // Exit: every step terminal on the backend, every row revealed, AND the
  // last row has been on screen long enough to read.
  useEffect(() => {
    if (phase !== 'setup') return;
    const allDone = STEP_ORDER.every(
      (k) => steps[k] === 'completed' || steps[k] === 'skipped' || steps[k] === 'failed'
    );
    if (!allDone) return;
    if (revealedCount < STEP_ORDER.length) return;
    const shownFor = Date.now() - currentShownAtRef.current;
    const holdLeft = Math.max(STEP_MIN_DISPLAY_MS, POST_LAST_STEP_HOLD_MS) - shownFor;
    const holdWait = Math.max(0, holdLeft);
    const outDelay = setTimeout(() => setSetupExiting(true), holdWait);
    const flip = setTimeout(() => setPhase('ready'), holdWait + STACK_OUT_MS);
    return () => {
      clearTimeout(outDelay);
      clearTimeout(flip);
    };
  }, [steps, phase, revealedCount]);

  // Countdown + navigate after the "ready" screen's title has finished
  // its letter cascade and held for a beat.
  useEffect(() => {
    if (phase !== 'ready') return;
    setCountdown(COUNTDOWN_FROM);
    setCountdownStarted(false);
    let n = COUNTDOWN_FROM;
    let interval: ReturnType<typeof setInterval> | null = null;
    const hold = setTimeout(() => {
      setCountdownStarted(true);
      interval = setInterval(() => {
        n -= 1;
        if (n <= 0) {
          if (interval) clearInterval(interval);
          // Blur-out animation first so the navigation doesn't feel
          // like a hard cut — login + navigate fire after the fade.
          setReadyExiting(true);
          setTimeout(() => {
            doLoginAndNavigate();
          }, 650);
        } else {
          setCountdown(n);
        }
      }, 1000);
    }, READY_INTRO_MS + READY_HOLD_MS);
    return () => {
      clearTimeout(hold);
      if (interval) clearInterval(interval);
    };
    // `doLoginAndNavigate` reads tenantId/login/navigate from closure and
    // is guarded by loginStartedRef so it's safe to omit — adding it would
    // reset the countdown on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, navigate]);

  const keyframes = (
    <style>{`
      @keyframes onboardLetterIn {
        0% { opacity: 0; filter: blur(14px); transform: translateY(10px); }
        100% { opacity: 1; filter: blur(0); transform: translateY(0); }
      }
      @keyframes onboardStepIn {
        0% { opacity: 0; transform: translateY(18px); filter: blur(4px); }
        100% { opacity: 1; transform: translateY(0); filter: blur(0); }
      }
      @keyframes onboardStepOut {
        0% { opacity: 1; transform: translateY(0); filter: blur(0); }
        100% { opacity: 0; transform: translateY(-18px); filter: blur(4px); }
      }
      @keyframes onboardStackOut {
        0% { opacity: 1; transform: translateY(0); filter: blur(0); }
        100% { opacity: 0; transform: translateY(22px); filter: blur(6px); }
      }
      @keyframes onboardReadyOut {
        0% { opacity: 1; transform: scale(1); filter: blur(0); }
        100% { opacity: 0; transform: scale(0.98); filter: blur(14px); }
      }
      @keyframes onboardFadeIn {
        0% { opacity: 0; transform: translateY(8px); }
        100% { opacity: 1; transform: translateY(0); }
      }
      @keyframes onboardCheckPop {
        0% { opacity: 0; transform: scale(0.5); }
        60% { opacity: 1; transform: scale(1.12); }
        100% { opacity: 1; transform: scale(1); }
      }
      @keyframes onboardTick {
        0% { opacity: 0; transform: scale(0.6); filter: blur(8px); }
        25% { opacity: 1; transform: scale(1.1); filter: blur(0); }
        100% { opacity: 0; transform: scale(0.9); filter: blur(4px); }
      }
      .onb-letter { display: inline-block; opacity: 0; animation: onboardLetterIn 700ms cubic-bezier(.2,.7,.2,1) forwards; }
      .onb-letter-space { width: 0.28em; }
      .onb-step-row { opacity: 0; animation: onboardStepIn 520ms cubic-bezier(.2,.7,.2,1) forwards; }
      .onb-step-row-out { animation: onboardStepOut 420ms cubic-bezier(.4,0,.2,1) forwards; }
      .onb-stack-out { animation: onboardStackOut 550ms cubic-bezier(.4,0,.2,1) forwards; }
      .onb-ready-out { animation: onboardReadyOut 650ms cubic-bezier(.4,0,.2,1) forwards; }
      .onb-fade { opacity: 0; animation: onboardFadeIn 700ms cubic-bezier(.2,.7,.2,1) forwards; }
      .onb-check-pop { animation: onboardCheckPop 700ms cubic-bezier(.2,.9,.3,1.2) forwards; }
      .onb-tick { animation: onboardTick 1s ease-in-out forwards; }
    `}</style>
  );

  if (!tenantId || !setupToken) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Only the current step is on screen — the list replaces itself as
  // progress advances, rather than stacking rows.
  const currentKey: StepKey | null =
    revealedCount > 0 ? STEP_ORDER[Math.min(revealedCount - 1, STEP_ORDER.length - 1)] : null;

  const header = (
    <header className="border-b">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-2">
        <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center">
          <Store className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="font-semibold tracking-tight">Matjar</span>
      </div>
    </header>
  );

  const setupScreen = (
    <div
      className={`w-full max-w-3xl mx-auto px-6 flex flex-col items-center text-center py-12 ${
        setupExiting ? 'onb-stack-out' : ''
      }`}
    >
      <AnimatedTitle text={t('errors:setup.setting_up_title')} />
      <p className="onb-fade mt-4 text-lg text-muted-foreground max-w-xl" style={{ animationDelay: '1100ms' }}>
        {t('errors:setup.setup_waiting')}
      </p>

      <div className="mt-8 w-full max-w-lg h-14 relative">
        {currentKey && (() => {
          const state = steps[currentKey];
          const isDone = state === 'completed' || state === 'skipped';
          const isFailed = state === 'failed';
          const isActive = state === 'in_progress';
          return (
            <div
              key={currentKey}
              className="onb-step-row absolute inset-0 flex items-center justify-center gap-4 text-base"
            >
              <span className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 border">
                {isDone && <Check className="h-4 w-4 text-green-600" />}
                {isActive && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                {isFailed && <span className="text-red-600 text-sm">!</span>}
              </span>
              <span
                className={`${
                  isDone
                    ? 'text-foreground'
                    : isActive
                    ? 'text-foreground font-medium'
                    : isFailed
                    ? 'text-red-600'
                    : 'text-muted-foreground'
                }`}
              >
                {t(`errors:setup.step.${currentKey}_label`)}
              </span>
            </div>
          );
        })()}
      </div>
    </div>
  );

  const readyScreen = (
    // Title is the true vertical center — the check floats above and the
    // countdown slot floats below, both absolutely positioned so they
    // can't push the title off center.
    <div className="relative w-full flex items-center justify-center text-center px-6 py-12">
      <div className="absolute bottom-full mb-2 start-1/2 -translate-x-1/2">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-600 onb-check-pop">
          <Check className="h-10 w-10" />
        </div>
      </div>
      <AnimatedTitle text={t('errors:setup.store_ready')} />
      <div className="absolute top-full mt-1 start-1/2 -translate-x-1/2 h-8 flex items-center justify-center whitespace-nowrap">
        {countdownStarted && (
          <p className="onb-fade text-lg text-muted-foreground">
            {t('errors:setup.redirecting_in')}{' '}
            <span
              key={countdown}
              className="inline-block min-w-[1ch] font-semibold text-foreground onb-tick"
            >
              {countdown}
            </span>
            …
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen bg-background flex flex-col ${readyExiting ? 'onb-ready-out' : ''}`}>
      {keyframes}
      {header}
      <main className="flex-1 flex items-center justify-center">
        {phase === 'setup' ? setupScreen : readyScreen}
      </main>
    </div>
  );
}
