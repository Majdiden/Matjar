import React from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import type { DomainRegistryRow } from '../types';

// =============================================================================
// Setup progress stepper shown on a custom-domain card while the domain
// is moving through the healthy provisioning lifecycle.
// =============================================================================

// Healthy lifecycle steps the merchant sees during provisioning.
const SETUP_STEP_KEYS = [
  { key: 'pending_dns', labelKey: 'domains:setup_steps.verify_ownership' },
  { key: 'ownership_verified', labelKey: 'domains:setup_steps.check_routing' },
  { key: 'dns_verified', labelKey: 'domains:setup_steps.issue_cert' },
  { key: 'active', labelKey: 'domains:setup_steps.live' },
] as const;

export function stepIndex(status: DomainRegistryRow['status']): number {
  switch (status) {
    case 'pending_dns':
      return 0;
    case 'ownership_verified':
      return 1;
    case 'dns_verified':
    case 'provisioning_ssl':
      return 2;
    case 'active':
      return 3;
    default:
      return -1;
  }
}

export function SetupProgress({
  currentStatus,
  t,
}: {
  currentStatus: DomainRegistryRow['status'];
  t: (key: string) => string;
}) {
  const currentIdx = stepIndex(currentStatus);
  return (
    <div className="pt-1">
      <div className="flex items-center">
        {SETUP_STEP_KEYS.map((step, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <React.Fragment key={step.key}>
              <div className="flex flex-col items-center gap-1.5 min-w-0">
                <div
                  className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold border-2 ${
                    done
                      ? 'bg-green-500 border-green-500 text-white'
                      : active
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'bg-muted border-muted-foreground/20 text-muted-foreground'
                  }`}
                >
                  {done ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : active ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={`text-[10px] text-center whitespace-nowrap ${
                    done || active ? 'font-medium' : 'text-muted-foreground'
                  }`}
                >
                  {t(step.labelKey)}
                </span>
              </div>
              {i < SETUP_STEP_KEYS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-1 -mt-4 rounded ${
                    done ? 'bg-green-500' : 'bg-muted-foreground/20'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
