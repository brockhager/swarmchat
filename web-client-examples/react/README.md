# React LogViewer (Tauri)

This small React component listens to the `dendrite-stdout` and `dendrite-stderr` events emitted by the Tauri backend and displays logs in a scrolling console view.

Usage (React, TypeScript):

1. Install the Tauri event API if not present:

```bash
npm install @tauri-apps/api
# or
yarn add @tauri-apps/api
```

2. Copy `LogViewer.tsx` into your React codebase (e.g., `src/components/LogViewer.tsx`).

3. Import and render the component where you want to show logs:

```tsx
import LogViewer from './components/LogViewer';

function App() {
  return (
    <div style={{ height: '400px', width: '100%' }}>
      <LogViewer maxLines={400} />
    </div>
  );
}
```

Notes:
- The component uses `@tauri-apps/api/event.listen` which returns an unlisten function. We handle cleanup on unmount.
- You can style the container any way your app needs; it's intentionally minimal.
- Use the emitted events (`dendrite-stdout`, `dendrite-stderr`) to show node status and errors to the user.

Controls & Status:
- There's also a companion `NodeControl.tsx` file in this folder which provides a compact status indicator and Start/Stop buttons using the `start_dendrite`, `stop_dendrite`, and `status_dendrite` commands implemented in `src-tauri/src/main.rs`.
