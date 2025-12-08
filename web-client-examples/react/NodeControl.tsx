import React, { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';

const STATUS = {
  stopped: 'stopped',
  starting: 'starting',
  running: 'running',
  stopping: 'stopping',
  error: 'error',
} as const;

export default function NodeControl() {
  const [status, setStatus] = useState<string>(STATUS.stopped);
  const [busy, setBusy] = useState(false);

  // initial status probe
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const s = (await invoke('status_dendrite')) as string;
        if (!mounted) return;
        setStatus(s === 'running' ? STATUS.running : STATUS.stopped);
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

    (async () => {
      try {
        unlistenOut = await listen('dendrite-stdout', (e) => {
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
        unlistenErr = await listen('dendrite-stderr', (e) => {
          const text = String(e.payload || '');
          // error heuristics
          if (/error|panic|failed|fatal/i.test(text)) {
            setStatus(STATUS.error);
          }
        });
      } catch (e) {
        // ignore
      }
    })();

    return () => {
      if (unlistenOut) unlistenOut();
      if (unlistenErr) unlistenErr();
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
          const s = (await invoke('status_dendrite')) as string;
          if (s === 'running') {
            setStatus(STATUS.running);
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
    } catch (err) {
      setStatus(STATUS.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 12, height: 12, borderRadius: 6, background: color }} />
        <div style={{ fontSize: 13, color: '#333' }}>{status}</div>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => start()} disabled={busy || status === STATUS.running}>
          Start
        </button>
        <button onClick={() => stop()} disabled={busy || status === STATUS.stopped}>
          Stop
        </button>
      </div>
    </div>
  );
}
