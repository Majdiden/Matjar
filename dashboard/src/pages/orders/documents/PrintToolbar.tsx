import React from 'react';
import { useTranslation } from 'react-i18next';
import { Printer } from 'lucide-react';

/**
 * On-screen print bar for the printable order documents. The documents
 * auto-trigger `window.print()` on load, but if the operator dismisses
 * the dialog they need a way back in without reloading — hence a visible
 * button. Hidden on the printed page itself via `@media print` so it
 * never appears on paper. RTL is handled by the shared print.css.
 */
const PrintToolbar: React.FC = () => {
  const { t } = useTranslation(['common']);
  return (
    <div className="doc-toolbar">
      <button type="button" className="doc-print-btn" onClick={() => window.print()}>
        <Printer size={16} />
        {t('common:action.print')}
      </button>
    </div>
  );
};

export default PrintToolbar;
