/**
 * Shared rich-text editor (audit 6.3) — TipTap with a minimal,
 * shadcn-consistent toolbar. Emits HTML through `onChange`; the server-side
 * sanitizer (services/page.js) remains the security boundary — this
 * component is a convenience for merchants, not a filter.
 *
 * Used by PageForm (page content) and CustomFields (`richtext` type).
 * RTL-safe: the editing surface takes `dir` from the current dashboard
 * language (overridable via the `dir` prop for content written in a
 * different locale than the UI).
 */
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Pilcrow, Heading2, Heading3, Bold, Italic, List, ListOrdered, Quote,
  Link as LinkIcon, Image as ImageIcon, Minus, RemoveFormatting, Loader2, Upload,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { useLanguage } from '../i18n/LanguageProvider';
import { api } from '../lib/api-client';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { MediaPicker } from './MediaPicker';
import type { MediaAsset } from './media/MediaGrid';

interface UploadResponse {
  data?: { url?: string };
  responseObject?: { url?: string };
  url?: string;
}

export interface RichTextEditorProps {
  /** HTML string (round-trips with the raw-HTML textarea in PageForm). */
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Writing direction of the content. Defaults to the dashboard language's direction. */
  dir?: 'ltr' | 'rtl';
  className?: string;
}

const ToolbarButton: React.FC<{
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ label, active, disabled, onClick, children }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    aria-pressed={active}
    disabled={disabled}
    // onMouseDown+preventDefault keeps the editor selection/focus intact.
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className={cn(
      'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors',
      'hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed',
      active && 'bg-muted text-foreground',
    )}
  >
    {children}
  </button>
);

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder,
  dir,
  className,
}) => {
  const { t } = useTranslation(['common']);
  const { dir: uiDir } = useLanguage();
  const contentDir = dir ?? uiDir;

  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const imageFileRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: 'https',
        },
      }),
      Image,
      Placeholder.configure({ placeholder: placeholder ?? '' }),
    ],
    content: value || '',
    // Toolbar active states read editor state on every render.
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        class: 'rte-content focus:outline-none',
        role: 'textbox',
        'aria-multiline': 'true',
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.isEmpty ? '' : ed.getHTML());
    },
  });

  // External value changes (e.g. the raw-HTML tab in PageForm, or async
  // loads) are pushed into the editor. Updates originating from typing are
  // no-ops here because the parent state already equals `getHTML()`.
  useEffect(() => {
    if (!editor) return;
    const current = editor.isEmpty ? '' : editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  const openLinkDialog = () => {
    setLinkUrl(editor.getAttributes('link').href || '');
    setLinkDialogOpen(true);
  };

  const applyLink = () => {
    const url = linkUrl.trim();
    if (url) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    } else {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    }
    setLinkDialogOpen(false);
  };

  const removeLink = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    setLinkDialogOpen(false);
  };

  const insertImage = () => {
    const url = imageUrl.trim();
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
    setImageDialogOpen(false);
    setImageUrl('');
  };

  // Media library pick (audit 6.6): insert the selected asset directly,
  // carrying its alt text, and close both the picker and the dialog.
  const handleMediaSelect = (asset: MediaAsset) => {
    editor.chain().focus().setImage({ src: asset.url, alt: asset.alt || '' }).run();
    setMediaPickerOpen(false);
    setImageDialogOpen(false);
    setImageUrl('');
  };

  const handleImageUpload = async (file: File) => {
    try {
      setImageUploading(true);
      const res = (await api.upload.genericImage(file)) as UploadResponse;
      const url = res?.data?.url || res?.responseObject?.url || res?.url;
      if (!url) throw new Error(t('common:editor.image_dialog.no_url'));
      setImageUrl(url);
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message || t('common:editor.image_dialog.no_url'));
    } finally {
      setImageUploading(false);
      if (imageFileRef.current) imageFileRef.current.value = '';
    }
  };

  return (
    <div className={cn('rounded-md border border-input bg-background shadow-sm', className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b p-1" role="toolbar">
        <ToolbarButton
          label={t('common:editor.toolbar.paragraph')}
          active={editor.isActive('paragraph')}
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          <Pilcrow className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label={t('common:editor.toolbar.heading2')}
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label={t('common:editor.toolbar.heading3')}
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <ToolbarButton
          label={t('common:editor.toolbar.bold')}
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label={t('common:editor.toolbar.italic')}
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <ToolbarButton
          label={t('common:editor.toolbar.bullet_list')}
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label={t('common:editor.toolbar.ordered_list')}
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label={t('common:editor.toolbar.blockquote')}
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <ToolbarButton
          label={t('common:editor.toolbar.link')}
          active={editor.isActive('link')}
          onClick={openLinkDialog}
        >
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label={t('common:editor.toolbar.image')}
          onClick={() => { setImageUrl(''); setImageDialogOpen(true); }}
        >
          <ImageIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label={t('common:editor.toolbar.divider')}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <Minus className="h-4 w-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <ToolbarButton
          label={t('common:editor.toolbar.clear_formatting')}
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        >
          <RemoveFormatting className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {/* Editing surface */}
      <div dir={contentDir}>
        <EditorContent editor={editor} />
      </div>

      {/* Link dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('common:editor.link_dialog.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>{t('common:editor.link_dialog.url_label')}</Label>
            <Input
              dir="ltr"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder={t('common:editor.link_dialog.url_placeholder')}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } }}
              autoFocus
            />
          </div>
          <DialogFooter className="sm:justify-between">
            <div>
              {editor.isActive('link') && (
                <Button variant="ghost" className="text-destructive" onClick={removeLink}>
                  {t('common:editor.link_dialog.remove')}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
                {t('common:action.cancel')}
              </Button>
              <Button onClick={applyLink}>{t('common:editor.link_dialog.apply')}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image dialog — URL input + upload through the generic endpoint (6.3.3). */}
      <Dialog open={imageDialogOpen} onOpenChange={(o) => { if (!imageUploading) setImageDialogOpen(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('common:editor.image_dialog.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {/* Media library (audit 6.6): pick a previously-uploaded asset
                without re-uploading. URL entry + upload remain as secondary
                options below. */}
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => setMediaPickerOpen(true)}
            >
              <ImageIcon className="h-4 w-4 me-2" />
              {t('common:editor.image_dialog.browse_library')}
            </Button>
            <Label>{t('common:editor.image_dialog.url_label')}</Label>
            <div className="flex gap-2">
              <Input
                dir="ltr"
                className="flex-1"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder={t('common:editor.image_dialog.url_placeholder')}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); insertImage(); } }}
                autoFocus
              />
              <input
                ref={imageFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImageUpload(f);
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => imageFileRef.current?.click()}
                disabled={imageUploading}
              >
                {imageUploading
                  ? <><Loader2 className="h-4 w-4 me-2 animate-spin" />{t('common:editor.image_dialog.uploading')}</>
                  : <><Upload className="h-4 w-4 me-2" />{t('common:editor.image_dialog.upload')}</>}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImageDialogOpen(false)} disabled={imageUploading}>
              {t('common:action.cancel')}
            </Button>
            <Button onClick={insertImage} disabled={!imageUrl.trim() || imageUploading}>
              {t('common:editor.image_dialog.insert')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Media library picker (audit 6.6) */}
      <MediaPicker
        open={mediaPickerOpen}
        onOpenChange={setMediaPickerOpen}
        onSelect={handleMediaSelect}
      />
    </div>
  );
};

export default RichTextEditor;
