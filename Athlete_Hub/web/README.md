# Athlete-Hub web app

React 19 + Vite front end for Athlete-Hub. Each role (student-athlete, coach, sports director, registrar,
parent, administrator) gets its own portal; portals are loaded on demand after sign-in.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173 (expects the API on http://localhost:5007)
npm run lint       # oxlint
npm run build      # production build in dist/
npm run phone      # build, then serve it to phones on the same Wi-Fi (http://<PC Wi-Fi IP>:4173)
npm run dev:phone  # dev server reachable from phones (http://<PC Wi-Fi IP>:5173)
```

The web server forwards `/api/...` to the .NET API on `http://localhost:5007` (see `vite.config.js`;
override with the `ATHLETEHUB_API_URL` environment variable), so phones only need to reach this one address.

## Installable app (PWA)

`public/manifest.webmanifest`, the icons in `public/icons/`, and the service worker `public/sw.js` let people add
Athlete-Hub to their home screen. The service worker caches only the app's own files — never `/api` responses —
and is registered only in production builds served over https or localhost. Full installation from a phone
needs https; see "Testing on phones and tablets" in the user-testing guide.

## Phone layout

On screens up to 760px wide the portals switch to an app-style layout instead of a shrunken website:
a maroon app bar (logo, help, notifications, avatar → account sheet), a bottom tab bar (nav items' optional
`shortLabel` is used there), dialogs that slide up as bottom sheets, action menus shown as action sheets,
and tables shown as lists of cards. Tables need no extra markup: `AppLayout` labels each cell with its
column header. The styles are in the "Phone layout" section at the end of `src/styles.css`.

## Settings (`.env.local`)

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | API address for builds served without the Vite proxy (e.g. a separate web host). Leave unset locally: requests go to `/api` on the same address and are forwarded to the API. |
| `VITE_SHOW_TEST_ACCOUNTS` | `true` shows one-click sign-in buttons for the demo accounts on the login page. Always shown in `npm run dev`; hidden in production builds unless set. |
| `VITE_FEEDBACK_URL` | Adds a "Give feedback" link to every portal's sidebar, e.g. a survey used during user testing. |

## Where things live

| Path | Contents |
|---|---|
| `src/components/ui.jsx` | Shared building blocks: cards, fields (with required/optional markers), modals, action menu, help dialog |
| `src/components/toast.jsx` | Confirmation messages (`useToast().success(...)`) |
| `src/components/AppLayout.jsx` | Portal shell: sidebar, top bar with Help and notifications |
| `src/lib/help.js` | The "How to use this page" text for every portal page |
| `src/features/<role>/` | One folder per portal |
| `src/styles.css` | Design tokens (top of file) and all styles |

User-testing preparation (accounts, task scenarios, SUS questionnaire) is in
[`../docs/USER_TESTING_GUIDE.md`](../docs/USER_TESTING_GUIDE.md).
