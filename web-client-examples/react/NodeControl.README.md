# NodeControl (React)

This small React component provides a compact status indicator and Start/Stop controls for the Dendrite sidecar. It uses these Tauri commands (implemented in the backend):

- `status_dendrite` — now returns a structured JSON object with fields `{ state, pid, uptime_seconds, client_port, error_message }` for richer status reporting.
- `start_dendrite` — starts the sidecar if not already running.
- `stop_dendrite` — stops the sidecar if running.

Integration:

1. Copy `NodeControl.tsx` into your React app (e.g., `src/components/NodeControl.tsx`).
2. Make sure to install `@tauri-apps/api`:

```bash
npm install @tauri-apps/api
# or
yarn add @tauri-apps/api
```

3. Use the component:

```tsx
import NodeControl from './components/NodeControl';

function Header() {
  return (
    <div style={{ padding: 8 }}>
      <NodeControl />
    </div>
  );
}
```

Note: The component also listens for `dendrite-stdout` and `dendrite-stderr` log events and heuristically toggles `running` / `error` based on log keywords.
It also listens for `dendrite-port-detected` events and will show the detected client port when available.
 
Diagnostics export:

- The component now includes an "Export logs" button which writes the current captured logs (from `LogViewer.tsx`) to a file. It uses the Tauri `dialog.save` + `fs.writeFile` APIs when running inside the Tauri runtime, and falls back to a browser download when used in the browser.
- Logs are persisted locally in the browser under the key `swarmchat:dendrite_logs` so they can be exported even if you navigate away from the log view.
