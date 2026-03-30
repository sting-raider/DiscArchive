import type { SearchResponse, StatusResponse, Author, MessageType, SortOrder } from '../types/message';

const API_BASE = '/api';

export async function fetchStatus(): Promise<StatusResponse> {
  const res = await fetch(`${API_BASE}/status`);
  if (!res.ok) throw new Error('Failed to fetch status');
  return res.json();
}

export async function deleteIndex(): Promise<void> {
  const res = await fetch(`${API_BASE}/index`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete index');
}

export interface SearchParams {
  q: string;
  type?: MessageType;
  author?: string;
  date_from?: string;
  date_to?: string;
  has_attachment?: boolean;
  has_embed?: boolean;
  sort?: SortOrder;
  page?: number;
  per_page?: number;
}

export async function fetchSearch(params: SearchParams): Promise<SearchResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set('q', params.q);
  if (params.type && params.type !== 'all') searchParams.set('type', params.type);
  if (params.author) searchParams.set('author', params.author);
  if (params.date_from) searchParams.set('date_from', params.date_from);
  if (params.date_to) searchParams.set('date_to', params.date_to);
  if (params.has_attachment !== undefined) searchParams.set('has_attachment', String(params.has_attachment));
  if (params.has_embed !== undefined) searchParams.set('has_embed', String(params.has_embed));
  if (params.sort) searchParams.set('sort', params.sort);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.per_page) searchParams.set('per_page', String(params.per_page));

  const res = await fetch(`${API_BASE}/search?${searchParams.toString()}`);
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}

export async function fetchAuthors(): Promise<Author[]> {
  const res = await fetch(`${API_BASE}/authors`);
  if (!res.ok) throw new Error('Failed to fetch authors');
  const data = await res.json();
  return data.authors;
}

export function startImport(
  filePath: string,
  onEvent: (event: { event: string; data: Record<string, unknown> }) => void,
  onError: (error: Error) => void,
  onDone: () => void,
): AbortController {
  const controller = new AbortController();

  fetch(`${API_BASE}/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: filePath }),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Import failed' }));
        throw new Error(err.detail || 'Import failed');
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const cleanLine = line.replace(/^data: /, '').trim();
          if (!cleanLine) continue;
          try {
            const parsed = JSON.parse(cleanLine);
            onEvent(parsed);
          } catch {
            // Skip malformed lines
          }
        }
      }
      onDone();
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        onError(err);
      }
    });

  return controller;
}

export async function reverseImageSearch(imageUrl: string): Promise<{
  results: Array<{ message_id: string; image_url: string; similarity: number }>;
}> {
  const res = await fetch(`${API_BASE}/reverse-image-search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: imageUrl }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (data.error === 'clip_unavailable') {
      throw new Error('clip_unavailable');
    }
    throw new Error('Reverse image search failed');
  }
  return res.json();
}
