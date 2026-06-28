import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, RotateCcw } from 'lucide-react';

interface CustomCSSEditorProps {
  css: string;
  onSave: (css: string) => void;
}

export default function CustomCSSEditor({ css, onSave }: CustomCSSEditorProps) {
  const { t } = useTranslation('themes');
  const [value, setValue] = useState(css || '');
  const [hasChanges, setHasChanges] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setValue(css || '');
    setHasChanges(false);
  }, [css]);

  const handleSave = () => {
    onSave(value);
    setHasChanges(false);
  };

  const handleReset = () => {
    setValue(css || '');
    setHasChanges(false);
  };

  // Handle Tab key for indentation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      setValue(newValue);
      setHasChanges(true);
      // Set cursor position after the inserted spaces
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      });
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-sm text-gray-900">{t('themes:editor.custom_css.title')}</h3>
        <p className="text-xs text-gray-500 mt-1">
          {t('themes:editor.custom_css.description')}
        </p>
      </div>

      <div className="flex-1 p-4">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => { setValue(e.target.value); setHasChanges(true); }}
          onKeyDown={handleKeyDown}
          placeholder={`/* Example: */\n.hero-section {\n  background: linear-gradient(...);\n}\n\n.product-card:hover {\n  transform: scale(1.02);\n}`}
          className="w-full h-full min-h-[300px] px-3 py-2 text-sm font-mono bg-gray-950 text-green-400 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none placeholder-gray-600"
          spellCheck={false}
        />
      </div>

      <div className="p-4 border-t border-gray-200 bg-gray-50 flex gap-2">
        <button
          onClick={handleReset}
          disabled={!hasChanges}
          className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {t('themes:editor.topbar.reset_short')}
        </button>
        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition ${
            hasChanges
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          <Save className="w-3.5 h-3.5" />
          {t('themes:editor.custom_css.save')}
        </button>
      </div>
    </div>
  );
}
