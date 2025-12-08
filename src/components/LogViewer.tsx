import React, { useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';

type LogLine = { origin: 'stdout' | 'stderr'; text: string; ts: number };

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
    let unlistenStdout: () => Promise<void> | undefined;
    let unlistenStderr: () => Promise<void> | undefined;

    (async () => {
      try {
        unlistenStdout = await listen('dendrite-stdout', (event: any) => {
          const text = String(event.payload);
          setLines((prev: LogLine[]) => {
            const next: LogLine[] = [...prev, { origin: 'stdout', text, ts: Date.now() }];
            if (next.length > maxLines) next.splice(0, next.length - maxLines);
            return next;
          });
        });
      } catch (_err) {}

      try {
        unlistenStderr = await listen('dendrite-stderr', (event: any) => {
          const text = String(event.payload);
          setLines((prev: LogLine[]) => {
            const next: LogLine[] = [...prev, { origin: 'stderr', text, ts: Date.now() }];
            if (next.length > maxLines) next.splice(0, next.length - maxLines);
            return next;
          });
        });
      } catch (_err) {}
    })();

    return () => {
      if (unlistenStdout) unlistenStdout();
      if (unlistenStderr) unlistenStderr();
    };
  }, [maxLines]);

  useEffect(() => {
    try {
      localStorage.setItem(
        'swarmchat:dendrite_logs',
        JSON.stringify(lines.map((l: LogLine) => ({ origin: l.origin, text: l.text, ts: l.ts })))
      );
    } catch (_e) {}
  }, [lines]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '6px 8px', borderBottom: '1px solid rgba(0,0,0,.08)' }}>
        <strong>Dendrite Logs</strong>
      </div>

      <div
        ref={containerRef}
        style={{ padding: 8, flex: 1, overflowY: 'auto', background: '#0b0f14', color: '#e6edf3', fontFamily: 'monospace', fontSize: 12, lineHeight: '1.4em' }}
        data-testid="dendrite-log-container"
      >
        {lines.length === 0 ? (
          <div style={{ color: '#8b98a5' }}>No logs yet — start the app to see Dendrite output.</div>
        ) : (
          lines.map((l: LogLine, i: number) => (
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
