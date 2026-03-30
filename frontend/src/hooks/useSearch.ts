import { useState, useCallback, useEffect, useRef } from 'react';
import { fetchSearch, type SearchParams } from '../lib/api';
import type { Message, MessageType, SortOrder, SearchResponse } from '../types/message';
import { useDebounce } from './useDebounce';

interface UseSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  results: Message[];
  total: number;
  processingTime: number;
  facets: SearchResponse['facets'];
  isLoading: boolean;
  error: string | null;
  page: number;
  setPage: (p: number) => void;
  type: MessageType;
  setType: (t: MessageType) => void;
  author: string;
  setAuthor: (a: string) => void;
  dateFrom: string;
  setDateFrom: (d: string) => void;
  dateTo: string;
  setDateTo: (d: string) => void;
  perPage: number;
  setPerPage: (p: number) => void;
  sort: SortOrder;
  setSort: (s: SortOrder) => void;
  hasMore: boolean;
  loadMore: () => void;
}

export function useSearch(): UseSearchReturn {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Message[]>([]);
  const [total, setTotal] = useState(0);
  const [processingTime, setProcessingTime] = useState(0);
  const [facets, setFacets] = useState<SearchResponse['facets']>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [type, setType] = useState<MessageType>('all');
  const [author, setAuthor] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort, setSort] = useState<SortOrder>('relevance');
  const [perPage, setPerPage] = useState(20);

  const debouncedQuery = useDebounce(query, 250);
  const isLoadingMore = useRef(false);

  const performSearch = useCallback(async (searchPage: number, append: boolean = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const params: SearchParams = {
        q: debouncedQuery,
        type: type !== 'all' ? type : undefined,
        author: author || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        sort: sort !== 'relevance' ? sort : undefined,
        page: searchPage,
        per_page: perPage,
      };

      const response = await fetchSearch(params);

      if (append) {
        setResults(prev => [...prev, ...response.hits]);
      } else {
        setResults(response.hits);
      }
      setTotal(response.total);
      setProcessingTime(response.processing_time_ms);
      setFacets(response.facets);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setIsLoading(false);
      isLoadingMore.current = false;
    }
  }, [debouncedQuery, type, author, dateFrom, dateTo, sort, perPage]);

  // Reset page and search when filters change
  useEffect(() => {
    setPage(1);
    if (debouncedQuery || type !== 'all' || author || dateFrom || dateTo) {
      performSearch(1, false);
    } else {
      setResults([]);
      setTotal(0);
      setProcessingTime(0);
    }
  }, [debouncedQuery, type, author, dateFrom, dateTo, sort, perPage, performSearch]);

  const hasMore = results.length < total;

  const loadMore = useCallback(() => {
    if (isLoadingMore.current || !hasMore) return;
    isLoadingMore.current = true;
    const nextPage = page + 1;
    setPage(nextPage);
    performSearch(nextPage, true);
  }, [page, hasMore, performSearch]);

  return {
    query, setQuery,
    results, total, processingTime, facets,
    isLoading, error,
    page, setPage,
    type, setType,
    author, setAuthor,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    perPage, setPerPage,
    sort, setSort,
    hasMore, loadMore,
  };
}
