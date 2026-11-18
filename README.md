# Official Connect — PWA MVP

A mobile-first, local-first launcher for selected official WhatsApp groups and contacts. It is a standalone static PWA; no backend or build step is required.

## Included in this build
- Add, edit and delete official WhatsApp group entries
- Validate group invitation links against `https://chat.whatsapp.com/`
- Add, edit and delete important contacts
- Launch one-to-one chats using WhatsApp `wa.me` links
- Indian mobile number validation (10-digit number or 91 + 10 digits)
- Favourite groups and contacts
- Add, edit and delete private work notes
- Search groups, contacts and notes
- IndexedDB persistence on the current browser/device
- JSON export and restore
- Offline app shell via service worker
- PWA manifest with 192px and 512px install icons

## Run locally
A service worker requires localhost or HTTPS. From this directory run:

```bash
python -m http.server 8080
```

Open http://localhost:8080 in Chrome.

## Deploy
Upload the contents of this folder to any static HTTPS host (GitHub Pages, Netlify, or Firebase Hosting). If deploying to a subpath, keep all files together and preserve relative paths.

## Install on Android
Open the deployed HTTPS URL in Chrome, open the browser menu, and choose **Install app** or **Add to Home screen**. Exact wording varies by Chrome version.

## Data and privacy
- Groups, contacts, favourites and notes are stored in IndexedDB in this browser origin on this device.
- There is no account, server sync, analytics or remote database in this MVP.
- Export a JSON backup regularly. Clearing browser/site data can erase the local directory.
- Importing a backup replaces the existing local records after confirmation.
- Do not store Aadhaar numbers, passwords, bank details or other sensitive identifiers in notes.

## WhatsApp limitations
- This app does not read WhatsApp messages, notifications, status updates or group membership.
- It does not bypass WhatsApp's interface or hide personal chats inside WhatsApp.
- It launches a saved group invitation link or a one-to-one chat. WhatsApp must be installed and the user may need to confirm the destination or join a group.
- It is not a WhatsApp Business API client.

## Current scope
This is an MVP foundation, not a Play Store release. It has been syntax-checked and its archive contents verified. A full device/browser QA pass, accessibility audit and backup-restore test on Android should be completed before relying on it for official records.
