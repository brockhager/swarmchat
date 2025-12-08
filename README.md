# SwarmChat
A highly secure, decentralized, and serverless group chat platform built on the Matrix protocol, packaged with Tauri.

## Architecture

SwarmChat uses:
- **Tauri** (Rust) - Desktop application framework
- **Dendrite** (Go) - Matrix homeserver running as a sidecar process
- **Web Client** - Frontend interface

## Dendrite Sidecar

The application automatically starts a Dendrite binary as a Tauri sidecar process when launched. The Rust code in `src-tauri/src/main.rs` handles:

- Starting the Dendrite binary on app launch
- Logging stdout from Dendrite with `[Dendrite]` prefix
- Logging stderr from Dendrite with `[Dendrite Error]` prefix
- Handling process errors and termination

## Setup

### Prerequisites

- Rust toolchain
- Node.js and npm
- Tauri CLI: `npm install -g @tauri-apps/cli`

### Building

1. Place the Dendrite binary in `src-tauri/binaries/` (the binary should be named according to your target platform)
2. Build the application:
   ```bash
   npm install
   npm run tauri build
   ```

### Development

```bash
npm run tauri dev
```

## Configuration

The sidecar configuration is defined in `src-tauri/tauri.conf.json`:
- The Dendrite binary is configured as an external binary
- Shell sidecar permissions are enabled for the "dendrite" sidecar
