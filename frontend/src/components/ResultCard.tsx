import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import type { Message } from '../types/message';

interface ResultCardProps {
  message: Message;
  onImageClick?: (url: string) => void;
}

// File extension to color mapping
const EXT_COLORS: Record<string, string> = {
  pdf: 'bg-red/20 text-red',
  doc: 'bg-blue-500/20 text-blue-400',
  docx: 'bg-blue-500/20 text-blue-400',
  txt: 'bg-text-tertiary/20 text-text-secondary',
  zip: 'bg-orange/20 text-orange',
  rar: 'bg-orange/20 text-orange',
  mp3: 'bg-green/20 text-green',
  wav: 'bg-green/20 text-green',
  ogg: 'bg-green/20 text-green',
};

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

function AvatarCircle({ url, name }: { url: string; name: string }) {
  const [broken, setBroken] = useState(false);
  const hue = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

  if (!url || broken) {
    return (
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium shrink-0"
        style={{ background: `hsl(${hue}, 45%, 25%)`, color: `hsl(${hue}, 60%, 75%)` }}
      >
        {getInitials(name)}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={name}
      className="w-9 h-9 rounded-full object-cover shrink-0"
      onError={() => setBroken(true)}
    />
  );
}

export function ResultCard({ message, onImageClick }: ResultCardProps) {
  const formatted = message._formatted;
  const relativeTime = message.timestamp
    ? formatDistanceToNow(new Date(message.timestamp * 1000), { addSuffix: true })
    : '';

  return (
    <div
      className="
        group p-4 rounded-xl border border-[rgba(255,255,255,0.07)]
        bg-surface hover:border-[rgba(255,255,255,0.14)]
        hover:-translate-y-[1px] transition-all duration-[120ms] ease-out
        animate-fade-in
      "
    >
      {/* Header: avatar + name + time */}
      <div className="flex items-start gap-3">
        <AvatarCircle url={message.avatar_url} name={message.author_name} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm text-text-primary truncate">
              {message.author_name}
            </span>
            <span
              className="text-[11px] font-mono text-text-tertiary shrink-0"
              title={message.timestamp_iso}
            >
              {relativeTime}
            </span>
          </div>

          {/* Reply indicator */}
          {message.reply_to_id && (
            <div className="text-xs text-text-tertiary mb-1.5 flex items-center gap-1">
              <span className="text-accent">↩</span>
              <span>replying to a message</span>
            </div>
          )}

          {/* Content */}
          {(formatted?.content || message.content) && (
            <p
              className="text-sm text-text-secondary leading-relaxed break-words"
              dangerouslySetInnerHTML={{
                __html: formatted?.content || message.content,
              }}
            />
          )}

          {/* Type-specific content */}
          {message.type === 'image' && (
            <ImageContent message={message} onImageClick={onImageClick} />
          )}

          {message.type === 'video' && (
            <VideoContent message={message} />
          )}

          {message.type === 'link' && (
            <LinkContent message={message} formatted={formatted} />
          )}

          {message.type === 'file' && (
            <FileContent message={message} />
          )}

          {/* Reactions */}
          {message.reactions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {message.reactions.map((reaction, i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-2 py-0.5 rounded-md bg-surface2 text-xs text-text-secondary border border-[rgba(255,255,255,0.07)]"
                >
                  {reaction}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ImageContent({ message, onImageClick }: { message: Message; onImageClick?: (url: string) => void }) {
  const [brokenImages, setBrokenImages] = useState<Set<number>>(new Set());
  const imageUrls = message.attachment_urls.filter((_, i) => {
    const name = (message.attachment_names[i] || '').toLowerCase();
    const ext = name.split('.').pop() || '';
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'].includes(ext) || !name;
  });

  if (imageUrls.length === 0) return null;

  const gridClass = imageUrls.length === 1
    ? 'grid-cols-1'
    : 'grid-cols-2';

  return (
    <div className={`grid ${gridClass} gap-1.5 mt-2.5 max-w-md`}>
      {imageUrls.slice(0, 4).map((url, i) => (
        <div
          key={i}
          className="relative overflow-hidden rounded-lg bg-surface2 aspect-square cursor-pointer group/img"
          onClick={() => onImageClick?.(url)}
        >
          {brokenImages.has(i) ? (
            <div className="w-full h-full flex items-center justify-center text-text-tertiary text-xs">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
            </div>
          ) : (
            <img
              src={url}
              alt={message.attachment_names[i] || 'image'}
              className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-200"
              onError={() => setBrokenImages(prev => new Set(prev).add(i))}
              loading="lazy"
            />
          )}
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors duration-150 flex items-center justify-center">
            <svg className="w-6 h-6 text-white opacity-0 group-hover/img:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          </div>
        </div>
      ))}
    </div>
  );
}

function VideoContent({ message }: { message: Message }) {
  const videoUrl = message.attachment_urls[0];
  const fileName = message.attachment_names[0] || 'video';
  const fileSize = message.attachment_sizes[0];

  return (
    <div className="mt-2.5 space-y-2">
      <div className="flex items-center gap-2 text-xs text-text-secondary">
        <span className="text-accent">🎬</span>
        <span className="font-mono truncate">{fileName}</span>
        {fileSize > 0 && (
          <span className="px-1.5 py-0.5 rounded bg-surface2 text-text-tertiary text-[10px]">
            {formatFileSize(fileSize)}
          </span>
        )}
      </div>
      {videoUrl && (
        <video
          src={videoUrl}
          controls
          preload="metadata"
          className="rounded-lg max-w-md w-full bg-black"
        >
          Your browser does not support the video tag.
        </video>
      )}
    </div>
  );
}

function LinkContent({ message, formatted }: { message: Message; formatted?: Message['_formatted'] }) {
  const [thumbBroken, setThumbBroken] = useState(false);

  return (
    <div className="mt-2.5">
      <a
        href={message.embed_url || '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="flex gap-3 p-3 rounded-lg bg-surface2 border border-[rgba(255,255,255,0.07)] hover:border-[rgba(255,255,255,0.14)] transition-colors group/link"
      >
        {/* Thumbnail */}
        {message.embed_thumbnail && !thumbBroken && (
          <img
            src={message.embed_thumbnail}
            alt=""
            className="w-16 h-16 rounded-md object-cover shrink-0"
            onError={() => setThumbBroken(true)}
          />
        )}

        <div className="flex-1 min-w-0">
          {(formatted?.embed_title || message.embed_title) && (
            <p
              className="text-sm font-medium text-accent group-hover/link:underline truncate"
              dangerouslySetInnerHTML={{
                __html: formatted?.embed_title || message.embed_title || '',
              }}
            />
          )}
          {(formatted?.embed_description || message.embed_description) && (
            <p
              className="text-xs text-text-secondary mt-0.5 line-clamp-2"
              dangerouslySetInnerHTML={{
                __html: formatted?.embed_description || message.embed_description || '',
              }}
            />
          )}
          {message.embed_url && (
            <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded bg-surface3 text-[10px] font-mono text-text-tertiary">
              🔗 {new URL(message.embed_url).hostname}
            </span>
          )}
        </div>
      </a>
    </div>
  );
}

function FileContent({ message }: { message: Message }) {
  return (
    <div className="mt-2.5 space-y-1.5">
      {message.attachment_names.map((name, i) => {
        const ext = name.split('.').pop()?.toLowerCase() || '';
        const colorClass = EXT_COLORS[ext] || 'bg-accent-soft text-accent';
        const size = message.attachment_sizes[i];

        return (
          <div
            key={i}
            className="flex items-center gap-2.5 p-2.5 rounded-lg bg-surface2 border border-[rgba(255,255,255,0.07)]"
          >
            <div className="w-8 h-8 rounded-md bg-surface3 flex items-center justify-center text-sm">
              📄
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text-primary font-mono truncate">{name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${colorClass}`}>
                  {ext}
                </span>
                {size > 0 && (
                  <span className="text-[10px] text-text-tertiary font-mono">
                    {formatFileSize(size)}
                  </span>
                )}
              </div>
            </div>
            {message.attachment_urls[i] && (
              <a
                href={message.attachment_urls[i]}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-md hover:bg-surface3 text-text-tertiary hover:text-text-secondary transition-colors"
                title="Download"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7,10 12,15 17,10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
