/**
 * MediaPicker (audit 6.6) — a dialog wrapping the shared MediaGrid for
 * in-context asset selection. Wired into:
 *   (a) the RichTextEditor image action, and
 *   (b) the theme editor's image-type SettingControl,
 * so an image uploaded once is insertable everywhere without re-uploading.
 *
 * `onSelect` receives the chosen asset ({ url, alt, … }); the dialog
 * closes itself on pick.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from './ui/dialog';
import { MediaGrid, type MediaAsset } from './media/MediaGrid';

interface MediaPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (asset: MediaAsset) => void;
}

export const MediaPicker: React.FC<MediaPickerProps> = ({ open, onOpenChange, onSelect }) => {
  const { t } = useTranslation(['media']);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('media:picker.title')}</DialogTitle>
        </DialogHeader>
        <MediaGrid
          mode="select"
          onSelect={(asset) => {
            onSelect(asset);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
};

export default MediaPicker;
