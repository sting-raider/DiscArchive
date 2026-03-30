import { useEffect, useCallback, useState } from 'react';

interface ImageModalProps {
  imageUrl: string | null;
  onClose: () => void;
  onFindSimilar?: (url: string) => void;
  clipAvailable?: boolean;
}

export function ImageModal({ imageUrl, onClose, onFindSimilar, clipAvailable = false }: ImageModalProps) {
  const [loaded, setLoaded] = useState(false);
  const [broken, setBroken] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (imageUrl) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      setLoaded(false);
      setBroken(false);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [imageUrl, handleKeyDown]);

  if (!imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-surface2/80 text-text-secondary hover:text-text-primary hover:bg-surface3 transition-colors z-10"
        aria-label="Close"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Action buttons */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 z-10">
        {/* Find similar */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (clipAvailable && onFindSimilar) {
              onFindSimilar(imageUrl);
            }
          }}
          disabled={!clipAvailable}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all
            ${clipAvailable
              ? 'bg-accent text-white hover:bg-accent/90 shadow-lg shadow-accent/25'
              : 'bg-surface3 text-text-tertiary cursor-not-allowed'
            }
          `}
          title={clipAvailable ? 'Find similar images' : 'Install sentence-transformers to enable image search'}
        >
          🔍 Find similar images
        </button>

        {/* Open in new tab */}
        <a
          href={imageUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface2/80 text-text-secondary hover:text-text-primary text-sm transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15,3 21,3 21,9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          Open
        </a>
      </div>

      {/* Image */}
      <div className="max-w-[90vw] max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
        {!loaded && !broken && (
          <div className="w-64 h-64 skeleton rounded-2xl" />
        )}
        {broken ? (
          <div className="w-64 h-64 flex items-center justify-center bg-surface2 rounded-2xl text-text-tertiary">
            Image failed to load
          </div>
        ) : (
          <img
            src={imageUrl}
            alt="Full size"
            className={`max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setLoaded(true)}
            onError={() => setBroken(true)}
          />
        )}
      </div>
    </div>
  );
}
