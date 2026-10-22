# Athlete-Hub — User Testing Guide (Capstone Evaluation)

This guide prepares a moderated usability test of the Athlete-Hub web app: environment setup, participant
accounts, task scenarios for every role, what to measure, and the System Usability Scale (SUS) questionnaire.

---

## 1. Before the session (facilitator checklist)

| ✓ | Step |
|---|---|
| ☐ | MySQL is running and the API starts without errors (`dotnet run` in `backend/AthleteHub.API`). |
| ☐ | Fresh sample data: `dotnet run -- --seed-test-data` (wipes and recreates **only** seed data — run before each participant so everyone starts from the same state). |
| ☐ | Web app running: `npm install` then `npm run dev` in `web/` → open <http://localhost:5173>. |
| ☐ | Browser zoom at 100%, other tabs closed, notifications silenced. |
| ☐ | Screen and audio recording started (with the participant's written consent). |
| ☐ | Consent form signed; participant profile recorded (role, age range, device familiarity). |
| ☐ | Task cards printed (section 4), timer ready, observation sheet (section 6) ready. |

### Optional settings for test sessions

Create `web/.env.local`:

```bash
# One-click sign-in buttons for the seeded test accounts on the login page.
# Always on in `npm run dev`; set this only for a production build used in testing.
VITE_SHOW_TEST_ACCOUNTS=true

# Adds a "Give feedback" link to every portal's sidebar (and the phone account sheet) (e.g. a Google Form with the SUS questions below).
VITE_FEEDBACK_URL=https://forms.gle/your-form-id
```

> Remove both settings before any real deployment. The test-account buttons only work with seeded data.

### Testing on phones and tablets

Athlete-Hub is a responsive web app that can also be installed on a phone's home screen (a PWA).
The phone talks only to the web server on your PC, which forwards `/api` requests to the API, so the API
itself stays private on the PC.

**A. Same Wi-Fi (simplest, recommended for moderated sessions)**

1. Connect the PC and the phones to the **same Wi-Fi network**, and set that network to **Private** in Windows
   (Settings → Network & internet → Wi-Fi → your network → Private network).
2. Start the API as usual (`dotnet run`).
3. In `web/`, run **`npm run phone`**. This builds the app and serves it to the network on port **4173**.
   (`npm run dev:phone` does the same with the development server on port 5173.)
4. Find the PC's address: run `ipconfig` and use the **Wi-Fi** adapter's IPv4 address
   (ignore `192.168.56.x`, which belongs to VirtualBox).
5. On the phone, open **`http://<that address>:4173`**, e.g. `http://192.168.1.9:4173`.
6. If the phone cannot connect, allow Node.js through Windows Firewall when Windows asks, or run once in an
   **administrator** PowerShell:

   ```powershell
   netsh advfirewall firewall add rule name="Athlete-Hub (user testing)" dir=in action=allow protocol=TCP localport=4173,5173 profile=private
   ```

   Remove it after testing with `netsh advfirewall firewall delete rule name="Athlete-Hub (user testing)"`.

The one-click test-account buttons are hidden in `npm run phone` (a production build). To show them, add
`VITE_SHOW_TEST_ACCOUNTS=true` to `web/.env.local` and run `npm run phone` again.

**Installing on the home screen over Wi-Fi**

| Phone | What to do | Result |
|---|---|---|
| iPhone / iPad (Safari) | Share → **Add to Home Screen** (the app's *Install* button shows these steps) | Opens full screen with the Athlete-Hub icon |
| Android (Chrome) | ⋮ menu → **Add to Home screen** | A home-screen shortcut; it opens in a Chrome tab, because browsers only fully install apps served over **https** |

**B. Full install on any phone, any network (HTTPS tunnel)**

Browsers fully install web apps only from `https://` addresses. A free tunnel gives the app one temporarily:

1. Install [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) (`winget install Cloudflare.cloudflared`).
2. With the API and `npm run phone` running, run: `cloudflared tunnel --url http://localhost:4173`
3. Open the printed `https://….trycloudflare.com` address on the phone. Chrome and Edge show
   **Install app**; the login page also shows an **Install the app on this device** button.

> ⚠️ The tunnel address is reachable from the internet while it runs. Stop it (Ctrl+C) after each session,
> keep `VITE_SHOW_TEST_ACCOUNTS` **off** while tunnelling (otherwise anyone with the link gets one-click sign-in),
> and hand participants their credentials instead.

**C. Always-on hosted copy (unmoderated / remote testing)**

To let testers use the app any time without the facilitator's PC, host it in the cloud: see
[`DEPLOYMENT.md`](DEPLOYMENT.md).

---

## 2. Participant accounts

Password for every seeded account: **`Seed123!`** (full list in [`database/TEST_ACCOUNTS.md`](../database/TEST_ACCOUNTS.md)).

| Role | Account | Why this account |
|---|---|---|
| Coach (easy sign-in) | `coach1@athletehub.test`, `coach2@athletehub.test` | Each leads their own test team of ten students with two months of training history, results in four workouts, documents, and ten portfolio entries waiting for verification |
| Student-athlete (easy sign-in) | `student1@athletehub.test` … `student20@athletehub.test` | Odd numbers (1, 3, 5 … 19) are coached by coach1, even numbers (2, 4, 6 … 20) by coach2 |
| Student-athlete | `juan.delacruz@seed.athletehub.test` | Eligible, has upcoming training, verified + pending achievements |
| Student-athlete (new) | `bea.lim@seed.athletehub.test` | No team, mostly empty — tests first-time experience and the "Getting started" list |
| Coach | `maria.santos@seed.athletehub.test` | Blue Eagles Basketball; pending portfolio items, attendance to record |
| Sports Director | `elena.navarro@seed.athletehub.test` | Pending training approvals, coaches to manage |
| Registrar (hidden — cannot sign in) | `grace.tan@seed.athletehub.test` | Role switched off; grades now come from ICTD (Director → Grades) |
| Parent | `rosario.delacruz@seed.athletehub.test` | One child (Juan) |
| Parent (two children) | `roberto.aquino@seed.athletehub.test` | Kevin Aquino and Daniel Ramos |
| Administrator (hidden — cannot sign in) | `victor.lopez@seed.athletehub.test` | Role switched off; the Sports Director manages accounts (Director → Accounts) |

Bring a small PDF and a JPG on the test machine's Desktop for upload tasks.

---

## 3. Session script (≈ 30–40 minutes per participant)

1. **Welcome (2 min).** "We are testing the system, not you. There are no wrong answers. Please think aloud — say what you are looking for and what you expect to happen."
2. **Background (3 min).** Role, experience with school portals, devices used.
3. **Tasks (20–25 min).** Hand one task card at a time. Do not help unless the participant is stuck for 2 minutes or asks to skip; record that as an assist.
4. **SUS questionnaire (5 min).** Section 5.
5. **Debrief (5 min).** "What was easiest? Most confusing? What one thing would you change?"

The **Help** button (top-right, "?") explains each page. Note whether participants find and use it unprompted.

---

## 4. Task scenarios

Each task lists the starting point, the success criteria, and a target time for a first-time user.
Record: **Completed** (unaided / with assist / failed), **time**, **errors** (wrong clicks, wrong pages), **comments**.

### Student-athlete (`juan.delacruz` or `bea.lim`)

| # | Task given to participant | Success when… | Target |
|---|---|---|---|
| A1 | "Sign in to Athlete-Hub with the account on your card." | Dashboard is shown. | 1 min |
| A2 | "Find out when and where your next training session is." | Participant states the date, time, and location (dashboard card or Schedule → event details). | 1 min |
| A3 | "Upload your medical clearance (use the PDF on the Desktop)." | Document appears in **My documents**; success message shown (no approval needed). | 2 min |
| A4 | "Add your latest achievement — 1st place at the Intramurals — with the photo as proof." | Item appears under **Achievements & awards** as *Pending*. | 3 min |
| A5 | "Update your phone number to 0917 000 1234." | Profile shows the new number; "Profile saved" message. | 1 min |
| A6 | "Check whether you are academically eligible this semester." | Participant reads the eligibility status from the dashboard. | 1 min |
| A7 | "Read your unread notifications, then mark them all as read." | Bell badge clears. | 1 min |
| A8 | "Did your vertical jump improve in your latest training session? What is your best sprint time?" | Participant opens **Performance** and reads the change (▲/▼) and the best value. | 2 min |

### Coach (`maria.santos`)

| # | Task | Success when… | Target |
|---|---|---|---|
| C1 | "Request a team practice for your team next Tuesday and Thursday, 4–6 PM, at the gym." | Request shows *Awaiting approval* in the schedule. | 3 min |
| C2 | "Record attendance for the most recent training: everyone was present except one athlete who was late." | All active athletes marked; the late athlete is *Late*. | 3 min |
| C3 | "Juan Dela Cruz submitted a new achievement. Review and verify it." | Item status becomes *Verified*. | 2 min |
| C4 | "Record a vertical jump of 57 for Juan from the latest session, and see his progress." | New record in the table and on the chart. | 3 min |
| C5 | "Which of your athletes need attention, and why?" | Participant names at least one athlete and the reason (dashboard). | 1 min |

### Sports Director (`elena.navarro`)

| # | Task | Success when… | Target |
|---|---|---|---|
| D1 | "Approve one pending training request and reject another with a reason." | One session approved, one rejected with a reason. | 2 min |
| D2 | "Publish a competition: Inter-School Meet, two Saturdays from now, 8 AM, City Stadium." | Event appears on the calendar. | 3 min |
| D3 | "Assign Bea Lim to Coach Maria Santos's team." | Bea appears in Maria's roster. | 3 min |
| D4 | "How many athletes are currently ineligible? Open one of their profiles." | Participant gives the number and opens a profile. | 2 min |
| D5 | "Request a Grade Evaluation for Daniel Ramos for the Summer term of 2026-2027." | Request appears as *Under review / Pending* on his profile (All athletes → View profile). | 2 min |

### Registrar (`grace.tan`)

| # | Task | Success when… | Target |
|---|---|---|---|
| R1 | "Mark Villanueva's eligibility request is waiting for the Grade Evaluation. Upload the PDF." | Request shows *PDF uploaded*. | 2 min |
| R2 | "Record that Mark is ineligible because of failing grades, with a remark." | Decision listed under **Decisions** as *Ineligible*. | 2 min |
| R3 | "Find Kevin Aquino's latest evaluation and open the PDF." | PDF preview opens. | 2 min |

### Parent (`rosario.delacruz` / `roberto.aquino`)

| # | Task | Success when… | Target |
|---|---|---|---|
| P1 | "When is your child's next training?" | Participant states date and time. | 1 min |
| P2 | "Did your child attend the last training session?" | Participant reads the attendance status. | 1 min |
| P3 | (two children) "Show only Daniel's training sessions." | Child switcher set to Daniel. | 1 min |

### Administrator (`victor.lopez`)

| # | Task | Success when… | Target |
|---|---|---|---|
| M1 | "Create a coach account for Ana Lopez, ana.lopez@school.edu, University ID 2026-9001." | Account in the list, *Active*. | 3 min |
| M2 | "Create a parent account for Carla Lim (carla.lim@example.com), Bea Lim's mother. Bea's University ID is SEED-A-008." | Parent account shows "Parent of Bea Lim". | 3 min |
| M3 | "Ana Lopez is on leave. Stop her from signing in without deleting her account." | Status becomes *Suspended* or *Inactive*. | 2 min |
| M4 | "Reset the password of any athlete account." | "Account updated" message. | 2 min |

---

## 5. System Usability Scale (SUS)

Ask after all tasks. Each item is rated **1 = Strongly disagree … 5 = Strongly agree**.

| # | Statement |
|---|---|
| 1 | I think that I would like to use Athlete-Hub frequently. |
| 2 | I found Athlete-Hub unnecessarily complex. |
| 3 | I thought Athlete-Hub was easy to use. |
| 4 | I think that I would need the support of a technical person to be able to use Athlete-Hub. |
| 5 | I found the various functions in Athlete-Hub were well integrated. |
| 6 | I thought there was too much inconsistency in Athlete-Hub. |
| 7 | I would imagine that most people would learn to use Athlete-Hub very quickly. |
| 8 | I found Athlete-Hub very cumbersome to use. |
| 9 | I felt very confident using Athlete-Hub. |
| 10 | I needed to learn a lot of things before I could get going with Athlete-Hub. |

**Scoring.** For odd items subtract 1 from the rating; for even items subtract the rating from 5. Add the ten
results and multiply by **2.5** → a score from 0 to 100.

| SUS score | Interpretation |
|---|---|
| ≥ 80.3 | Excellent (grade A) |
| 68 – 80.2 | Good — above average |
| 68 | Average |
| 51 – 67 | OK / marginal — needs improvement |
| < 51 | Poor |

Report the mean, standard deviation, and per-role means.

---

## 6. Observation sheet (one per participant per task)

| Field | Value |
|---|---|
| Participant ID / role | |
| Task # | |
| Start – end time | |
| Outcome | Unaided ☐  With assist ☐  Failed ☐  Skipped ☐ |
| Errors (count + description) | |
| Used the Help button? | Yes ☐  No ☐ |
| Quotes / think-aloud notes | |
| Severity of any issue | 1 cosmetic · 2 minor · 3 major · 4 blocker |

### Metrics to report (ISO 9241-11)

- **Effectiveness:** task completion rate = completed unaided ÷ attempts, per task and per role.
- **Efficiency:** mean time on task versus the target time; error count per task.
- **Satisfaction:** SUS score; debrief comments grouped by theme.

---

## 7. Resetting between participants

1. Sign out (sidebar → **Sign out**; on a phone: tap your initials at the top right → **Sign out**).
2. Re-seed: `dotnet run -- --seed-test-data` in `backend/AthleteHub.API` (about 10 seconds).
3. Clear the browser's site data for `localhost:5173` so the "Getting started" list and saved sign-in reset.

---

## 8. Usability features to point out in the report

These were added to support first-time users and are worth evaluating explicitly:

- **Help on every page** — "?" button in the top bar with numbered steps and tips.
- **Getting-started checklist** on the student dashboard (profile, medical clearance, first achievement).
- **Confirmation messages** (toasts) after every save, upload, approval, and deletion.
- **Required fields marked with \*** and optional ones labelled "(optional)".
- **Forms protected from accidental closing** — clicking outside a form dialog no longer discards it.
- **Clickable summary cards** that open the related page.
- **Calendar day agenda** — select a day to list its events (usable on phones), plus a *Today* button.
- **Bulk attendance** — "Mark everyone else present" for coaches.
- **Unread filter** on notifications.
- **Clear account actions** — a labelled *More* menu instead of a drop-down list.
- **Session-expiry warning** five minutes before automatic sign-out.
- **Accessibility** — skip link, visible keyboard focus everywhere, page names in the browser tab, larger touch targets on phones and tablets.
- **Installable app (PWA)** — Athlete-Hub icon on the phone's home screen, opens full screen; an *Install* button appears where the browser supports it.
