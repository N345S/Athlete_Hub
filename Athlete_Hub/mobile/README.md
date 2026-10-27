# Athlete-Hub mobile app (Expo)

The app reads the database through the ASP.NET API, never directly: the API checks the sign-in token and the
user's role, so each person sees only what the website would show them.

| Role | What the app shows |
|---|---|
| Student-athlete | Next training, coach evaluations to answer, verified achievements, documents on file, upcoming schedule, latest updates, own performance chart and results |
| Coach | Teams and athletes (with attendance), upcoming training, record a result for a finished session, each athlete's progress |
| Sports Director | All student-athletes (searchable), training waiting for approval, each athlete's progress |
| Parent | Linked children and their teams, the children's upcoming training, latest updates |
| Others | Latest updates |

Pull down on a dashboard to reload it. If the sign-in has expired, the app returns to the sign-in screen.

## Which server the app uses

1. **`EXPO_PUBLIC_API_BASE_URL`**, if set: copy `.env.example` to `.env.local` and put the address there, for
   example the hosted Railway address. This works on any phone, on any network.
2. **Expo Go on a phone** (same Wi-Fi as this computer): the app connects to this computer on port 5173, the web
   app's phone proxy. Start the API (`dotnet run` in `backend/AthleteHub.API`) and `npm run dev:phone` in `web/`.
3. **Emulator or simulator**: the API on this computer, `http://10.0.2.2:5007` (Android) or `http://localhost:5007`.

Restart `npx expo start` after changing `.env.local`.

## Run it

```
npm install
npx expo start
```
