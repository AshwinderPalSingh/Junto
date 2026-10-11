# Junto: your campus companion

**Find someone to do the next little thing with.** Junto is an activity-first companion network for the
Thapar community. Post "chai at 5?", or say you're free for an hour, and get matched with verified students
who are up for the same thing right now. The activity is the reason to meet; friendship is optional.

It is not a dating app: there's no swiping, plans are about the activity, and chats exist to sort out
plans. Everyone has one real profile photo, visible to signed-in members of the campus only.

---

## Run it locally

Requirements: **Node.js 20.12+** (use the arm64 build on Apple-silicon Macs) and **PostgreSQL 14+**.

```bash
npm install
npm run setup            # creates .env.local, generates Web Push keys and CRON_SECRET
```

Open `.env.local` and fill in:

1. **`DATABASE_URL`**: your Postgres database, e.g. `postgres://junto:password@localhost:5432/junto`.
2. **Gmail for sign-in codes** (see below): `SMTP_USER`, `SMTP_PASS` and `EMAIL_FROM`.
3. **`ADMIN_EMAILS`**: your own campus address, to get the moderator dashboard.

```bash
npm run db:migrate                         # create the tables (the server also does this on start)
npm run email:test -- you@thapar.edu       # check that Gmail accepts the login and delivers
npm run build && npm start                 # production server on http://localhost:3000
# or: npm run dev                          # development server with hot reload
```

There is no demo or seed data: every member, plan and photo is real.

### Gmail for sign-in codes

Junto signs people in with a 6-digit code sent by email. To send through a Gmail account:

1. Turn on **2-Step Verification** for the Google account.
2. Create an **App Password** at <https://myaccount.google.com/apppasswords>. Google shows a
   16-character password.
3. In `.env.local`:

   ```ini
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=yourname@gmail.com
   SMTP_PASS=abcdefghijklmnop        # the app password, spaces removed
   EMAIL_FROM=Junto <yourname@gmail.com>
   ```

4. Run `npm run email:test -- you@thapar.edu`, then restart the server.

