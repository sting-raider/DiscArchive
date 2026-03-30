interface ProgressScreenProps {
  processed: number;
  total: number;
  percent: number;
  phase: string;
  logs: string[];
  estimatedTimeRemaining?: number;
}

export function ProgressScreen({ processed, total, percent, phase, logs }: ProgressScreenProps) {
  const phaseLabels: Record<string, string> = {
    counting: 'Counting messages...',
    parsing: 'Parsing JSON',
    indexing: 'Indexing messages',
    embedding: 'Building image embeddings (optional)',
    done: 'Complete!',
    starting: 'Starting import...',
    cancelled: 'Cancelled',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Phase label */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {phase !== 'done' && phase !== 'cancelled' && (
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          )}
          {phase === 'done' && (
            <div className="w-2 h-2 rounded-full bg-green" />
          )}
          <span className="text-sm font-medium text-text-primary">
            {phaseLabels[phase] || phase}
          </span>
        </div>
        <span className="text-sm font-mono text-accent">{percent}%</span>
      </div>

      {/* Progress bar */}
      <div className="relative h-2.5 rounded-full bg-surface2 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent to-purple-400 transition-all duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
        {/* Shimmer overlay */}
        {phase !== 'done' && percent < 100 && (
          <div
            className="absolute inset-y-0 left-0 rounded-full progress-shimmer"
            style={{ width: `${percent}%` }}
          />
        )}
      </div>

      {/* Counter */}
      <div className="flex items-center justify-between text-xs font-mono text-text-secondary">
        <span>
          Processed{' '}
          <span className="text-text-primary font-medium">
            {processed.toLocaleString()}
          </span>{' '}
          / {total.toLocaleString()} messages
        </span>
      </div>

      {/* Log stream */}
      {logs.length > 0 && (
        <div className="bg-surface2 rounded-lg border border-[rgba(255,255,255,0.07)] p-3 max-h-40 overflow-y-auto">
          <div className="space-y-1">
            {logs.slice(-5).map((log, i) => (
              <p key={i} className="text-xs font-mono text-text-tertiary leading-relaxed">
                <span className="text-text-secondary mr-2">›</span>
                {log}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
