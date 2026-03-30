import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProgressScreen } from '../components/ProgressScreen';
import { useImport } from '../hooks/useImport';

export function ImportPage() {
  const navigate = useNavigate();
  const { progress, phase, logs, isDone, doneData, error } = useImport();

  useEffect(() => {
    if (isDone) {
      const timer = setTimeout(() => {
        navigate('/', { replace: true });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isDone, navigate]);

  // If no import is in progress, redirect to setup
  useEffect(() => {
    if (!progress && !isDone && !error) {
      navigate('/setup', { replace: true });
    }
  }, [progress, isDone, error, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <h1 className="font-heading font-extrabold text-3xl bg-gradient-to-r from-accent to-purple-400 bg-clip-text text-transparent">
          Importing...
        </h1>
      </div>

      <div className="max-w-lg w-full">
        {progress && (
          <div className="p-6 rounded-2xl bg-surface border border-[rgba(255,255,255,0.07)]">
            <ProgressScreen
              processed={progress.processed || 0}
              total={progress.total || 0}
              percent={progress.percent || 0}
              phase={phase}
              logs={logs}
            />
          </div>
        )}

        {isDone && doneData && (
          <div className="p-6 rounded-2xl bg-surface border border-green/20 animate-fade-in text-center">
            <div className="text-3xl mb-3">✅</div>
            <h2 className="font-heading font-bold text-xl text-text-primary mb-2">
              Import complete!
            </h2>
            <p className="text-xs text-text-tertiary">
              Redirecting to search in 3 seconds...
            </p>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-red/5 border border-red/20 text-sm text-red text-center">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
