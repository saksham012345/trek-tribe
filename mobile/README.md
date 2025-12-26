# TrekkTribe Mobile (Expo)

A minimal React Native app for browsing organizers and viewing public profiles, powered by the same API.

## Quick Start

1. Install dependencies:

```bash
npm install -g expo
cd mobile
npm install
```

2. Set API base (optional):

```bash
# .env (Expo):
EXPO_PUBLIC_API_URL=https://trekktribe.onrender.com
```

3. Run:

```bash
npm run start
```

- Press `a` for Android emulator, `i` for iOS (macOS), or scan the QR in Expo Go.

## Screens

- OrganizerSearch: uses `/api/public/search/organizers`
- PublicProfile: uses `/api/public/:uniqueUrl`

## Notes

- Auth is not wired yet; add SecureStore for JWT if needed.
- Styling is kept simple; extend with UI libraries as desired.
