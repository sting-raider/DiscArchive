import { useEffect, useState } from 'react';
import { fetchAuthors } from '../lib/api';
import type { Author, MessageType, SortOrder, Message } from '../types/message';

interface FilterBarProps {
  type: MessageType;
  onTypeChange: (type: MessageType) => void;
  author: string;
  onAuthorChange: (author: string) => void;
  dateFrom: string;
  onDateFromChange: (date: string) => void;
  dateTo: string;
  onDateToChange: (date: string) => void;
  sort: SortOrder;
  onSortChange: (sort: SortOrder) => void;
  perPage: number;
  onPerPageChange: (val: number) => void;
  currentResults: Message[];
}

const TYPE_OPTIONS: { value: MessageType; label: string; icon: string }[] = [
  { value: 'all', label: 'All', icon: '✦' },
  { value: 'message', label: 'Messages', icon: '💬' },
  { value: 'image', label: 'Images', icon: '🖼️' },
  { value: 'video', label: 'Videos', icon: '🎬' },
  { value: 'link', label: 'Links', icon: '🔗' },
  { value: 'file', label: 'Files', icon: '📁' },
];

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
];

export function FilterBar({
  type, onTypeChange,
  author, onAuthorChange,
  dateFrom, onDateFromChange,
  dateTo, onDateToChange,
  sort, onSortChange,
  perPage, onPerPageChange,
  currentResults,
}: FilterBarProps) {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [localPerPage, setLocalPerPage] = useState(perPage);

  useEffect(() => {
    fetchAuthors()
      .then(setAuthors)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLocalPerPage(perPage);
  }, [perPage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localPerPage !== perPage) {
        onPerPageChange(localPerPage);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localPerPage, perPage, onPerPageChange]);

  const handleDownloadAll = () => {
    const urls = currentResults.flatMap(m => m.attachment_urls).filter(Boolean);
    if (urls.length === 0) return;
    
    urls.forEach((url, i) => {
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = url;
        a.download = '';
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, i * 200);
    });
  };

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Type chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            id={`filter-type-${opt.value}`}
            onClick={() => onTypeChange(opt.value)}
            className={`
              px-3.5 py-1.5 rounded-full text-xs font-medium tracking-wide
              transition-all duration-120 ease-out border
              ${type === opt.value
                ? 'bg-accent text-white border-accent shadow-[0_0_12px_rgba(124,110,245,0.25)]'
                : 'bg-surface2 text-text-secondary border-[rgba(255,255,255,0.07)] hover:border-[rgba(255,255,255,0.14)] hover:text-text-primary'
              }
            `}
          >
            <span className="mr-1.5">{opt.icon}</span>
            {opt.label}
          </button>
        ))}

        {/* Divider */}
        <div className="w-px h-6 bg-[rgba(255,255,255,0.07)] mx-1" />

        {/* Sort dropdown */}
        <select
          id="filter-sort"
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortOrder)}
          className="bg-surface2 border border-[rgba(255,255,255,0.07)] rounded-lg px-3 py-1.5 text-xs text-text-secondary hover:border-[rgba(255,255,255,0.14)] focus:outline-none focus:border-accent transition-colors cursor-pointer"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* More filters toggle */}
        <button
          id="toggle-filters"
          onClick={() => setShowFilters(!showFilters)}
          className={`
            ml-auto px-3 py-1.5 rounded-lg text-xs border transition-all duration-120
            ${showFilters
              ? 'bg-accent-soft text-accent border-accent/30'
              : 'bg-surface2 text-text-secondary border-[rgba(255,255,255,0.07)] hover:border-[rgba(255,255,255,0.14)]'
            }
          `}
        >
          <span className="mr-1">⚙</span>
          Filters
        </button>
      </div>

      {/* Expanded filters */}
      {showFilters && (
        <div className="flex items-center gap-4 animate-slide-up p-3 rounded-xl bg-surface border border-[rgba(255,255,255,0.07)]">
          {/* Author dropdown */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-widest text-text-tertiary font-mono">Author</label>
            <select
              id="filter-author"
              value={author}
              onChange={(e) => onAuthorChange(e.target.value)}
              className="bg-surface2 border border-[rgba(255,255,255,0.07)] rounded-lg px-3 py-1.5 text-xs text-text-secondary focus:outline-none focus:border-accent transition-colors cursor-pointer min-w-[160px]"
            >
              <option value="">All authors</option>
              {authors.map((a) => (
                <option key={a.name} value={a.name}>
                  {a.name} ({a.count.toLocaleString()})
                </option>
              ))}
            </select>
          </div>

          {/* Date range */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-widest text-text-tertiary font-mono">From</label>
            <input
              id="filter-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
              className="bg-surface2 border border-[rgba(255,255,255,0.07)] rounded-lg px-3 py-1.5 text-xs text-text-secondary focus:outline-none focus:border-accent transition-colors cursor-pointer"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-widest text-text-tertiary font-mono">To</label>
            <input
              id="filter-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => onDateToChange(e.target.value)}
              className="bg-surface2 border border-[rgba(255,255,255,0.07)] rounded-lg px-3 py-1.5 text-xs text-text-secondary focus:outline-none focus:border-accent transition-colors cursor-pointer"
            />
          </div>

          {/* Clear filters */}
          {(author || dateFrom || dateTo) && (
            <button
              onClick={() => {
                onAuthorChange('');
                onDateFromChange('');
                onDateToChange('');
              }}
              className="self-end px-3 py-1.5 rounded-lg text-xs text-red border border-red/20 hover:bg-red/10 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Results per page & Download actions row */}
      <div className="flex items-end gap-4 p-3 rounded-xl bg-surface border border-[rgba(255,255,255,0.07)]">
        {/* Results per page slider */}
        <div className="flex flex-col gap-1 flex-1 max-w-[200px]">
          <label className="flex items-center justify-between text-[10px] uppercase tracking-widest text-text-tertiary font-mono">
            <span>Per Page</span>
            <input
              type="number"
              min={1}
              max={1000000}
              value={localPerPage}
              onChange={(e) => {
                let v = parseInt(e.target.value, 10);
                if (isNaN(v)) return;
                if (v > 1000000) v = 1000000;
                if (v < 1) v = 1;
                setLocalPerPage(v);
              }}
              className="w-12 bg-transparent text-right text-text-secondary outline-none"
            />
          </label>
          <input
            type="range"
            min={1}
            max={10000}
            value={localPerPage}
            onChange={(e) => setLocalPerPage(parseInt(e.target.value, 10))}
            className="w-full h-1 mt-1.5 bg-surface2 rounded-lg appearance-none cursor-pointer border border-[rgba(255,255,255,0.07)] accent-accent"
          />
        </div>

        {/* Download all visible */}
        {(type === 'image' || type === 'video') && currentResults.length > 0 && (
          <div className="ml-auto">
            <button
              onClick={handleDownloadAll}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent-soft text-accent hover:bg-accent/20 transition-colors border border-accent/30 flex items-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7,10 12,15 17,10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download Visible
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
