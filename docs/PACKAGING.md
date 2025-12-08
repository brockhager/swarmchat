# Packaging SwarmChat (sidecar bundling)

This document explains the recommended packaging and stability checks to produce a single-download app that includes the Dendrite sidecar.

Key notes
- The Tauri app expects the Dendrite binary to be bundled under `resources/sidecar/dendrite` inside the app bundle (or `resources/dendrite`).
- Use `src-tauri/tauri.conf.json` to include the sidecar in `tauri.bundle.resources`.

Recommended build steps (local)
- Ensure you have installed the Tauri toolchain and native dependencies for your OS.
- Place platform-specific Dendrite binary files into `src-tauri/resources/sidecar/` before building.

Example commands (macOS / Linux / Windows using npm script hooks):

```
# dev: runs the frontend + tauri development environment
npm run dev

# build: creates the final OS-native bundles
npm run build
```

Release checklist
- Verify `src-tauri/tauri.conf.json` includes `resources": ["sidecar/dendrite"]` or the exact path used for your bundled sidecar.
- Build on each target platform (or CI matrix) to ensure the sidecar exists and starts correctly. The app prints the resolved sidecar path on launch for diagnostics.
- Test graceful shutdown sequences (CloseRequested) to ensure the sidecar process stops reliably.

CI notes
- Add build matrix targeting darwin, linux, windows if you publish release artifacts for multiple platforms.
- Ensure your CI step copies the platform-specific dendrite binary into `src-tauri/sidecar/` before invoking `tauri build`.

Troubleshooting
- If the app fails to start or unbundle the sidecar, open devtools or stdout to inspect the path printed by Tauri: the app logs `starting dendrite from {path}` so you can confirm where it was resolved.

*** End of guidance
