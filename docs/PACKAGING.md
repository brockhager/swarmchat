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

Release automation
- The repository contains a sample GitHub Actions workflow `.github/workflows/release.yml` that builds packages on tag pushes (matching `v*`) across Windows/macOS/Linux.
- The workflow uploads the platform bundles as artifacts and then creates a GitHub Release with the produced installers.

Signing & notarization (secrets)
- The CI workflow supports publishing artifacts, but signing/notarization steps require platform-specific credentials. Add the following secrets to your repository settings for full signing support:
	- `WINDOWS_SIGNING_CERT` — base64-encoded PFX certificate for Windows code signing (or use OS-level signing tools).
	- `WINDOWS_SIGNING_PASSWORD` — password for the PFX certificate.
	- `MACOS_NOTARIZE_APPLE_ID` — Apple ID for notarization.
	- `MACOS_NOTARIZE_PASSWORD` — App-specific password for notarization (or use GitHub Actions Secrets Manager integration).

	Windows signing secrets
	- `WINDOWS_SIGN_CERT` — base64-encoded PFX certificate content for Windows code signing.
	- `WINDOWS_SIGN_CERT_PASSWORD` — password to unlock the PFX file.

	macOS notarization secrets (options)
	- API Key approach (recommended modern flow):
		- `APPLE_API_KEY` — base64-encoded `.p8` API key file for notarytool
		- `APPLE_API_KEY_ID` — the Key ID
		- `APPLE_API_ISSUER` — the Issuer ID (10-character team ID)

	- App-specific password (alternate / older flow):
		- `APPLE_ID` — Apple ID email address
		- `APPLE_APP_SPECIFIC_PASSWORD` — the app-specific password used with altool

	Note: the CI workflow's NOTARIZE steps will only run when the appropriate secrets are present. Keep secrets secure in GitHub repo settings and ensure they are set at the organization or repo level as needed.

Make sure these secrets are available to the CI environment and your chosen tauri-action or signing steps read them. The workflow will *not* include signing by default — you must add platform-specific signing steps where indicated in the CI pipeline and reference the secret names above.

Troubleshooting
- If the app fails to start or unbundle the sidecar, open devtools or stdout to inspect the path printed by Tauri: the app logs `starting dendrite from {path}` so you can confirm where it was resolved.

*** End of guidance
