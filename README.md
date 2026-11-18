# Official Connect — Mobile PWA

A mobile-first, local-first launcher and privacy-focused workspace for official WhatsApp groups, contacts, and work notes. It is a standalone static PWA; no backend, framework, or build step is required.

## Key Features

### 1. ⚡ Smart WhatsApp Import & Extraction
- **Quick Paste / Forwarded Text Parser**: Paste raw WhatsApp invite messages, chat exports, or contact info; the app automatically regex-detects group invite links (`chat.whatsapp.com/…`) and mobile numbers (`+91`, 10-digit, `wa.me/…`).
- **Web Share Target (Android)**: Share group links or contacts directly from WhatsApp or any app to Official Connect using Android's native share menu.
- **vCard (.vcf) & Chat Transcript (.txt) Support**: Upload contact cards or exported chat logs for batch extraction.

### 2. 📝 Work Notes with Status & Color-Coding
- **Status Lifecycle**: Tag notes as `⏳ Unfinished`, `🔄 In Progress`, or `✅ Finished`.
- **One-Tap Status Cycling**: Click the status pill directly on any note card to advance its state.
- **Color Accent**: Border and badge color-coding (Amber, Blue, Emerald).
- **Status Filter Chips**: Real-time filter chips with live counts for quick filtering.

### 3. 🌙 Executive Slate Dark Mode
- Theme toggle (`🌙 / ☀️`) in the top navigation bar.
- High-contrast, OLED-friendly dark palette tailored for night review and battery saving.
- Auto-detects device system preference (`prefers-color-scheme`) and persists selection.

### 4. 📷 In-App Camera QR Code Scanner
- Built-in camera scanner with laser view-finder animation.
- Scans WhatsApp group invitation QR codes and contact QR codes directly from posters, circulars, or computer screens.
- Image file upload fallback for scanning QR codes from saved photos or screenshots.

### 5. 🔒 Privacy PIN & Device Biometrics App Lock
- Set an optional 4-digit security PIN to lock the app on launch.
- Supports WebAuthn biometric unlock (Fingerprint / Face ID).
- Tactile numpad with shake animation on invalid PIN attempts.

### 6. ✉️ Formal Message Dispatch
- Tap the message icon on any contact to launch WhatsApp with pre-filled official templates (e.g., *"Sharing updated report"*, *"Attending review meeting"*, *"Please acknowledge receipt"*).
- Supports composing custom official messages directly.

### 7. 🏢 Dynamic Department & Category Filter Chips
- Automatically extracts unique department tags from your groups and contacts.
- Horizontally scrolling filter chips with live count badges.

### 8. 📊 Excel & CSV Roster Import/Export
- Export Contacts or Groups to standard `.csv` spreadsheets.
- Import entire rosters from `.csv` files in seconds.

### 9. 📹 One-Tap Video Conference Launcher
- Automatically scans Work Notes and Group descriptions for VC links (**Google Meet**, **Zoom**, **Microsoft Teams**, **Cisco Webex**).
- Displays a prominent **"📹 Join [Platform] Meeting"** button for instant 1-tap entry.

### 10. 📱 Android Home-Screen App Shortcuts
- Long-press the home-screen app icon for native shortcuts:
  - ➕ *Add Group*
  - 👤 *Add Contact*
  - 📝 *New Note*
  - 📥 *Import WhatsApp*

---

## Run Locally
A service worker requires `localhost` or HTTPS. From this directory run:

```bash
python -m http.server 8080
```

Open `http://localhost:8080` in Chrome.

## Deployment
Automated GitHub Pages deployment workflow is configured at `.github/workflows/deploy.yml`. Pushes to `main` automatically deploy the app to:
`https://theketan2.github.io/official_connect/`

## Install on Android
1. Open the deployed HTTPS URL in Chrome.
2. Tap the browser menu (`⋮`) and select **Install app** or **Add to Home screen**.
3. Launch directly from your home screen as a standalone application.

## Data & Privacy
- All directory data, contacts, groups, and notes are stored exclusively in **IndexedDB** on this device.
- Zero tracking, analytics, or external database connections.
- Complete data ownership with JSON and CSV export/backup.
