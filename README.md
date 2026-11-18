# Official Connect — PWA MVP

A mobile-first, local-first launcher for selected official WhatsApp groups and contacts. It is a standalone static PWA; no backend or build step is required.

## Included in this build
- **Smart WhatsApp Import**: Paste forwarded WhatsApp messages, group invite links, or contact numbers; the app automatically detects and extracts them for batch or single import.
- **Web Share Target (Android)**: Share any group invite link or contact directly from WhatsApp or other apps into Official Connect via the native Android share menu.
- **vCard (.vcf) & Chat Export (.txt) Support**: Upload exported WhatsApp contact cards or chat transcripts to extract contacts and group links.
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
- This app does not silently read WhatsApp messages, notifications, status updates or group membership in the background due to operating system sandboxing.
- It extracts links and contacts shared by the user through Quick Paste, file upload, or the native Android Share sheet.
- It launches a saved group invitation link or a one-to-one chat. WhatsApp must be installed and the user may need to confirm the destination or join a group.
- It is not a WhatsApp Business API client.
