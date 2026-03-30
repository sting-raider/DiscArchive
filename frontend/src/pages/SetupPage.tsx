import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchStatus, deleteIndex } from '../lib/api';
import { ImportPathInput } from '../components/ImportPathInput';
import { useImport } from '../hooks/useImport';
import { ProgressScreen } from '../components/ProgressScreen';
import type { StatusResponse } from '../types/message';

export function SetupPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [showExportGuide, setShowExportGuide] = useState(false);

  const {
    filePath, setFilePath,
    isImporting, progress, phase, logs, error, isDone, doneData,
    startIngestion,
  } = useImport();

  useEffect(() => {
    fetchStatus()
      .then((s) => {
        setStatus(s);
        if (s.index_ready) {
          navigate('/', { replace: true });
        }
      })
      .catch(() => setStatusError(true));
  }, [navigate]);

  // Auto-redirect after import completes
  useEffect(() => {
    if (isDone) {
      const timer = setTimeout(() => {
        navigate('/', { replace: true });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isDone, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="mb-8 text-center">
        <h1 className="font-heading font-extrabold text-4xl bg-gradient-to-r from-accent to-purple-400 bg-clip-text text-transparent">
          DiscArchive
        </h1>
        <p className="text-text-secondary text-sm mt-2">
          Search your Discord group DM history. All local.
        </p>
      </div>

      {/* Meilisearch status */}
      {statusError || (status && !status.meilisearch) ? (
        <div className="mb-8 max-w-md w-full p-4 rounded-xl bg-red/5 border border-red/20">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-red animate-pulse" />
            <span className="text-sm font-medium text-red">Meilisearch not running</span>
          </div>
          <p className="text-xs text-text-secondary mb-3">
            Start Meilisearch with Docker, then refresh this page:
          </p>
          <pre className="bg-surface p-3 rounded-lg text-xs font-mono text-text-secondary overflow-x-auto">
            docker-compose up -d
          </pre>
        </div>
      ) : status?.meilisearch ? (
        <div className="mb-6 flex items-center gap-2 text-xs text-text-tertiary">
          <div className="w-1.5 h-1.5 rounded-full bg-green" />
          <span>Meilisearch connected</span>
          {status.clip_available && (
            <>
              <span className="mx-1">·</span>
              <div className="w-1.5 h-1.5 rounded-full bg-green" />
              <span>CLIP available</span>
            </>
          )}
        </div>
      ) : null}

      {/* Import area */}
      <div className="max-w-xl w-full">
        {!isImporting && !isDone && (
          <ImportPathInput
            value={filePath}
            onChange={setFilePath}
            onSubmit={startIngestion}
            disabled={!status?.meilisearch}
          />
        )}

        {/* Import progress */}
        {isImporting && progress && (
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

        {/* Import complete */}
        {isDone && doneData && (
          <div className="p-6 rounded-2xl bg-surface border border-green/20 animate-fade-in text-center">
            <div className="text-3xl mb-3">✅</div>
            <h2 className="font-heading font-bold text-xl text-text-primary mb-2">
              Import complete!
            </h2>
            <div className="flex items-center justify-center gap-4 text-sm text-text-secondary mb-4">
              <span>
                <span className="font-mono text-green font-medium">{doneData.indexed?.toLocaleString()}</span> indexed
              </span>
              {(doneData.skipped ?? 0) > 0 && (
                <span>
                  <span className="font-mono text-orange">{doneData.skipped?.toLocaleString()}</span> skipped
                </span>
              )}
              <span className="font-mono text-text-tertiary">{doneData.duration_s}s</span>
            </div>
            <p className="text-xs text-text-tertiary">
              Redirecting to search in 3 seconds...
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-4 rounded-xl bg-red/5 border border-red/20 text-sm text-red">
            {error}
          </div>
        )}
      </div>

      {/* Export guide */}
      <div className="mt-10 max-w-xl w-full">
        <button
          onClick={() => setShowExportGuide(!showExportGuide)}
          className="flex items-center gap-2 text-xs text-text-tertiary hover:text-text-secondary transition-colors"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`transition-transform ${showExportGuide ? 'rotate-90' : ''}`}
          >
            <polyline points="9,18 15,12 9,6" />
          </svg>
          How to export your Discord group DM
        </button>

        {showExportGuide && (
          <div className="mt-3 p-4 rounded-xl bg-surface border border-[rgba(255,255,255,0.07)] animate-slide-up text-sm text-text-secondary space-y-2">
            <p>
              1. Download{' '}
              <a href="https://github.com/Tyrrrz/DiscordChatExporter" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                DiscordChatExporter
              </a>
            </p>
            <p>2. Get your Discord user token from browser DevTools → Network tab → Authorization header</p>
            <p>3. Open DiscordChatExporter, paste your token, select the group DM</p>
            <p>4. Export as <span className="font-mono text-text-primary">JSON</span> format</p>
            <p>5. Come back here, paste the path to the exported file, and click Import</p>
          </div>
        )}
      </div>

      {/* Danger Zone */}
      {status?.meilisearch && (
        <div className="mt-8">
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
        </div>
      )}

      {/* Footer */}
      <footer className="mt-12 text-center text-[10px] text-text-tertiary font-mono">
        Powered by ⚡ Meilisearch · 100% local
      </footer>
    </div>
  );
}
