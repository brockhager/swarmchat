# NodeControl (React)

This small React component provides a compact status indicator and Start/Stop controls for the Dendrite sidecar. It uses these Tauri commands (implemented in the backend):

- `status_dendrite` — returns `"running"` or `"stopped"` depending on whether the sidecar is currently running.
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
