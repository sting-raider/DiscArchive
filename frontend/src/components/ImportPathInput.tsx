import { useState } from 'react';

interface ImportPathInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export function ImportPathInput({ value, onChange, onSubmit, disabled }: ImportPathInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && value.trim()) {
      onSubmit();
    }
  };

  return (
    <div className="w-full">
      <div
        className={`
          relative rounded-2xl border-2 border-dashed p-8 text-center
          transition-all duration-200 ease-out
          ${isFocused
            ? 'border-accent bg-accent-soft shadow-[0_0_30px_rgba(124,110,245,0.1)]'
            : 'border-[rgba(255,255,255,0.1)] bg-surface2/50 hover:border-[rgba(255,255,255,0.2)]'
          }
        `}
      >
        {/* Icon */}
        <div className="mb-4">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl transition-colors ${isFocused ? 'bg-accent/20' : 'bg-surface3'}`}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={isFocused ? '#7c6ef5' : '#4a4958'} strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14,2 14,8 20,8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          </div>
        </div>

        <h3 className="font-heading font-bold text-lg text-text-primary mb-2">
          Import your Discord export
        </h3>
        <p className="text-sm text-text-secondary mb-6">
          Paste the full path to your JSON or ZIP export file
        </p>

        {/* File path input */}
        <div className="max-w-lg mx-auto">
          <input
            id="import-path-input"
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            disabled={disabled}
            placeholder="C:\Users\you\Downloads\export.json"
            className="
              w-full h-12 px-4 rounded-xl bg-surface border border-[rgba(255,255,255,0.07)]
              text-sm font-mono text-text-primary placeholder-text-tertiary
              focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(124,110,245,0.15)]
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-150
            "
          />
        </div>

        {/* Submit button */}
        <button
          id="start-import-btn"
          onClick={onSubmit}
          disabled={disabled || !value.trim()}
          className="
            mt-4 px-8 py-2.5 rounded-xl bg-accent text-white text-sm font-medium
            hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed
            transition-all duration-150 shadow-lg shadow-accent/20
            hover:shadow-accent/30 hover:-translate-y-[1px]
          "
        >
          Start Import
        </button>

        {/* Supported formats */}
        <p className="mt-4 text-xs text-text-tertiary">
          Supports <span className="font-mono text-text-secondary">.json</span> and{' '}
          <span className="font-mono text-text-secondary">.zip</span> files from{' '}
          <a
            href="https://github.com/Tyrrrz/DiscordChatExporter"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            DiscordChatExporter
          </a>
        </p>
      </div>
    </div>
  );
}
