import { useState } from 'react';
import { reverseImageSearch } from '../lib/api';

interface ReverseImageSearchProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
  onResultClick?: (messageId: string) => void;
}

interface SearchResult {
  message_id: string;
  image_url: string;
  similarity: number;
}

export function ReverseImageSearch({ isOpen, onClose, imageUrl, onResultClick }: ReverseImageSearchProps) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const doSearch = async () => {
    if (!imageUrl) return;
    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const data = await reverseImageSearch(imageUrl);
      setResults(data.results);
    } catch (err) {
      if (err instanceof Error && err.message === 'clip_unavailable') {
        setError('CLIP is not available. Install sentence-transformers to enable reverse image search.');
      } else {
        setError(err instanceof Error ? err.message : 'Search failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-surface border-l border-[rgba(255,255,255,0.07)] z-40 shadow-2xl shadow-black/50 animate-slide-in-right flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[rgba(255,255,255,0.07)]">
        <h3 className="text-sm font-heading font-bold text-text-primary">
          🔍 Similar Images
        </h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-surface2 text-text-tertiary hover:text-text-secondary transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Query image */}
      {imageUrl && (
        <div className="p-4 border-b border-[rgba(255,255,255,0.07)]">
          <p className="text-[10px] uppercase tracking-widest text-text-tertiary font-mono mb-2">
            Query Image
          </p>
          <img
            src={imageUrl}
            alt="Query"
            className="w-full h-32 object-cover rounded-lg"
          />
          {!hasSearched && (
            <button
              onClick={doSearch}
              className="mt-3 w-full py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              Search similar images
            </button>
          )}
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading && (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton h-20 rounded-lg" />
            ))}
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-red/10 border border-red/20 text-red text-sm">
            {error}
          </div>
        )}

        {!isLoading && !error && hasSearched && results.length === 0 && (
          <div className="text-center text-text-tertiary text-sm py-8">
            No similar images found
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-text-tertiary font-mono mb-3">
              {results.length} matches
            </p>
            {results.map((result) => (
              <button
                key={result.message_id}
                onClick={() => onResultClick?.(result.message_id)}
                className="w-full flex gap-3 p-2.5 rounded-lg bg-surface2 border border-[rgba(255,255,255,0.07)] hover:border-[rgba(255,255,255,0.14)] transition-colors text-left"
              >
                <img
                  src={result.image_url}
                  alt=""
                  className="w-16 h-16 rounded-md object-cover shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-text-tertiary truncate">
                    {result.message_id}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="h-1.5 flex-1 rounded-full bg-surface3 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${result.similarity * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-text-secondary">
                      {(result.similarity * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
