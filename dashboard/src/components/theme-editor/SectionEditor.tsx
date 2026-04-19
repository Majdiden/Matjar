import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

interface Section {
  id: string;
  type: string;
  enabled: boolean;
  order: number;
  layout?: string;
  settings: Record<string, unknown>;
  elements?: Array<{
    id: string;
    type: string;
    order: number;
    content: unknown;
    styles: Record<string, string>;
  }>;
}

interface SectionEditorProps {
  section: Section | null;
  onClose: () => void;
  onSave: (sectionId: string, settings: Record<string, unknown>) => void;
}

export default function SectionEditor({ section, onClose, onSave }: SectionEditorProps) {
  const [editedSettings, setEditedSettings] = useState<Record<string, unknown>>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (section) {
      setEditedSettings(section.settings || {});
      setHasChanges(false);
    }
  }, [section]);

  if (!section) return null;

  const handleSettingChange = (key: string, value: unknown) => {
    setEditedSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave(section.id, editedSettings);
    setHasChanges(false);
  };

  const layoutOptions = [
    { value: 'full-width', label: 'Full Width' },
    { value: 'contained', label: 'Contained' },
    { value: 'grid-2', label: '2 Columns' },
    { value: 'grid-3', label: '3 Columns' },
    { value: 'grid-4', label: '4 Columns' },
  ];

  return (
    <div className="h-full flex flex-col bg-white border-s border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Section Settings</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Settings Form */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Layout */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Layout
          </label>
          <select
            value={(section.layout as string) || 'full-width'}
            onChange={(e) => handleSettingChange('layout', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {layoutOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Heading/Title */}
        {(editedSettings.title !== undefined || editedSettings.heading !== undefined || section.type === 'hero' || section.type === 'banner') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Heading
            </label>
            <input
              type="text"
              value={(editedSettings.title as string) || (editedSettings.heading as string) || ''}
              onChange={(e) => handleSettingChange('title', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter heading"
            />
          </div>
        )}

        {/* Subheading/Subtitle */}
        {(editedSettings.subtitle !== undefined || editedSettings.subheading !== undefined || section.type === 'hero') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subheading
            </label>
            <input
              type="text"
              value={(editedSettings.subtitle as string) || (editedSettings.subheading as string) || ''}
              onChange={(e) => handleSettingChange('subtitle', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter subheading"
            />
          </div>
        )}

        {/* Button Text */}
        {(editedSettings.buttonText !== undefined || section.type === 'hero' || section.type === 'newsletter') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Button Text
            </label>
            <input
              type="text"
              value={(editedSettings.buttonText as string) || ''}
              onChange={(e) => handleSettingChange('buttonText', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter button text"
            />
          </div>
        )}

        {/* Button Link */}
        {(editedSettings.buttonLink !== undefined || section.type === 'hero') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Button Link
            </label>
            <input
              type="text"
              value={(editedSettings.buttonLink as string) || ''}
              onChange={(e) => handleSettingChange('buttonLink', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="/products"
            />
          </div>
        )}

        {/* Background Color */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Background Color
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="color"
              value={(editedSettings.backgroundColor as string) || '#ffffff'}
              onChange={(e) => handleSettingChange('backgroundColor', e.target.value)}
              className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
            />
            <input
              type="text"
              value={(editedSettings.backgroundColor as string) || '#ffffff'}
              onChange={(e) => handleSettingChange('backgroundColor', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="#ffffff"
            />
          </div>
        </div>

        {/* Text Color */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Text Color
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="color"
              value={(editedSettings.textColor as string) || '#000000'}
              onChange={(e) => handleSettingChange('textColor', e.target.value)}
              className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
            />
            <input
              type="text"
              value={(editedSettings.textColor as string) || '#000000'}
              onChange={(e) => handleSettingChange('textColor', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="#000000"
            />
          </div>
        </div>

        {/* Product Limit (for e-commerce sections) */}
        {(editedSettings.limit !== undefined ||
          editedSettings.productLimit !== undefined ||
          section.type === 'featured-products' ||
          section.type === 'new-arrivals' ||
          section.type === 'product-grid' ||
          section.type === 'best-sellers') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number of Products
              </label>
              <input
                type="number"
                value={(editedSettings.limit as number) || (editedSettings.productLimit as number) || 8}
                onChange={(e) => handleSettingChange('limit', parseInt(e.target.value))}
                min="1"
                max="24"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}

        {/* Padding */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Padding
          </label>
          <input
            type="text"
            value={(editedSettings.padding as string) || '3rem 0'}
            onChange={(e) => handleSettingChange('padding', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="3rem 0"
          />
          <p className="text-xs text-gray-500 mt-1">
            CSS padding value (e.g., "3rem 0" or "2rem 1rem")
          </p>
        </div>

        {/* Image URL (for hero, banner, etc.) */}
        {(editedSettings.image !== undefined || editedSettings.imageUrl !== undefined || section.type === 'hero' || section.type === 'banner') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Image URL
            </label>
            <input
              type="text"
              value={(editedSettings.image as string) || (editedSettings.imageUrl as string) || ''}
              onChange={(e) => handleSettingChange('image', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://example.com/image.jpg"
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className={`w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-lg transition-colors ${hasChanges
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
        >
          <Save className="w-4 h-4" />
          <span>{hasChanges ? 'Save Changes' : 'No Changes'}</span>
        </button>
      </div>
    </div>
  );
}
