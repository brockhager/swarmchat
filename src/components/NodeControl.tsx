import React, { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import { save } from '@tauri-apps/api/dialog';
import { writeFile } from '@tauri-apps/api/fs';

const STATUS = {
  stopped: 'stopped',
  starting: 'starting',
  running: 'running',
  stopping: 'stopping',
  error: 'error',
} as const;

type DendriteStatus = {
  state: 'running' | 'stopped' | 'starting' | 'error' | string;
  pid?: number | null;
  uptime_seconds?: number | null;
  client_port?: number | null;
  error_message?: string | null;
};

export default function NodeControl() {
  const [status, setStatus] = useState<string>(STATUS.stopped);
  const [busy, setBusy] = useState(false);
  const [pid, setPid] = useState<number | null>(null);
  const [clientPort, setClientPort] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  // initial status probe
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const s = (await invoke('status_dendrite')) as DendriteStatus;
        if (!mounted) return;
        setStatus(s.state ?? STATUS.stopped);
        setPid(s.pid ?? null);
        setClientPort(s.client_port ?? null);
      } catch (err) {
        setStatus(STATUS.error);
      }
    })();

    return () => { mounted = false; };
  }, []);

  // Listen for logs and do lightweight heuristics to detect readiness/errors
  useEffect(() => {
    let unlistenOut: any;
    let unlistenErr: any;
    let unlistenPort: any;

    (async () => {
      try {
        unlistenOut = await listen('dendrite-stdout', (e: any) => {
          const text = String(e.payload || '');
          // heuristics: detect "server" or "listening" as ready
            if (/listening|ready|started|server listening/i.test(text)) {
              setStatus(STATUS.running);
          }
        });
      } catch (e) {
        // ignore when not running in Tauri
      }

      try {
        unlistenErr = await listen('dendrite-stderr', (e: any) => {
          const text = String(e.payload || '');
          // error heuristics
          if (/error|panic|failed|fatal/i.test(text)) {
            setStatus(STATUS.error);
          }
        });
      } catch (e) {
        // ignore
      }

      // listen for port detection event emitted by the backend
      try {
        unlistenPort = await listen('dendrite-port-detected', (e: any) => {
          const v = Number(e.payload);
          if (!Number.isNaN(v)) setClientPort(v);
        });
      } catch (_) {}
    })();

    return () => {
      if (unlistenOut) unlistenOut();
      if (unlistenErr) unlistenErr();
      if (unlistenPort) unlistenPort();
    };
  }, []);

  const color = useMemo(() => {
    switch (status) {
      case STATUS.running:
        return '#4caf50';
      case STATUS.starting:
        return '#f6c84c';
      case STATUS.stopping:
        return '#9aa4b2';
      case STATUS.error:
        return '#ff6b6b';
      default:
        return '#9aa4b2';
    }
  }, [status]);

  async function start() {
    if (busy) return;
    setBusy(true);
    setStatus(STATUS.starting);
    try {
      await invoke('start_dendrite');

      // poll status for short period
      const timeout = 5000;
      const interval = 300;
      const startAt = Date.now();
      while (Date.now() - startAt < timeout) {
        try {
          const s = (await invoke('status_dendrite')) as DendriteStatus;
          if (s?.state === 'running') {
            setStatus(STATUS.running);
            setPid(s.pid ?? null);
            setClientPort(s.client_port ?? null);
            setBusy(false);
            return;
          }
        } catch { }
        await new Promise((r) => setTimeout(r, interval));
      }
      setStatus(STATUS.error);
    } catch (err) {
      setStatus(STATUS.error);
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    if (busy) return;
    setBusy(true);
    setStatus(STATUS.stopping);
    try {
      await invoke('stop_dendrite');
      setStatus(STATUS.stopped);
      setPid(null);
      setClientPort(null);
    } catch (err) {
      setStatus(STATUS.error);
    } finally {
      setBusy(false);
    }
  }

  // Diagnostics export - reads persisted logs from localStorage (set by LogViewer)
  async function exportDiagnostics() {
    setExporting(true);
    try {
      let raw = null;
      try { raw = localStorage.getItem('swarmchat:dendrite_logs'); } catch (_) { raw = null; }

      const filename = `swarmchat_logs_${new Date().toISOString().replace(/[:.]/g,'-')}.txt`;

      // Compose readable text from saved JSON if present
      let contents = '';
      if (raw) {
        try {
          const arr = JSON.parse(raw) as Array<{ origin: string; text: string; ts: number }>;
          contents = arr.map(a => `[${new Date(a.ts).toLocaleString()}] ${a.origin.toUpperCase()}: ${a.text}`).join('\n');
        } catch (e) {
          contents = String(raw);
        }
      } else {
        contents = 'No captured logs available.';
      }

      // If Tauri dialog/fs APIs are available use them, otherwise fall back to browser download
      if ((window as any).__TAURI__) {
        // ask user where to save
        try {
          const path = await save({ defaultPath: filename });
          if (!path) return; // cancelled
          await writeFile({ path, contents });
        } catch (e) {
          // try to fallback to writing into a default filename if save fails
          await writeFile({ path: filename, contents });
        }
      } else {
        // Browser fallback - trigger download
        const blob = new Blob([contents], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error('failed to export logs', e);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 12, height: 12, borderRadius: 6, background: color }} />
        <div style={{ fontSize: 13, color: '#333', display: 'flex', gap: 8, alignItems: 'center' }}>
          {status}
          {pid ? (
            <div style={{ fontSize: 11, padding: '2px 6px', borderRadius: 8, background: '#eef5ff', color: '#0b3a66' }} title={`PID: ${pid}`}>
              PID {pid}
            </div>
          ) : null}
          {clientPort ? (
            <div style={{ fontSize: 11, padding: '2px 6px', borderRadius: 8, background: '#f0fff4', color: '#0b3a2f' }} title={`Port: ${clientPort}`}>
              Port {clientPort}
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button onClick={() => start()} disabled={busy || status === STATUS.running}>
          Start
        </button>
        <button onClick={() => stop()} disabled={busy || status === STATUS.stopped}>
          Stop
        </button>

        <button onClick={() => exportDiagnostics()} disabled={exporting} title="Export Dendrite logs to a file">
          {exporting ? 'Exporting…' : 'Export logs'}
        </button>
      </div>
    </div>
  );
}
