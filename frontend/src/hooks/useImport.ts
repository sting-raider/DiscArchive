import { useState, useCallback, useRef, useEffect } from 'react';
import { startImport } from '../lib/api';
import type { ImportProgress } from '../types/message';

interface UseImportReturn {
  filePath: string;
  setFilePath: (path: string) => void;
  isImporting: boolean;
  progress: ImportProgress['data'] | null;
  phase: string;
  logs: string[];
  error: string | null;
  isDone: boolean;
  doneData: { indexed?: number; skipped?: number; duration_s?: number } | null;
  startIngestion: () => void;
  cancel: () => void;
}

export function useImport(): UseImportReturn {
  const [filePath, setFilePath] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress['data'] | null>(null);
  const [phase, setPhase] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [doneData, setDoneData] = useState<{ indexed?: number; skipped?: number; duration_s?: number } | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev.slice(-19), msg]);
  }, []);

  const startIngestion = useCallback(() => {
    if (!filePath.trim()) return;

    setIsImporting(true);
    setProgress(null);
    setPhase('starting');
    setLogs([]);
    setError(null);
    setIsDone(false);
    setDoneData(null);

    addLog(`Starting import: ${filePath}`);

    const controller = startImport(
      filePath.trim(),
      (event) => {
        if (event.event === 'progress') {
          const data = event.data as ImportProgress['data'];
          setProgress(data);
          setPhase(data.phase || '');
          addLog(`${data.phase}: ${data.processed?.toLocaleString()} / ${data.total?.toLocaleString()} (${data.percent}%)`);
        } else if (event.event === 'done') {
          const data = event.data as ImportProgress['data'];
          setDoneData({
            indexed: data.indexed as number | undefined,
            skipped: data.skipped as number | undefined,
            duration_s: data.duration_s as number | undefined,
          });
          setIsDone(true);
          setPhase('done');
          addLog(`✅ Done! Indexed ${(data.indexed as number)?.toLocaleString()} messages in ${data.duration_s}s`);
        } else if (event.event === 'error') {
          setError(event.data.message as string || 'Unknown error');
          setIsImporting(false);
          addLog(`❌ Error: ${event.data.message}`);
        }
      },
      (err) => {
        setError(err.message);
        setIsImporting(false);
        addLog(`❌ Error: ${err.message}`);
      },
      () => {
        setIsImporting(false);
      },
    );

    controllerRef.current = controller;
  }, [filePath, addLog]);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    setIsImporting(false);
    setPhase('cancelled');
    addLog('Import cancelled');
  }, [addLog]);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  return {
    filePath, setFilePath,
    isImporting, progress, phase, logs, error, isDone, doneData,
    startIngestion, cancel,
  };
}
