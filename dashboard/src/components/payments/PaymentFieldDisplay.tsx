import React from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';

/**
 * Renders a single payment-method customer field in read-only form.
 * Text/number/email/tel/textarea/select show the submitted value. File
 * fields render a thumbnail (for images) and open a full preview modal
 * on click — images inline, PDFs in an iframe, other types offer a
 * download link. Shared by OrderDetails and the transaction detail page.
 */
export interface PaymentFieldShape {
  name?: string;
  label?: string;
  type?: string;
}

export interface PaymentFieldFileValue {
  name?: string;
  size?: number;
  data?: string;
  dataUrl?: string;
}

export type PaymentFieldValue = string | number | boolean | PaymentFieldFileValue | null | undefined;

export const PaymentFieldDisplay: React.FC<{ field: PaymentFieldShape; value: unknown }> = ({ field, value }) => {
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const label = field.label || field.name || '';
  const missing = value == null || value === '';
  const fileValue: PaymentFieldFileValue | null =
    field.type === 'file' && value && typeof value === 'object'
      ? (value as PaymentFieldFileValue)
      : null;
  const fileData: string | null = fileValue
    ? fileValue.data || fileValue.dataUrl || null
    : null;
  const isImage = typeof fileData === 'string' && fileData.startsWith('data:image/');
  const isPdf =
    typeof fileData === 'string' &&
    (fileData.startsWith('data:application/pdf') ||
      String(fileValue?.name || '').toLowerCase().endsWith('.pdf'));

  return (
    <>
      <div className="rounded-md border p-3 text-sm">
        <p className="text-xs text-muted-foreground">{label}</p>
        {missing ? (
          <p className="italic text-muted-foreground text-xs mt-0.5">Not provided</p>
        ) : field.type === 'file' && fileData ? (
          <div className="mt-1 space-y-1">
            {isImage && (
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="block focus:outline-none focus:ring-2 focus:ring-primary rounded"
              >
                <img
                  src={fileData}
                  alt={fileValue?.name}
                  className="max-h-40 rounded border cursor-zoom-in hover:opacity-90 transition"
                />
              </button>
            )}
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="text-xs text-primary underline cursor-pointer"
            >
              {fileValue?.name || 'Open attachment'}
              {fileValue?.size ? ` (${Math.round((fileValue.size || 0) / 1024)} KB)` : ''}
            </button>
          </div>
        ) : field.type === 'file' && !fileData ? (
          <p className="text-xs text-muted-foreground italic mt-0.5">
            {fileValue?.name || 'File reference'} — no inline data
          </p>
        ) : (
          <p className="font-medium break-words mt-0.5">{String(value as string | number | boolean)}</p>
        )}
      </div>

      {fileData && (
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="truncate">
                {fileValue?.name || label}
              </DialogTitle>
              <DialogDescription>{label}</DialogDescription>
            </DialogHeader>
            <div className="bg-muted/40 rounded flex items-center justify-center min-h-[300px] max-h-[70vh] overflow-auto">
              {isImage ? (
                <img
                  src={fileData}
                  alt={fileValue?.name || 'attachment'}
                  className="max-w-full max-h-[70vh] object-contain"
                />
              ) : isPdf ? (
                <iframe
                  src={fileData}
                  title={fileValue?.name || 'attachment'}
                  className="w-full h-[70vh]"
                />
              ) : (
                <div className="p-6 text-sm text-center space-y-2">
                  <p className="text-muted-foreground">
                    Preview not available for this file type.
                  </p>
                  <a
                    href={fileData}
                    download={fileValue?.name}
                    className="text-primary underline"
                  >
                    Download {fileValue?.name || 'file'}
                  </a>
                </div>
              )}
            </div>
            <DialogFooter>
              <a
                href={fileData}
                download={fileValue?.name}
                className="text-xs text-primary underline"
              >
                Download
              </a>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default PaymentFieldDisplay;
