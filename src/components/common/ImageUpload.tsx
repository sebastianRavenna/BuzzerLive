import { useState, useRef } from 'react';

interface ImageUploadProps {
  currentUrl?: string | null;
  onUpload: (file: File) => Promise<{ url: string | null; error: string | null }>;
  onRemove?: () => void;
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
  shape?: 'circle' | 'square';
  label?: string;
  disabled?: boolean;
}

export default function ImageUpload({
  currentUrl,
  onUpload,
  onRemove,
  placeholder = '📷',
  size = 'md',
  shape = 'circle',
  label,
  disabled = false,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sizeClass = { sm: 'w-16 h-16', md: 'w-24 h-24', lg: 'w-32 h-32' }[size];
  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-xl';

  const handleClick = () => {
    if (!disabled && !uploading) inputRef.current?.click();
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);

    // Preview inmediato
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);

    const result = await onUpload(file);
    
    if (result.error) {
      setError(result.error);
      setPreview(null);
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreview(null);
    onRemove?.();
  };

  const displayUrl = preview || currentUrl;

  return (
    <div className="flex flex-col items-center gap-2">
      {label && <span className="text-gray-300 text-sm">{label}</span>}
      
      <div
        onClick={handleClick}
        className={`
          ${sizeClass} ${shapeClass}
          relative cursor-pointer overflow-hidden
          bg-gray-700 border-2 border-dashed border-gray-600
          hover:border-blue-500 hover:bg-gray-600
          flex items-center justify-center
          transition-all
          ${uploading || disabled ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        {displayUrl ? (
          <>
            <img src={displayUrl} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
              <span className="text-white text-sm">Cambiar</span>
            </div>
            {onRemove && (
              <button
                onClick={handleRemove}
                className="absolute -top-1 -right-1 w-6 h-6 bg-red-600 rounded-full text-white text-xs hover:bg-red-700"
              >
                ✕
              </button>
            )}
          </>
        ) : (
          <span className="text-gray-400 text-2xl">{uploading ? '⏳' : placeholder}</span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleChange}
        className="hidden"
      />

      {error && <span className="text-red-400 text-xs">{error}</span>}
    </div>
  );
}

// Componente para subir documentos (PDF, imágenes)
interface DocUploadProps {
  currentUrl?: string | null;
  onUpload: (file: File) => Promise<{ url: string | null; error: string | null }>;
  label?: string;
  accept?: string;
}

export function DocUpload({ currentUrl, onUpload, label, accept = 'image/*,application/pdf' }: DocUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => inputRef.current?.click();

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);

    const result = await onUpload(file);
    
    if (result.error) {
      setError(result.error);
    } else {
      setUploaded(true);
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const hasFile = currentUrl || uploaded;

  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-gray-300 text-sm">{label}</span>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleClick}
          disabled={uploading}
          className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded text-sm"
        >
          {uploading ? '⏳...' : hasFile ? '📄 Cambiar' : '📎 Subir'}
        </button>
        {hasFile && <span className="text-green-400 text-sm">✓ Subido</span>}
      </div>
      <input ref={inputRef} type="file" accept={accept} onChange={handleChange} className="hidden" />
      {error && <span className="text-red-400 text-xs">{error}</span>}
    </div>
  );
}
