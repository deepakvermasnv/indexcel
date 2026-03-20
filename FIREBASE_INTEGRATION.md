# Firebase Firestore integration guide

This repository does not currently include the existing Next.js app files, so the integration code was added as drop-in modules you can merge into your current project without changing the UI.

## 1. Install Firebase

```bash
npm install firebase
```

## 2. Add environment variables

Create `.env.local`:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## 3. Add Firebase initialization

Add `lib/firebase.js`.

- Handles Firebase app bootstrap.
- Exposes `auth`, `db`, and Google login helpers.
- Use `result.user.uid` as the `userId`.

## 4. Add Firestore sheet persistence

Add `lib/firestoreSheets.js`.

Firestore structure used:

```text
users/{userId}/sheets/{sheetId}
```

Each document stores:

- `name`
- `data`
- `createdAt`
- `updatedAt`

## 5. Merge the hook into your existing spreadsheet state

Add `hooks/useFirestoreSheets.js`, then connect it to your current page or spreadsheet container.

### Replace your local-only state with the hook

If your page currently looks roughly like this:

```jsx
const [sheets, setSheets] = useState([...]);
const [activeSheetId, setActiveSheetId] = useState(...);

function updateCell(rowId, columnId, value) {
  // existing local update logic
}
```

Replace that state wiring with:

```jsx
import { useFirestoreSheets } from '../hooks/useFirestoreSheets';

const {
  user,
  isLoading,
  sheets,
  activeSheet,
  activeSheetId,
  createSheet,
  switchSheet,
  renameSheet,
  updateCell,
} = useFirestoreSheets();
```

### Keep the UI unchanged

Do not change your grid or toolbar markup.

Just reconnect the existing props and handlers:

- Your grid should render from `activeSheet.data`.
- Your existing cell edit handler should call `updateCell(rowId, columnId, value)`.
- Your sheet tabs should render from `sheets`.
- Your sheet tab click handler should call `switchSheet(sheetId)`.
- Your add-sheet action should call `createSheet()`.
- Your rename-sheet action should call `renameSheet(sheetId, name)`.

## 6. Add Google sign-in to your existing auth entry point

In your current login button handler or auth bootstrap file:

```jsx
import { signInWithGoogle, signOutFromGoogle } from '../lib/firebase';

async function handleGoogleLogin() {
  await signInWithGoogle();
}

async function handleLogout() {
  await signOutFromGoogle();
}
```

You do not need to redesign the UI. Wire these functions into the buttons you already have.

## 7. How the autosave works

The hook already implements all required behavior:

- Detects edits through `updateCell` and `renameSheet`.
- Updates local React state immediately.
- Persists localStorage so the app still works offline.
- Debounces Firestore writes by 1 second.
- Saves only the active sheet to `users/{userId}/sheets/{sheetId}`.
- Loads remote sheets after Google auth succeeds.
- Falls back to localStorage when the user is signed out.

## 8. Where to connect loading into the grid

At the page/container level, wait for `isLoading` before rendering spreadsheet data:

```jsx
if (isLoading) {
  return <div>Loading...</div>;
}
```

After that, keep your existing spreadsheet UI exactly the same and pass `activeSheet.data` into it.

## 9. Optional migration note

If you already have localStorage-only sheets in production, sign in once and open each sheet.
The hook will autosave the active sheet to Firestore after the first edit.
If you want a full one-time migration, you can iterate over all local sheets and call `saveSheet(userId, sheet)` for each one after login.
