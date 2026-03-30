interface StatsBarProps {
  total: number;
  processingTime: number;
  isLoading: boolean;
}

export function StatsBar({ total, processingTime, isLoading }: StatsBarProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <div className="skeleton h-4 w-32 rounded" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 py-2 text-xs font-mono text-text-tertiary">
      <span className="text-text-secondary">
        <span className="text-text-primary font-medium">{total.toLocaleString()}</span> results
      </span>
      <span className="w-1 h-1 rounded-full bg-text-tertiary" />
      <span>{processingTime}ms</span>
    </div>
  );
}
