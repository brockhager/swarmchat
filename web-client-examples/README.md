# Web client examples for SwarmChat

This folder contains small example frontends demonstrating how to consume the `dendrite-stdout` and `dendrite-stderr` events emitted by the Tauri sidecar.

Files:
- `react/LogViewer.tsx` — React + TypeScript component that listens to `dendrite-stdout` and `dendrite-stderr` using `@tauri-apps/api/event.listen`.
- `react/README.md` — quick usage for the React component.
- `vanilla/index.html` — small standalone HTML page showing how to use the Tauri event listener in vanilla JS.

Integration tips:
- In React, copy `LogViewer.tsx` into your component tree and add `@tauri-apps/api` to your project.
- In plain web pages, the `window.__TAURI__.event.listen` helper is available when running in the Tauri environment; otherwise use `@tauri-apps/api/event`.

You can style/extend these examples to include filtering, highlighting of error lines, search, saving logs, or uploading diagnostics for support workflows.
