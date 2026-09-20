import { Button } from '../../components/ui/Button';
import { Copy } from 'lucide-react';
import { useToast } from '../../components/ui/toast-context';

/** One-time display of freshly generated recovery codes. */
export const RecoveryCodes: React.FC<{ codes: string[] }> = ({ codes }) => {
  const toast = useToast();
  const copy = () => {
    navigator.clipboard?.writeText(codes.join('\n')).then(
      () => toast.success('Recovery codes copied'),
      () => toast.error('Copy failed — write them down'),
    );
  };
  return (
    <div className="space-y-3 rounded-md border border-amber-500/40 bg-amber-50 p-3 text-sm text-amber-900">
      <p className="font-medium">Save these recovery codes now. They are shown only once.</p>
      <p className="text-xs">Each code signs you in once if you lose your authenticator. Keep them somewhere safe and offline.</p>
      <ul className="grid grid-cols-2 gap-1 font-mono text-sm" dir="ltr">
        {codes.map((c) => (
          <li key={c} className="rounded bg-white/70 px-2 py-1 text-center">{c}</li>
        ))}
      </ul>
      <Button variant="outline" size="sm" onClick={copy}>
        <Copy className="h-3.5 w-3.5" /> Copy all
      </Button>
    </div>
  );
};
