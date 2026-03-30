import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchStatus, deleteIndex } from '../lib/api';
import { SearchBar } from '../components/SearchBar';
import { FilterBar } from '../components/FilterBar';
import { StatsBar } from '../components/StatsBar';
import { ResultCard } from '../components/ResultCard';
import { ImageModal } from '../components/ImageModal';
import { ReverseImageSearch } from '../components/ReverseImageSearch';
import { useSearch } from '../hooks/useSearch';
import type { StatusResponse } from '../types/message';

export function SearchPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [reverseSearchImage, setReverseSearchImage] = useState<string | null>(null);
  const [showReverseSearch, setShowReverseSearch] = useState(false);

  const {
    query, setQuery,
    results, total, processingTime,
    isLoading, error,
    type, setType,
    author, setAuthor,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    sort, setSort,
    perPage, setPerPage,
    hasMore, loadMore,
  } = useSearch();

  // Fetch status on mount
  useEffect(() => {
    fetchStatus()
      .then((s) => {
        setStatus(s);
        if (!s.index_ready) {
          navigate('/setup', { replace: true });
        }
      })
      .catch(() => {
        navigate('/setup', { replace: true });
      });
  }, [navigate]);

  // We removed the IntersectionObserver to allow the Per Page slider to strictly dictate
  // the exact number of visible items per page load without automatic fetching.

  const hasQuery = query.length > 0 || type !== 'all' || author || dateFrom || dateTo;

  return (
    <div className={`min-h-screen flex flex-col ${showReverseSearch ? 'pr-96' : ''} transition-all duration-300`}>
      {/* Empty state — centered */}
      {!hasQuery && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 -mt-16">
          <h1 className="font-heading font-extrabold text-5xl bg-gradient-to-r from-accent via-purple-400 to-pink-400 bg-clip-text text-transparent mb-3">
            DiscArchive
          </h1>

          {status && (
            <p className="text-text-secondary text-lg mb-8 font-body">
              <span className="font-heading font-bold text-text-primary">
                {status.total_messages.toLocaleString()}
              </span>{' '}
              messages. Find anything.
            </p>
          )}

          <div className="w-full max-w-2xl">
            <SearchBar
              value={query}
              onChange={setQuery}
              autoFocus
              size="large"
              onImageSearch={() => {
                setReverseSearchImage(null);
                setShowReverseSearch(true);
              }}
            />
          </div>

          {/* Type filter chips below search */}
          <div className="mt-6">
            <FilterBar
              type={type}
              onTypeChange={setType}
              author={author}
              onAuthorChange={setAuthor}
              dateFrom={dateFrom}
              onDateFromChange={setDateFrom}
              dateTo={dateTo}
              onDateToChange={setDateTo}
              sort={sort}
              onSortChange={setSort}
              perPage={perPage}
              onPerPageChange={setPerPage}
              currentResults={results}
            />
          </div>

          {/* Stats chips */}
          {status && (
            <div className="flex items-center gap-4 mt-8 flex-wrap justify-center">
              {Object.entries(status.stats).map(([key, value]) => (
                value > 0 && (
                  <div key={key} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border border-[rgba(255,255,255,0.07)]">
                    <span className="text-xs text-text-tertiary capitalize">{key}</span>
                    <span className="text-xs font-mono text-text-secondary">
                      {value.toLocaleString()}
                    </span>
                  </div>
                )
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active search state */}
      {hasQuery && (
        <div className="flex-1">
          {/* Sticky header */}
          <div className="sticky top-0 z-30 bg-bg/80 backdrop-blur-xl border-b border-[rgba(255,255,255,0.07)]">
            <div className="max-w-4xl mx-auto px-4 py-3">
              {/* Search bar at top */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setQuery('');
                    setType('all');
                    setAuthor('');
                    setDateFrom('');
                    setDateTo('');
                  }}
                  className="shrink-0 font-heading font-extrabold text-lg bg-gradient-to-r from-accent to-purple-400 bg-clip-text text-transparent hover:opacity-80 transition-opacity"
                >
                  DiscArchive
                </button>
                <div className="flex-1 max-w-2xl relative">
                  <SearchBar
                    value={query}
                    onChange={setQuery}
                    autoFocus
                    size="normal"
                    onImageSearch={() => {
                      setReverseSearchImage(null);
                      setShowReverseSearch(true);
                    }}
                  />
                </div>
              </div>

              {/* Filters */}
              <div className="mt-3">
                <FilterBar
                  type={type}
                  onTypeChange={setType}
                  author={author}
                  onAuthorChange={setAuthor}
                  dateFrom={dateFrom}
                  onDateFromChange={setDateFrom}
                  dateTo={dateTo}
                  onDateToChange={setDateTo}
                  sort={sort}
                  onSortChange={setSort}
                  perPage={perPage}
                  onPerPageChange={setPerPage}
                  currentResults={results}
                />
              </div>

              {/* Stats */}
              {(results.length > 0 || isLoading) && (
                <StatsBar
                  total={total}
                  processingTime={processingTime}
                  isLoading={isLoading && results.length === 0}
                />
              )}
            </div>
          </div>

          {/* Results */}
          <div className="max-w-4xl mx-auto px-4 py-4">
            {/* Loading skeletons */}
            {isLoading && results.length === 0 && (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="p-4 rounded-xl border border-[rgba(255,255,255,0.07)] bg-surface">
                    <div className="flex items-start gap-3">
                      <div className="skeleton w-9 h-9 rounded-full shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="skeleton h-4 w-32 rounded" />
                        <div className="skeleton h-3 w-full rounded" />
                        <div className="skeleton h-3 w-2/3 rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-4 rounded-xl bg-red/5 border border-red/20 text-sm text-red text-center">
                {error}
              </div>
            )}

            {/* No results */}
            {!isLoading && !error && results.length === 0 && hasQuery && (
              <div className="text-center py-16">
                <div className="text-4xl mb-3 opacity-50">👻</div>
                <p className="text-text-secondary text-sm">Nothing in the void.</p>
                <p className="text-text-tertiary text-xs mt-1">Try different keywords or remove some filters</p>
              </div>
            )}

            {/* Result cards */}
            {results.length > 0 && (
              <div className="space-y-2.5">
                {results.map((msg) => (
                  <div key={msg.id}>
                    <ResultCard
                      message={msg}
                      onImageClick={(url) => setModalImage(url)}
                    />
                  </div>
                ))}

                {/* Loading more indicator */}
                {isLoading && results.length > 0 && (
                  <div className="flex items-center justify-center py-4 gap-2 text-text-tertiary text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                    Loading more...
                  </div>
                )}

                {/* Manual Load More Button */}
                {hasMore && !isLoading && results.length > 0 && (
                  <div className="flex justify-center py-6">
                    <button
                      onClick={loadMore}
                      className="px-6 py-2.5 rounded-xl font-medium text-sm border border-[rgba(255,255,255,0.1)] bg-surface hover:bg-surface2 transition-colors duration-200 text-text-primary shadow-sm"
                    >
                      Load More
                    </button>
                  </div>
                )}

                {/* End of results */}
                {!hasMore && results.length > 0 && (
                  <div className="text-center py-6 text-xs text-text-tertiary font-mono">
                    — end of results —
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-4 border-t border-[rgba(255,255,255,0.07)] flex flex-col items-center justify-center gap-3 mt-auto">
        <button
          onClick={async () => {
            if (window.confirm('Are you sure you want to delete all indexed data? This action cannot be undone.')) {
              try {
                await deleteIndex();
                window.location.reload();
              } catch (err) {
                alert('Failed to delete data');
              }
            }
          }}
          className="px-3 py-1.5 rounded bg-red/10 border border-red/20 text-red text-xs hover:bg-red/20 transition-colors"
        >
          Delete All Data
        </button>
        <span className="text-[10px] text-text-tertiary font-mono">
          ⚡ Powered by Meilisearch · DiscArchive · All data stays on your machine
        </span>
      </footer>

      {/* Image modal */}
      <ImageModal
        imageUrl={modalImage}
        onClose={() => setModalImage(null)}
        clipAvailable={status?.clip_available || false}
        onFindSimilar={(url) => {
          setModalImage(null);
          setReverseSearchImage(url);
          setShowReverseSearch(true);
        }}
      />

      {/* Reverse image search panel */}
      <ReverseImageSearch
        isOpen={showReverseSearch}
        onClose={() => {
          setShowReverseSearch(false);
          setReverseSearchImage(null);
        }}
        imageUrl={reverseSearchImage}
      />
    </div>
  );
}
