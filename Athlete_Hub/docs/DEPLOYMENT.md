# Hosting Athlete-Hub for remote testing

This puts Athlete-Hub on a permanent `https://` address that testers can open any time, from any network,
without the facilitator's PC being on. Phones can install it from that address as an app.

The `Dockerfile` at the repository root builds **one container** that serves both the web app and the API from
the same address (so no CORS or proxy setup is needed). It needs, from the host:

- a **MySQL database** (8.0 or newer),
- a **persistent volume** mounted at `/app/private-uploads` (uploaded documents and grade evaluations),
- a few **environment variables** (below).

The steps use [Railway](https://railway.com), which provides all three in one project. Any host that runs a
Dockerfile, offers MySQL, and supports a persistent disk works the same way.

> **Cost.** Railway gives new accounts a one-time trial credit; after that the Hobby plan is about US$5/month,
> which covers a small app and database used for testing. Delete the project after the evaluation to stop charges.

---

## 1. Create the project

1. Push this repository (with the `Dockerfile`) to GitHub.
2. In Railway: **New Project → Deploy from GitHub repo** → choose `Athlete_Hub`. Railway finds the root
   `Dockerfile` automatically. In the service's **Settings → Source**, pick the branch to deploy.
   The first build will fail until the variables below are set — that is expected.
3. In the same project: **+ Create → Database → MySQL**. Railway names it `MySQL`.

## 2. Attach a volume for uploads

On the app service: **right-click → Attach volume** (or Settings → Volumes) with mount path:

```
/app/private-uploads
```

Without it, every uploaded file disappears on each redeploy.

## 3. Set the variables

On the app service → **Variables** → **Raw Editor**, paste and adjust:

```bash
ConnectionStrings__DefaultConnection=Server=${{MySQL.MYSQLHOST}};Port=${{MySQL.MYSQLPORT}};Database=${{MySQL.MYSQLDATABASE}};User=${{MySQL.MYSQLUSER}};Password=${{MySQL.MYSQLPASSWORD}};
Jwt__Key=<a random string of at least 64 characters>
App__SeedTestDataIfEmpty=true
AllowedHosts=*
```

| Variable | Purpose |
|---|---|
| `ConnectionStrings__DefaultConnection` | Database connection. The `${{MySQL.…}}` references are filled in by Railway. |
| `Jwt__Key` | Signs sign-in tokens. Generate one, e.g. in PowerShell: `[Convert]::ToBase64String((1..48 \| % { Get-Random -Max 256 }))`. Never reuse the development key. |
| `App__SeedTestDataIfEmpty` | `true` creates the test accounts from `database/TEST_ACCOUNTS.md` (password `Seed123!`) on the first start. Later starts keep testers' changes. |
| `AllowedHosts` | Host names the API answers to. After step 4, replace `*` with the generated domain, e.g. `athletehub-production.up.railway.app`. |
| `VITE_FEEDBACK_URL` *(optional)* | Adds a "Give feedback" link to every portal (e.g. a Google Form with the SUS questions). Build-time: redeploy after changing it. |
| `VITE_SHOW_TEST_ACCOUNTS` *(optional)* | `true` shows one-click sign-in buttons. **Leave it off** on a public address — anyone with the link could sign in as any role. |

`App__BehindProxy=true` and `ASPNETCORE_ENVIRONMENT=Production` are already set in the Dockerfile. The listening port
comes from Railway's `PORT` variable automatically.

## 4. Get the address

App service → **Settings → Networking → Generate Domain**. Railway shows an address like
`https://athletehub-production.up.railway.app`. Put that host name (without `https://`) in `AllowedHosts`.

Railway redeploys after variable changes. When the deploy log shows `Now listening on`, open the address and
sign in with an account from section 2 of `USER_TESTING_GUIDE.md`.

---

## Running the test

- Send each tester the address and **their own** account (email + `Seed123!`) rather than enabling the
  one-click buttons. Giving each tester a different account keeps their changes from colliding.
- On Android (Chrome/Edge) the browser offers **Install app**; on iPhone use Share → **Add to Home Screen**.
- Deploying a new commit to the selected branch updates the app; the database and uploads are kept.

## Resetting the test data

Railway's MySQL service → **Settings → Networking** shows a public TCP address. From your PC:

```powershell
cd backend\AthleteHub.API
$env:ConnectionStrings__DefaultConnection = "Server=<public host>;Port=<public port>;Database=railway;User=root;Password=<MYSQLPASSWORD>;"
dotnet run -- --remove-test-data
Remove-Item Env:ConnectionStrings__DefaultConnection
```

Then **Redeploy** the app service: with the seed accounts gone, it creates them again on start.

## Troubleshooting

| Symptom | Cause |
|---|---|
| Deploy log: `Access denied` / `Unable to connect` | `ConnectionStrings__DefaultConnection` is wrong, or the MySQL service is not named `MySQL` (adjust the `${{…}}` references). |
| Browser shows **HTTP 400 – Invalid Hostname** | `AllowedHosts` does not match the address. |
| Everyone is signed out after a redeploy | `Jwt__Key` changed. Keep it fixed. |
| Uploaded files are missing after a redeploy | The volume is not mounted at `/app/private-uploads`. |
| Sign-in says "Too many attempts" for everyone | The login limit (10/minute per device) sees all testers as one address: the host adds more than one proxy hop. Raise `ForwardLimit` in the `App:BehindProxy` block of `Program.cs`. |
