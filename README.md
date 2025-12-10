# SwarmChat — Simple, Private Matrix Chat on Your Machine 🚀

Thank you for trying SwarmChat! This guide is for non-technical users who want a single, tiny download that gets them chatting right away.

The app bundles everything you need into one platform-specific installer — just download, install, and go.

---

## 🚀 Get Started (The 1-Click Install)

SwarmChat is distributed as a single small installer for each platform: a `.dmg` for macOS, a single `.exe` installer for Windows, and an `AppImage` for Linux.

### Download installers (v0.1.6)

If you want to download installers immediately, go to latest release page. 

> NOTE: These files are temporary placeholder installers in the repo for immediate downloads and are not functional installers. To generate fully working installers that include the real Dendrite sidecar, please provide the real Windows sidecar binary (dendrite.exe) or configure CI to fetch it (repo secret `SIDECAR_URL`).

1. Open the project's GitHub Releases page: https://github.com/brockhager/swarmchat/releases
2. Find the latest release and download the file that matches your operating system (.dmg, `.exe`, or AppImage).
3. Run the downloaded file and follow the standard prompt to install SwarmChat.

That's it — one download, one install. No extra servers, no manual configuration.

---

## 🛠️ Post-Install Setup (First Run — 30 seconds)

SwarmChat is designed to be used immediately after installation. Follow these three simple steps after launching the app for the first time:

1. Launch the App — open SwarmChat from your Applications (macOS), Start Menu (Windows), or AppLauncher (Linux).
2. Start your local node — click the **Start Node** button in the header (NodeControl). The node runs locally on your machine to keep your data private.
3. Sign up or Log in — use the **Sign Up** or **Log In** form in the top-right (AuthForm). You only need a username and password — no email required.

Within ~30 seconds of completing those steps you'll be able to join rooms and start sending messages.

---

## 💡 Core Features (Why this is different)

- **Single-file installer** — a single small download installs both the UI and a local node (no extra downloads or cloud setup).
- **Local, decentralized node** — SwarmChat runs a Dendrite node locally inside the app so you own your data and the network connection is direct.
- **No email required** — sign up with a username and password only for quick access and improved privacy.
- **Block & Mute controls** — manage who you see and hear from with per-user block and mute settings that are synced across your devices.

---

## 🔗 Diagnostics & Support

If you hit an issue, the app includes an easy way to gather helpful diagnostics so support can investigate quickly.

How to export logs:

1. Click the **Export Logs** button in the header under NodeControl.
2. The app will save a small ZIP file containing logs and a short diagnostic summary to your Downloads folder (or whatever your OS uses for saves).
3. Attach that ZIP file to a support request and send it to the maintainers (for example, open an issue on the GitHub repo at https://github.com/brockhager/swarmchat/issues or email the support address if provided in the release notes).

What to include in your support message:

- A short description of what you were trying to do.
- The exact installer version (the filename from the Releases page).
- The exported log ZIP file attached.

---

## ✅ Quick tips

- If your node does not start, try restarting the app and then use the **Start Node** button again.
- For faster support, include the exact release file name and the exported logs ZIP.
- If you prefer to run your own Matrix homeserver elsewhere, advanced options are available in Settings — this is optional.

---

If you'd like more technical information (developer docs, packaging, or CI details), see the `docs/PACKAGING.md` file in the repository.

Enjoy SwarmChat — private, simple, and ready to use. 🎉
