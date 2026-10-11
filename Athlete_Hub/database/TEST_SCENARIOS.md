# Test scenario data

Development-only sample data for exercising account states, team changes, and every approval workflow.

```bash
cd Athlete_Hub/backend/AthleteHub.API
dotnet run -- --seed-test-data      # remove any earlier seed data, then create it fresh
dotnet run -- --remove-test-data    # delete only seed data
```

Both commands exit after running and refuse to run outside the Development environment. Seed records are
identified by the `@seed.athletehub.test` email domain and the `[Seed]` prefix on team and event names, so
removal never touches real data. Placeholder PDFs are written to `private-uploads/` with a `seed-` prefix.

Every seeded account uses the password **`Seed123!`**. Emails are `first.last@seed.athletehub.test`.
The seeder creates **104 accounts** — 1 director, 5 admins, 5 registrars, 10 coaches, 79 athletes, 4 parents — and writes
the complete list with each account's status and scenario to [TEST_ACCOUNTS.md](TEST_ACCOUNTS.md).

## Staff

| Account | Role | Scenario |
|---|---|---|
| `elena.navarro` | Director | The only director; approves training, assigns athletes, requests evaluations |
| `victor.lopez`, `carmen.dizon`, `oscar.salazar`, `irene.manalo` | Admin | Active administrators |
| `felix.ong` | Admin | **Inactive** — sign-in refused |
| `grace.tan` | Registrar | Uploaded and decided the seeded evaluations |
| `rosa.velasco`, `edwin.pascual`, `lyn.domingo` | Registrar | Active registrars |
| `noel.castro` | Registrar | **Suspended** — sign-in refused |

## Coaches

| Account | Scenario |
|---|---|
| `maria.santos` | Coaches **[Seed] Blue Eagles Basketball**; has a pending and a rejected training request |
| `ramon.cruz`, `arnel.gonzales`, `joy.ramirez`, `dennis.yap`, `cris.lacson`, `rhea.soriano` | Coach volleyball, football, badminton, table tennis, taekwondo, and swimming teams |
| `ben.alvarez` | **Suspended**; his **[Seed] Thunder Futsal** team stays active but gets no new sessions |
| `paolo.reyes` | **Inactive** account; his **[Seed] Sharks Swimming** team is disbanded (inactive) |
| `liza.mendoza` | Active coach with **no team** (assigning athletes to her is refused) |

## Parents

Parents have no University ID; each is linked to one or more athlete profiles and sees only those children's
approved training and attendance.

| Account | Linked children | What to check |
|---|---|---|
| `rosario.delacruz` | Juan Dela Cruz | Dashboard card with next practice and high attendance; unread attendance notification |
| `teresa.flores` | Jasmine Flores | Low attendance (17%) shown in red; absences in the attendance history |
| `roberto.aquino` | Kevin Aquino, Daniel Ramos | Child switcher on **Training sessions**; sessions from three teams |
| `nora.lim` | — | "No athletes linked yet" empty state; an admin can link Bea Lim (`SEED-A-008`) via **More → Link children** |

## Hand-made athlete scenarios

The other 69 athletes are generated across all eight teams with a mix of the same situations (see TEST_ACCOUNTS.md).

| Account | Scenario | What to check |
|---|---|---|
| `juan.delacruz` | Model athlete | Eligible both terms, verified + pending achievements, improving performance trend |
| `ana.reyes` | **Ineligible** (failing grades) | Rejected portfolio item with reason; warning on her dashboard |
| `mark.villanueva` | Evaluation **requested, no PDF yet** | Registrar "Eligibility requests" → upload PDF; pending documents and portfolio |
| `carla.bautista` | **Suspended** but still on the roster | Cannot sign in; coach cannot mark attendance or record performance |
| `miguel.torres` | **Inactive** (left school), removed from team | Cannot sign in; still visible to Director and Registrar with an "inactive" badge |
| `sofia.garcia` | **Quit** volleyball 20 days ago, still a student | Shows "No active team"; past attendance and verified achievement are kept |
| `daniel.ramos` | **Transferred** volleyball → basketball | Appears only under basketball now; history from both teams |
| `bea.lim` | New athlete, **no team** | Empty states everywhere; one pending medical clearance |
| `kevin.aquino` | Plays **two sports** | Shown once with both teams; PDF uploaded, awaiting Registrar decision |
| `jasmine.flores` | **Poor attendance**, eligibility restored | Ineligible 1st semester → eligible 2nd semester; 17% attendance |

Also seeded: past/upcoming/pending/rejected training sessions for each team, attendance with every status,
performance records, upcoming competitions and events, and unread notifications for staff, athletes, and parents.

To test a live status change, sign in as any seed athlete, then have an admin set that account to
Suspended: the athlete's next action signs them out.
