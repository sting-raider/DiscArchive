import { useEffect, useState } from 'react';
import { fetchAuthors } from '../lib/api';
import type { Author, MessageType, SortOrder } from '../types/message';

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
}: FilterBarProps) {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchAuthors()
      .then(setAuthors)
      .catch(() => {});
  }, []);

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
    </div>
  );
}
