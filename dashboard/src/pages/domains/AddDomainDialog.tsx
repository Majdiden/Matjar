import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Loader2,
  ArrowRight,
  ArrowLeft,
  Copy,
  CheckCircle2,
  AlertCircle,
  Globe,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api-client';

type Step = 'input' | 'verify' | 'done';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

interface PendingRecord {
  type: string;
  name: string;
  value: string;
  purpose: string;
}

interface DnsRecordRaw {
  type?: string;
  name?: string;
  value?: string;
  purpose?: string;
}

interface AddDomainPayload {
  verificationInstructions?: {
    instructions?: {
      record?: DnsRecordRaw;
      records?: DnsRecordRaw[];
    };
  };
  instructions?: {
    record?: DnsRecordRaw;
    records?: DnsRecordRaw[];
  };
}

interface InstructionsPayload {
  instructions?: { records?: DnsRecordRaw[] };
  records?: DnsRecordRaw[];
}

interface VerifyResponse {
  verified?: boolean;
  message?: string;
  data?: { verified?: boolean; message?: string };
}

const errMsg = (err: unknown, fallback: string): string => {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  if (typeof err === 'string') return err;
  return fallback;
};

export function AddDomainDialog({ open, onOpenChange, onComplete }: Props) {
  const { t } = useTranslation(['domains', 'common']);
  const [step, setStep] = useState<Step>('input');
  const [hostname, setHostname] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [records, setRecords] = useState<PendingRecord[]>([]);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStep('input');
      setHostname('');
      setSubmitting(false);
      setVerifying(false);
      setRecords([]);
      setVerifyError(null);
    }
  }, [open]);

  const normalized = useMemo(
    () => hostname.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, ''),
    [hostname]
  );

  const isValidLookingHostname = useMemo(() => {
    if (!normalized) return false;
    return /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i.test(normalized);
  }, [normalized]);

  const detectedKind = useMemo<'custom_apex' | 'custom_subdomain' | null>(() => {
    if (!isValidLookingHostname) return null;
    const labels = normalized.split('.');
    return labels.length <= 2 ? 'custom_apex' : 'custom_subdomain';
  }, [normalized, isValidLookingHostname]);

  const submitAdd = async () => {
    if (!isValidLookingHostname) {
      toast.error(t('domains:add.field.hostname.hint'));
      return;
    }
    try {
      setSubmitting(true);
      const response = await api.domains.addCustomDomain(normalized, 'dns') as {
        data?: AddDomainPayload;
        responseObject?: AddDomainPayload;
      } & AddDomainPayload;
      const payload: AddDomainPayload = response?.data || response?.responseObject || response;

      const instructions =
        payload?.verificationInstructions?.instructions ||
        payload?.instructions;

      const rec = instructions?.record;
      const recList = instructions?.records;

      const purposeFor = (r: DnsRecordRaw): string => {
        if (r?.purpose && typeof r.purpose === 'string') return r.purpose;
        if (r?.type === 'TXT') return t('domains:dns.purpose_ownership');
        return t('domains:dns.purpose_routing');
      };

      const built: PendingRecord[] = [];
      if (recList && Array.isArray(recList)) {
        for (const r of recList) {
          built.push({
            type: r.type || '',
            name: r.name || '',
            value: r.value || '',
            purpose: purposeFor(r),
          });
        }
      } else if (rec) {
        built.push({
          type: rec.type || '',
          name: rec.name || '',
          value: rec.value || '',
          purpose: purposeFor(rec),
        });
      }

      try {
        const instrResp = await api.domains.getVerificationInstructions() as {
          data?: InstructionsPayload;
          responseObject?: InstructionsPayload;
        } & InstructionsPayload;
        const instrPayload: InstructionsPayload = instrResp?.data || instrResp?.responseObject || instrResp;
        const extra =
          instrPayload?.instructions?.records || instrPayload?.records;
        if (Array.isArray(extra)) {
          for (const r of extra) {
            if (!built.find((b) => b.type === r.type && b.name === r.name)) {
              built.push({
                type: r.type || '',
                name: r.name || '',
                value: r.value || '',
                purpose: purposeFor(r),
              });
            }
          }
        }
      } catch {
        /* non-critical */
      }

      setRecords(built);
      setStep('verify');
      toast.success(t('domains:add.toast.added'));
    } catch (err) {
      toast.error(errMsg(err, t('domains:add.toast.error_add')));
    } finally {
      setSubmitting(false);
    }
  };

  const submitVerify = async () => {
    try {
      setVerifying(true);
      setVerifyError(null);
      const response = await api.domains.verifyCustomDomain() as VerifyResponse;
      const verified = response?.verified ?? response?.data?.verified;
      if (verified) {
        setStep('done');
        toast.success(t('domains:add.toast.verified'));
        onComplete();
      } else {
        setVerifyError(response?.message || t('domains:add.propagation_hint_1'));
      }
    } catch (err) {
      setVerifyError(errMsg(err, t('domains:add.toast.error_verify')));
    } finally {
      setVerifying(false);
    }
  };

  const copy = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {step === 'input' && t('domains:add.title_input')}
            {step === 'verify' && t('domains:add.title_verify')}
            {step === 'done' && t('domains:add.title_done')}
          </DialogTitle>
          <DialogDescription>
            {step === 'input' && t('domains:add.description_input')}
            {step === 'verify' && t('domains:add.description_verify')}
            {step === 'done' && t('domains:add.description_done')}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 py-2">
          <StepDot active={step === 'input'} done={step !== 'input'} label={t('domains:add.step.domain')} index={1} />
          <div className="flex-1 h-0.5 bg-muted-foreground/15 rounded" />
          <StepDot
            active={step === 'verify'}
            done={step === 'done'}
            label={t('domains:add.step.verify')}
            index={2}
          />
          <div className="flex-1 h-0.5 bg-muted-foreground/15 rounded" />
          <StepDot active={false} done={step === 'done'} label={t('domains:add.step.connected')} index={3} />
        </div>

        {/* ---- Step 1: input ---- */}
        {step === 'input' && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="domain-hostname">{t('domains:add.field.hostname.label')}</Label>
              <Input
                id="domain-hostname"
                placeholder={t('domains:add.field.hostname.placeholder')}
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                {t('domains:add.field.hostname.hint')}
              </p>
            </div>

            {isValidLookingHostname && detectedKind && (
              <div className="flex items-center justify-between p-3 rounded-md bg-muted/30 border">
                <div className="flex items-center gap-2 min-w-0">
                  <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-mono text-sm truncate">{normalized}</span>
                </div>
                <Badge variant="outline" className="text-xs shrink-0">
                  {detectedKind === 'custom_apex' ? t('domains:add.kind.apex') : t('domains:add.kind.subdomain')}
                </Badge>
              </div>
            )}
          </div>
        )}

        {/* ---- Step 2: verify ---- */}
        {step === 'verify' && (
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-md bg-muted/30 border">
              <p className="text-xs text-muted-foreground mb-1">{t('domains:add.field.hostname.label')}</p>
              <p className="font-mono text-sm">{normalized}</p>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">{t('domains:add.dns_records_title')}</h4>
              <div className="space-y-2">
                {records.map((rec, i) => (
                  <div key={i} className="border rounded-md p-3 space-y-2 bg-background">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="font-mono">{rec.type}</Badge>
                      <span className="text-xs text-muted-foreground">{rec.purpose}</span>
                    </div>
                    <div className="grid gap-1.5 text-xs">
                      <RecordRow label={t('domains:dns.field.name')} value={rec.name} onCopy={(v) => copy(v, t('domains:dns.field.name'))} />
                      <RecordRow label={t('domains:dns.field.value')} value={rec.value} onCopy={(v) => copy(v, t('domains:dns.field.value'))} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>{t('domains:add.propagation_hint_1')}</p>
              <p>{t('domains:add.propagation_hint_2')}</p>
            </div>

            {verifyError && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900">
                <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
                <p className="text-xs text-yellow-800 dark:text-yellow-200">{verifyError}</p>
              </div>
            )}
          </div>
        )}

        {/* ---- Step 3: done ---- */}
        {step === 'done' && (
          <div className="space-y-3 py-6 text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="font-medium">{t('domains:add.verified_message', { hostname: normalized })}</p>
              <p className="text-xs text-muted-foreground">
                {t('domains:add.ssl_progress')}
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 'input' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('common:action.cancel')}
              </Button>
              <Button
                onClick={submitAdd}
                disabled={!isValidLookingHostname || submitting}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 me-2 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4 me-2 rtl:rotate-180" />
                )}
                {t('domains:add.action.continue')}
              </Button>
            </>
          )}
          {step === 'verify' && (
            <>
              <Button variant="outline" onClick={() => setStep('input')}>
                <ArrowLeft className="h-4 w-4 me-2 rtl:rotate-180" />
                {t('domains:add.action.back')}
              </Button>
              <Button onClick={submitVerify} disabled={verifying}>
                {verifying ? (
                  <Loader2 className="h-4 w-4 me-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 me-2" />
                )}
                {t('domains:add.action.verify')}
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button onClick={() => onOpenChange(false)}>{t('domains:add.action.close')}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecordRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground w-12 shrink-0">{label}</span>
      <div className="flex items-center gap-1 min-w-0">
        <span className="font-mono truncate">{value}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0"
          onClick={() => onCopy(value)}
        >
          <Copy className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function StepDot({
  active,
  done,
  label,
  index,
}: {
  active: boolean;
  done: boolean;
  label: string;
  index: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium border-2 ${
          done
            ? 'bg-green-500 border-green-500 text-white'
            : active
              ? 'bg-primary border-primary text-primary-foreground'
              : 'bg-muted border-muted-foreground/20 text-muted-foreground'
        }`}
      >
        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : index}
      </div>
      <span className={`text-xs ${active || done ? 'font-medium' : 'text-muted-foreground'}`}>
        {label}
      </span>
    </div>
  );
}
