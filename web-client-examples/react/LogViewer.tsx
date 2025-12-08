import React, { useEffect, useRef, useState } from 'react';
// When using Tauri, prefer the official event API
// npm/yarn: @tauri-apps/api
import { listen } from '@tauri-apps/api/event';

// Simple log line type with origin (stdout/stderr)
type LogLine = { origin: 'stdout' | 'stderr'; text: string; ts: number };

// Scroll-to-bottom helper
function useAutoScroll(deps: any[]) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.scrollTop = ref.current.scrollHeight;
  }, deps);
  return ref;
}

export default function LogViewer({ maxLines = 200 }: { maxLines?: number }) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const containerRef = useAutoScroll([lines]);

  useEffect(() => {
    // listen to dendrite stdout and stderr events and push into local state
    // listen returns an unlisten function you should call when component unmounts
    let unlistenStdout: () => Promise<void> | undefined;
    let unlistenStderr: () => Promise<void> | undefined;

    (async () => {
      try {
        unlistenStdout = await listen('dendrite-stdout', (event) => {
          const text = String(event.payload);
          setLines((prev) => {
            const next = [...prev, { origin: 'stdout', text, ts: Date.now() }];
            if (next.length > maxLines) next.splice(0, next.length - maxLines);
            return next;
          });
        });
      } catch (err) {
        /* not in Tauri runtime or failed to attach - ignore silently */
      }

      try {
        unlistenStderr = await listen('dendrite-stderr', (event) => {
          const text = String(event.payload);
          setLines((prev) => {
            const next = [...prev, { origin: 'stderr', text, ts: Date.now() }];
            if (next.length > maxLines) next.splice(0, next.length - maxLines);
            return next;
          });
        });
      } catch (err) {
        // not in Tauri runtime or failed to attach
      }
    })();

    return () => {
      // cleanup listeners when unmounting
      if (unlistenStdout) unlistenStdout();
      if (unlistenStderr) unlistenStderr();
    };
  }, [maxLines]);

  // Persist a copy of the logs to localStorage so other UI parts (NodeControl) can export them
  useEffect(() => {
    try {
      localStorage.setItem('swarmchat:dendrite_logs', JSON.stringify(lines.map(l => ({ origin: l.origin, text: l.text, ts: l.ts }))));
    } catch (_e) {
      // ignore localStorage failures
    }
  }, [lines]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '6px 8px', borderBottom: '1px solid rgba(0,0,0,.08)' }}>
        <strong>Dendrite Logs</strong>
      </div>

      <div
        ref={containerRef}
        style={{
          padding: 8,
          flex: 1,
          overflowY: 'auto',
          background: '#0b0f14',
          color: '#e6edf3',
          fontFamily: 'monospace',
          fontSize: 12,
          lineHeight: '1.4em',
        }}
        data-testid="dendrite-log-container"
      >
        {lines.length === 0 ? (
          <div style={{ color: '#8b98a5' }}>No logs yet — start the app to see Dendrite output.</div>
        ) : (
          lines.map((l, i) => (
            <div key={i} style={{ color: l.origin === 'stderr' ? '#ff6b6b' : '#9ae6b4' }}>
              <span style={{ opacity: 0.6, marginRight: 8 }}>[{new Date(l.ts).toLocaleTimeString()}]</span>
              {l.text}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
