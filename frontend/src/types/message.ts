export interface Message {
  id: string;
  content: string;
  author_name: string;
  author_id: string;
  avatar_url: string;
  timestamp: number;
  timestamp_iso: string;
  type: 'message' | 'image' | 'video' | 'link' | 'file' | 'sticker';
  attachment_urls: string[];
  attachment_names: string[];
  attachment_sizes: number[];
  embed_title: string | null;
  embed_url: string | null;
  embed_thumbnail: string | null;
  embed_description: string | null;
  reactions: string[];
  has_attachment: boolean;
  has_embed: boolean;
  reply_to_id: string | null;
  _formatted?: {
    content?: string;
    embed_title?: string;
    embed_description?: string;
  };
}

export interface SearchResponse {
  hits: Message[];
  total: number;
  processing_time_ms: number;
  facets: {
    type?: Record<string, number>;
    author_name?: Record<string, number>;
  };
  page: number;
  per_page: number;
}

export interface StatusResponse {
  meilisearch: boolean;
  clip_available: boolean;
  total_messages: number;
  index_ready: boolean;
  stats: {
    messages: number;
    images: number;
    videos: number;
    links: number;
    files: number;
  };
}

export interface Author {
  name: string;
  count: number;
}

export interface ImportProgress {
  event: 'progress' | 'done' | 'error';
  data: {
    processed?: number;
    total?: number;
    percent?: number;
    phase?: string;
    indexed?: number;
    skipped?: number;
    duration_s?: number;
    message?: string;
  };
}

export type MessageType = 'all' | 'message' | 'image' | 'video' | 'link' | 'file';
export type SortOrder = 'relevance' | 'newest' | 'oldest';