A personal Gmail account can send about 500 emails a day. For more, any SMTP provider works with the same
variables (Google Workspace, Zoho, Amazon SES, Brevo…), or set `RESEND_API_KEY` to use
[Resend](https://resend.com) instead.

In `npm run dev` without email settings, codes are printed in the server terminal so you can still work
offline. A production server without email refuses to issue codes and reports `"email": "unconfigured"`
on `/api/health`.

---

## What it does

| Area | Features |
|---|---|
| **Verified access** | Only allowed campus domains (`@thapar.edu`). Sign in with **email + password** or a **one-time email code**. Creating an account and resetting a password both confirm the inbox with a code, and the new password only applies in the browser that chose it. Passwords are hashed with scrypt; 5 wrong tries pause password sign-in for 15 minutes; a reset or change signs out other devices. Codes are hashed, expire in 10 minutes, allow 5 tries, have a 30-second resend cooldown and are rate-limited per address and network. Sessions are database-backed httpOnly cookies. |
| **Profile** | Full name supplied by a connected university account, never guessed from the email address or entered manually. Until university OIDC is configured and connected, the display name is "Campus member". Year, department including Computer Science and Engineering and Faculty, up to 5 interests, vibe, short bio and **exactly one mandatory profile photo**: chosen, dropped, pasted or taken with the camera, then cropped in the browser and re-encoded on the server with location data stripped. Stored in Postgres and served only to onboarded members, with no browser caching. Gender is locked after setup. |
| **Private preferences** | Who you're comfortable meeting, and one-on-one versus groups. Never shown on any profile; used as hard filters in both directions. |
| **Board** | Plans happening soon and later, filters by activity, one-tap posting, "N people free right now", your upcoming meetups. |
| **Post a plan** | Activity, a public campus spot, now / +15 / +30 / +60 min / custom time, duration, 1–5 companions, who can join, a note and a live preview. |
| **I'm free** | Opt in for 30–120 minutes, optionally for certain activities. Matching plans notify you; nobody can browse a list of free people. |
| **Joining** | Ask with a short note. The host accepts or declines, and declines read as "not this time". Capacity, timing and mutual consent are re-checked under a row lock, so two people can't take the last spot. |
| **Chat** | A live group chat for every plan (host and confirmed guests, with one-tap updates like "On my way" and "I'm here"), direct messages started from a profile or plan, an inbox with unread badges, toasts and push notifications. Members choose who can start a chat with them (anyone they could meet, only people they've met, or nobody); blocks end chats both ways; report from any chat. |
| **Meetup space** | The group chat, an "I'm here" check-in that posts to it, and a read-only link to share with a trusted contact. |
| **Changing plans** | Leave or cancel with a reason. More than an hour's notice is fine, later is noted, and safety cancellations never count. |
| **Afterwards** | Private feedback on who showed up, whether you'd meet again, and private flags. Serious flags open a moderator report. |
| **Reliability & badges** | A five-point attendance rating appears after 3 confirmed outcomes. Declines, early cancellations and safety cancellations are neutral; late cancellations carry half the weight of a no-show. Reports need corroboration or moderator confirmation. Below 2.5 / 5, meetup and messaging access pauses for 48 hours; upcoming commitments are released without another penalty. The same incidents cannot restart an expired pause. Existing show-up statistics and badges remain. |
| **Safety** | Block (mutual invisibility), report (7 categories), public meeting points only, rate limits, no overlapping bookings, a safety centre. |
| **Live** | Server-Sent Events for instant updates and chat messages, fanned out between server instances with Postgres `LISTEN/NOTIFY`, and Web Push when the app is closed (installable PWA). |
| **Moderation** | Metrics (fulfilment, completion, repeat use, time to first request, new connections, reports per 100 meetups), reports queue, suspend/reinstate, photo review. |

Design: Thapar campus photography, pink/coral/lilac light-mode glass and darker translucent surfaces at night.
Both have fluid navigation, glass-in and scroll-reveal animations. Motion is reduced automatically for people who
ask for it. Run `npm run db:check` for a credential-safe connection, temporary read/write and migration check.

---

## Architecture: MVC on Next.js 16

The App Router is used purely as the **router**. Every screen and endpoint follows the same path:

```
 Browser ──► proxy.ts ──► app/ (Router) ──► controllers/ (Controller) ──► models/ (Model) ──► PostgreSQL
    ▲          cookie        URL → handler    auth · validation ·           data + business
    │          check         wiring only      authorisation · view models   rules (pure)
    └────────────────────────────── views/ (View) ◄──── view model (plain data)
                                     React UI: props in, UI out, never touches data
```

```
src/
├─ app/                    ROUTER: URLs only. Each page is <Suspense> → Controller → View
│  ├─ (auth)/login, login/verify, onboarding/
│  ├─ (app)/board, plans/new, plans/[id], activity, free, messages, messages/[id],
│  │        notifications, profile, profile/edit, u/[id], settings, admin/*
│  ├─ api/events (SSE), api/avatars/[userId] (private photos),
│  │  api/health, api/cron/maintenance
│  └─ s/[token] (trusted-contact link), safety, suspended
├─ controllers/            CONTROLLER
│  ├─ *.controller.ts      GET handlers: authenticate, load models, return a view model
│  ├─ *.actions.ts         POST handlers (Server Actions): authenticate, validate (Zod), call models
│  ├─ guards.ts            requireMember / requireAdmin
│  └─ presenters.ts        model → view model; applies privacy (no emails or private preferences)
├─ models/                 MODEL
│  ├─ db/schema.ts         Drizzle schema (16 tables), db/client.ts (pool, migrations, LISTEN)
│  ├─ *.model.ts           Plan, User, Auth, Chat, Availability, Notification, Feedback, Reputation…
│  ├─ rules/               pure business rules: compatibility, plan timing, chat, reliability
│  └─ maintenance.ts       sweep: expire, complete, reminders, feedback prompts
├─ views/                  VIEW
│  ├─ screens/             one folder per screen
│  ├─ components/, layouts/, ui/ (shadcn/ui on Radix)
│  └─ view-models.ts       the data contract each view declares
├─ lib/                    env, sessions, crypto, campus time, images, mail, Web Push, realtime
└─ config/                 campus catalogue and product rules (activities, spots, hours, limits)
```

- Views never import models or controllers. They get a view model and the actions they may call as props.
- Controllers stay thin. Business rules live in models; the pure ones in `models/rules/` are unit-tested.
- Every Server Action re-authenticates and re-authorises; ids from the client are only references.
- Pages render a static shell instantly and stream the personal parts (Cache Components / Partial
  Prerendering).

**Stack:** Next.js 16.4 (App Router, Cache Components, Server Actions, Turbopack, React Compiler) ·
React 19.3 · TypeScript · Tailwind CSS 4 · shadcn/ui · Motion · Drizzle ORM · PostgreSQL via postgres.js ·
Zod 4 · nodemailer · sharp · Web Push · Server-Sent Events · Vitest.

---

## Configuration

Every variable is described in `.env.example`.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `APP_URL` | yes in production | public origin, e.g. `https://junto.example.com` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | yes in production (or `RESEND_API_KEY`) | sign-in emails |
| `ALLOWED_EMAIL_DOMAINS` | no (`thapar.edu`) | who can sign up |
| `CAMPUS_IDENTITY_PROVIDER` | optional | `google` (Thapar's public MX records point to Google) or `microsoft` |
| `CAMPUS_OIDC_CLIENT_ID` | for profile names | university OIDC application's client ID |
| `CAMPUS_OIDC_CLIENT_SECRET` | for profile names | client secret, server-only |
| `CAMPUS_MICROSOFT_TENANT_ID` | Microsoft only | exact university tenant UUID; never a multi-tenant wildcard |
| `ADMIN_EMAILS` | no | who gets the moderator role on sign-in |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | no | Web Push (`npm run setup` generates the keys) |
| `CRON_SECRET` | no | protects `/api/cron/maintenance` |
| `DATABASE_POOL_MAX` | no (`10`) | connections per server instance |

Campus details are plain code in `src/config/`: activities, meeting spots, departments, interests, campus
hours and limits.

## Scripts

| Command | |
|---|---|
| `npm run dev` | development server with hot reload |
| `npm run build` / `npm start` | production build / server |
| `npm run setup` | create `.env.local` and generate secrets (never overwrites values) |
| `npm run db:migrate` | apply migrations to `DATABASE_URL` |
| `npm run db:generate` | create a migration after editing `src/models/db/schema.ts` |
| `npm run db:studio` | browse the database (Drizzle Studio) |
| `npm run email:test -- you@example.com` | verify the email settings and send a test |
| `npm test` | unit and model tests on an in-memory Postgres (PGlite) |
| `TEST_DATABASE_URL=postgres://localhost/postgres npm test` | the same tests on a real PostgreSQL server (each file gets a throwaway database) |
| `npm run check` | typecheck + lint + tests |
| `npm run icons` | regenerate the PWA icons and favicon |

---

## Deploying

Junto is one Next.js service (pages and server code together) plus a PostgreSQL database. **See
[DEPLOY.md](DEPLOY.md)** for step-by-step guides: Vercel + Neon (recommended and free; the live site runs
there), Render (always on, paid), or your own server with Docker. It also explains why some hosts block
Gmail's SMTP on free plans, and how to use Resend there.

### Operations

- `GET /api/health` returns `200` with `{status, database, email, push}` when the database is reachable,
  and `503` when it isn't. `status` is `degraded` when no email transport is configured.
- Migrations run automatically on start (and are safe to run from several instances). Run
  `npm run db:migrate` in CI if you prefer to migrate before deploying.
- With several instances built separately (for example during rolling deploys), set the same
  `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` on all of them.
- Back up the database: it holds everything, including profile photos and chats.
