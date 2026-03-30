import { useRef, useEffect } from 'react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  size?: 'large' | 'normal';
}

export function SearchBar({ value, onChange, placeholder, autoFocus = false, size = 'normal' }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  return (
    <div className="relative group w-full">
      {/* Search icon */}
      <div className={`absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary group-focus-within:text-accent transition-colors duration-150 ${size === 'large' ? 'text-xl' : 'text-base'}`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>

      <input
        ref={inputRef}
        id="search-input"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || 'Search messages, images, links...'}
        className={`
          w-full bg-surface border border-[rgba(255,255,255,0.07)] rounded-xl
          pl-12 pr-4 font-body text-text-primary placeholder-text-tertiary
          transition-all duration-150 ease-out
          focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(124,110,245,0.15),inset_0_1px_12px_rgba(124,110,245,0.06)]
          hover:border-[rgba(255,255,255,0.14)]
          ${size === 'large' ? 'h-14 text-base' : 'h-11 text-sm'}
        `}
      />

      {/* Clear button */}
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-text-tertiary hover:text-text-secondary hover:bg-surface2 transition-colors duration-120"
          aria-label="Clear search"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}
