import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';

interface SetupStep {
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';
  timestamp?: string;
  domain?: string;
  theme?: { name?: string } | null;
  categories?: number;
  products?: number;
  reason?: string;
  error?: string;
}

interface SetupStatusResponse {
  success?: boolean;
  responseObject?: SetupStatus;
}

interface SetupApiError {
  statusCode?: number;
  status?: number;
  message?: string;
}

interface SetupStatus {
  found: boolean;
  tenantId?: string;
  status?: 'in_progress' | 'completed' | 'failed';
  currentStep?: string;
  steps?: {
    domain_registration?: SetupStep;
    theme_installation?: SetupStep;
    data_seeding?: SetupStep;
    finalization?: SetupStep;
  };
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

interface SetupProgressProps {
  tenantId: string;
  // One-time token returned by /auth/register. Required for both poll
  // and clear — without it the backend returns 404.
  setupToken: string;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

type StepKey = 'domain_registration' | 'theme_installation' | 'data_seeding' | 'finalization';

const STEP_KEYS: StepKey[] = ['domain_registration', 'theme_installation', 'data_seeding', 'finalization'];

export function SetupProgress({ tenantId, setupToken, onComplete, onError }: SetupProgressProps) {
  const { t } = useTranslation(['errors']);
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Wrapper lets the fetchStatus closure reach the interval handle even
    // though we only assign it once (after setInterval). Using `let` here
    // would trigger prefer-const since the closure reads are not writes.
    const pollRef: { current: ReturnType<typeof setInterval> | undefined } = { current: undefined };

    const fetchStatus = async () => {
      try {
        const response = (await api.storeSetup.getStatus(tenantId, setupToken)) as SetupStatusResponse;

        if (response.success && response.responseObject) {
          const setupStatus = response.responseObject as SetupStatus;
          setStatus(setupStatus);
          setLoading(false);

          // Check if setup is complete
          if (setupStatus.status === 'completed') {
            clearInterval(pollRef.current);
            // Clear the status from backend after a short delay
            setTimeout(async () => {
              await api.storeSetup.clearStatus(tenantId, setupToken);
              onComplete?.();
            }, 2000);
          }

          // Check if setup failed
          if (setupStatus.status === 'failed') {
            clearInterval(pollRef.current);
            const errorMsg = setupStatus.error || t('errors:setup.failed_fallback');
            setError(errorMsg);
            onError?.(errorMsg);
          }
        } else {
          // Setup status not found - might be completed already
          setLoading(false);
          clearInterval(pollRef.current);
          onComplete?.();
        }
      } catch (err) {
        const apiErr = err as SetupApiError;
        // If status endpoint returns 404, setup might be complete
        if (apiErr.statusCode === 404 || apiErr.status === 404) {
          setLoading(false);
          clearInterval(pollRef.current);
          onComplete?.();
        } else {
          setError(apiErr.message || t('errors:setup.status_fetch_failed'));
          setLoading(false);
          clearInterval(pollRef.current);
          onError?.(apiErr.message || t('errors:setup.status_fetch_failed'));
        }
      }
    };

    // Initial fetch
    fetchStatus();

    // Poll every 2 seconds
    pollRef.current = setInterval(fetchStatus, 2000);

    // Cleanup
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [tenantId, setupToken, onComplete, onError]);

  const getStepIcon = (stepStatus?: string) => {
    switch (stepStatus) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'in_progress':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'skipped':
        return <Circle className="h-5 w-5 text-gray-400" />;
      default:
        return <Circle className="h-5 w-5 text-gray-300" />;
    }
  };

  const getStepDetails = (step: SetupStep) => {
    if (step.status === 'completed') {
      const details = [];
      if (step.domain) details.push(`Domain: ${step.domain}`);
      if (step.theme?.name) details.push(`Theme: ${step.theme.name}`);
      if (step.categories) details.push(`${step.categories} categories`);
      if (step.products) details.push(`${step.products} products`);
      return details.length > 0 ? details.join(', ') : null;
    }
    if (step.status === 'skipped' && step.reason) {
      return t('errors:setup.step.skipped', { reason: step.reason });
    }
    if (step.status === 'failed' && step.error) {
      return t('errors:setup.step.failed', { error: step.error });
    }
    return null;
  };

  if (loading && !status) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>{t('errors:setup.loading')}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-red-500">{t('errors:setup.failed_title')}</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!status) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('errors:setup.setting_up_title')}</CardTitle>
        <CardDescription>
          {status.status === 'completed'
            ? t('errors:setup.store_ready')
            : status.status === 'failed'
            ? t('errors:setup.setup_error')
            : t('errors:setup.setup_waiting')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {STEP_KEYS.map((key) => {
            const step = status.steps?.[key as keyof typeof status.steps];
            const stepDetails = step ? getStepDetails(step) : null;
            const label = t(`errors:setup.step.${key}_label`);
            const desc = t(`errors:setup.step.${key}_desc`);

            return (
              <div key={key} className="flex items-start space-x-3">
                <div className="mt-0.5">{getStepIcon(step?.status)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{label}</p>
                  <p className="text-sm text-gray-500">{desc}</p>
                  {stepDetails && (
                    <p className="text-xs text-gray-400 mt-1">{stepDetails}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {status.status === 'in_progress' && (
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              {t('errors:setup.in_progress_note')}
            </p>
          </div>
        )}

        {status.status === 'completed' && (
          <div className="mt-6 text-center">
            <p className="text-sm text-green-600 font-medium">
              {t('errors:setup.completed_note')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
