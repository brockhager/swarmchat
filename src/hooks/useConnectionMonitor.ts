import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';

export type DendriteStatus = {
  state: string; // 'running'|'stopped'|'starting'|'error'
  pid?: number | null;
  uptime_seconds?: number | null;
  client_port?: number | null;
  error_message?: string | null;
};

export default function useConnectionMonitor({
  pollInterval = 1000,
  requiredPort = true,
  timeout = 0,
}: { pollInterval?: number; requiredPort?: boolean; timeout?: number } = {}) {
  const mounted = useRef(true);
  const [status, setStatus] = useState<string>('unknown');
  const [pid, setPid] = useState<number | null>(null);
  const [clientPort, setClientPort] = useState<number | null>(null);
  const [uptime, setUptime] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [probing, setProbing] = useState(false);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    let startAt = Date.now();

    async function probe() {
      setProbing(true);
      try {
        const s = (await invoke('status_dendrite')) as DendriteStatus;
        if (!mounted.current) return;

        setStatus(s.state ?? 'unknown');
        setPid(s?.pid ?? null);
        setClientPort(s?.client_port ?? null);
        setUptime(s?.uptime_seconds ?? null);
        setErrorMessage(s?.error_message ?? null);

        const hasPort = s?.client_port != null;
        const isRunning = (s?.state ?? '').toLowerCase() === 'running';

        if (isRunning && (!requiredPort || hasPort)) {
          setReady(true);
          setProbing(false);
          return true;
        }

        return false;
      } catch (e: any) {
        if (!mounted.current) return false;
        setStatus('error');
        setErrorMessage(String(e?.message ?? e));
        return false;
      } finally {
        // continue polling if not ready
        if (!cancelled) setProbing(false);
      }
    }

    let polling = true;

    (async () => {
      // quick immediate check
      const ok = await probe();
      if (ok) return; // ready

      while (polling) {
        if (!mounted.current) break;
        // optional timeout handling
        if (timeout > 0 && Date.now() - startAt > timeout) break;
        await new Promise((r) => setTimeout(r, pollInterval));
        if (await probe()) break;
      }
    })();

    return () => {
      cancelled = true;
      polling = false;
      mounted.current = false;
    };
  }, [pollInterval, requiredPort, timeout]);

  // helper controls
  async function startNode() {
    try {
      setStatus('starting');
      await invoke('start_dendrite');
      // after starting, we will be polled by the ongoing effect
      return true;
    } catch (e) {
      setStatus('error');
      setErrorMessage(String((e as any)?.message ?? e));
      return false;
    }
  }

  async function stopNode() {
    try {
      setStatus('stopping');
      await invoke('stop_dendrite');
      // Give it a moment, effect will update state
      return true;
    } catch (e) {
      setStatus('error');
      setErrorMessage(String((e as any)?.message ?? e));
      return false;
    }
  }

  async function refreshStatus() {
    // fire a single probe and update states
    try {
      const s = (await invoke('status_dendrite')) as DendriteStatus;
      if (!mounted.current) return;
      setStatus(s.state ?? 'unknown');
      setPid(s?.pid ?? null);
      setClientPort(s?.client_port ?? null);
      setUptime(s?.uptime_seconds ?? null);
      setErrorMessage(s?.error_message ?? null);
      const hasPort = s?.client_port != null;
      const isRunning = (s?.state ?? '').toLowerCase() === 'running';
      setReady(isRunning && (!requiredPort || hasPort));
    } catch (e) {
      setStatus('error');
      setErrorMessage(String((e as any)?.message ?? e));
    }
  }

  return {
    ready,
    status,
    pid,
    clientPort,
    uptime,
    errorMessage,
    probing,
    startNode,
    stopNode,
    refreshStatus,
  } as const;
}
