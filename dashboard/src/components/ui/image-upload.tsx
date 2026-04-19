import React, { useState, useRef } from 'react';
import { Upload, X, Loader2, ImageIcon } from 'lucide-react';
import { Button } from './button';
import { api } from '../../lib/api-client';

interface ImageUploadProps {
  value?: string | string[]; // Single URL or array of URLs
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  maxFiles?: number;
  maxSizeMB?: number;
  label?: string;
  description?: string;
  accept?: string;
  disabled?: boolean;
  className?: string;
  /**
   * Legacy override for the upload endpoint. The component now always
   * routes uploads through `api.upload.productImages`, which picks up
   * the configured base URL — so this prop is accepted for back-compat
   * with older call sites but intentionally never read.
   */
  uploadEndpoint?: string;
  fieldName?: string; // Form field name (default: 'images' for multiple, 'image' for single)
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  value,
  onChange,
  multiple = false,
  maxFiles = 10,
  maxSizeMB = 5,
  label,
  description,
  accept = 'image/jpeg,image/png,image/webp',
  disabled = false,
  className = '',
  fieldName,
}) => {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const images = Array.isArray(value) ? value : value ? [value] : [];

  const validateFile = (file: File): string | null => {
    // Check file size
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      return `File ${file.name} is too large. Maximum size is ${maxSizeMB}MB`;
    }

    // Check file type
    const acceptedTypes = accept.split(',').map((t) => t.trim());
    if (!acceptedTypes.includes(file.type)) {
      return `File ${file.name} has invalid type. Accepted types: ${accept}`;
    }

    return null;
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setError('');
    setUploading(true);

    try {
      // Validate files
      const filesToUpload: File[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const validationError = validateFile(file);

        if (validationError) {
          setError(validationError);
          setUploading(false);
          return;
        }

        filesToUpload.push(file);
      }

      // Check max files limit
      if (multiple && images.length + filesToUpload.length > maxFiles) {
        setError(`Maximum ${maxFiles} files allowed`);
        setUploading(false);
        return;
      }

      // Create FormData
      const formData = new FormData();
      const field = fieldName || (multiple ? 'images' : 'image');

      if (multiple) {
        filesToUpload.forEach((file) => {
          formData.append(field, file);
        });
      } else {
        formData.append(field, filesToUpload[0]);
      }

      // Get auth token
      // const token = localStorage.getItem('token');

      // Upload to API using api client
      const response = (await api.upload.productImages(formData)) as {
        success: boolean;
        message?: string;
        data?: { urls?: string[]; url?: string };
      };

      if (!response.success) {
        throw new Error(response.message || 'Upload failed');
      }

      const data = response.data || {};

      // Update value
      if (multiple) {
        const newUrls = data.urls || [];
        onChange([...images, ...newUrls]);
      } else {
        const newUrl = data.urls?.[0] || data.url || '';
        onChange(newUrl);
      }
    } catch (err: unknown) {
      console.error('Upload error:', err);
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message?: unknown }).message)
          : 'Failed to upload image';
      setError(message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = (index: number) => {
    if (multiple) {
      const newImages = images.filter((_, i) => i !== index);
      onChange(newImages.length > 0 ? newImages : []);
    } else {
      onChange('');
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleUpload(e.target.files);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {label && (
        <div>
          <label className="text-sm font-medium">{label}</label>
          {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        </div>
      )}

      {/* Upload Area */}
      {(multiple || images.length === 0) && (
        <div
          className={`
            relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            transition-colors duration-200
            ${dragActive ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-gray-400'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={!disabled ? handleClick : undefined}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            className="hidden"
            onChange={handleFileInputChange}
            disabled={disabled}
          />

          <div className="flex flex-col items-center space-y-3">
            {uploading ? (
              <>
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Uploading...</p>
              </>
            ) : (
              <>
                <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Upload className="h-6 w-6 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {dragActive ? 'Drop files here' : 'Click to upload or drag and drop'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {accept.split(',').join(', ')} (max {maxSizeMB}MB)
                  </p>
                  {multiple && (
                    <p className="text-xs text-muted-foreground">
                      Maximum {maxFiles} files
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Image Previews */}
      {images.length > 0 && (
        <div className={`grid gap-4 ${multiple ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1'}`}>
          {images.map((url, index) => (
            <div
              key={index}
              className="relative aspect-square rounded-lg border border-gray-200 overflow-hidden group"
            >
              <img
                src={url}
                alt={`Upload ${index + 1}`}
                className="w-full h-full object-cover"
              />

              {!disabled && (
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(index);
                    }}
                  >
                    <X className="h-4 w-4 me-1" />
                    Remove
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty State for Multiple When No Images */}
      {multiple && images.length === 0 && !uploading && (
        <div className="text-center py-8 text-muted-foreground">
          <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No images uploaded yet</p>
        </div>
      )}
    </div>
  );
};
