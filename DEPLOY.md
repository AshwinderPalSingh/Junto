# Deploying Junto

## What you are deploying

Junto is **one Next.js app plus one PostgreSQL database**:

| Part | What it is | Where it runs |
|---|---|---|
| Frontend **and** backend | The Next.js server. It renders the pages *and* runs the server code (sign-in, plans, chat, live updates, photo uploads). They are the same service and deploy together. | An app host: Render, Vercel, or your own server |
| Database | PostgreSQL. It holds everything: accounts, plans, chats and profile photos. | Render Postgres, Neon, or the Docker Compose database |
| Email | Sends the 6-digit sign-in codes. | Your Gmail account (SMTP), or Resend |

There is no separate "backend server" to deploy.

> **Email is the one thing to get right.** Many hosts block outbound SMTP, which Gmail needs, on free
> or entry plans: Render's free instances, Railway below the Pro plan, and new DigitalOcean accounts.
> On those, sign-in codes never arrive. The options below avoid that.

---

## Before you start

1. **Put the code on GitHub.** In `~/Developer/junto`:

   ```bash
   git init && git add -A && git commit -m "Junto"
   ```

   Then create an empty repository on GitHub and push it (GitHub shows the two commands). `.env.local`
   is git-ignored, so your passwords stay on your machine.

2. **Keep these values ready.** They are in your `.env.local`:
   - `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` (your Gmail and app password)
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (push notifications)
   - `CRON_SECRET`
   - `ADMIN_EMAILS` (your Thapar address)

   Keep the same VAPID keys on the live site. If they change, people have to turn notifications on again.

---

## Option 1 (recommended): Render, everything in one place

App and database in one dashboard, Gmail works, and live chat stays connected because the server runs
all the time.

1. **Database.** On [render.com](https://render.com) click **New → Postgres**. Choose a region near your
   users (Singapore for India) and a paid plan, since the free database is temporary. When it's ready,
   copy the **Internal Database URL**.
2. **App.** Click **New → Web Service** and connect your GitHub repository.
   - **Runtime:** Docker (Render finds the `Dockerfile`).
   - **Region:** the same as the database.
   - **Instance type:** Starter or larger. Free instances block email and go to sleep after a few
     minutes, which breaks sign-in and live chat.
   - **Health check path:** `/api/health`
3. **Environment variables** (the web service's Environment tab):

   ```ini
   DATABASE_URL=<Internal Database URL from step 1>
   APP_URL=https://<your-service>.onrender.com
   ALLOWED_EMAIL_DOMAINS=thapar.edu
   ADMIN_EMAILS=<your thapar email>
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=<your gmail>
   SMTP_PASS=<app password>
   EMAIL_FROM=Junto <your gmail>
   VAPID_PUBLIC_KEY=<from .env.local>
   VAPID_PRIVATE_KEY=<from .env.local>
   VAPID_SUBJECT=mailto:<your gmail>
   CRON_SECRET=<from .env.local>
   ```

4. **Deploy.** The first build takes a few minutes. Tables are created automatically when the app starts.
5. **Your own domain (optional).** In **Settings → Custom Domains**, add e.g. `junto.yourdomain.com`,
   create the DNS record Render shows you, then update `APP_URL`. HTTPS is set up automatically.

Every `git push` to the main branch redeploys automatically.

---

## Option 2 (free): Vercel for the app + Neon for the database

Costs nothing for a student project, and Gmail works because Vercel allows ports 465 and 587. The
trade-off is that Vercel runs code in short-lived functions: live chat reconnects every few minutes
(you won't notice), and background jobs run only while people use the site.

1. **Database.** On [neon.tech](https://neon.tech) create a project in the Singapore region (or the one
   nearest your users). Copy the **direct** connection string, *not* the "pooled" one, so live updates
   work across servers. It ends with `?sslmode=require`.
2. **App.** On [vercel.com](https://vercel.com) click **Add New → Project** and import the GitHub
   repository. Vercel detects Next.js; keep the defaults. Do not set `BUILD_STANDALONE`.
3. **Environment variables.** Use the same list as Render above, plus:

   ```ini
   DATABASE_URL=<Neon direct connection string>
   APP_URL=https://<your-project>.vercel.app
   DATABASE_POOL_MAX=3
   ```

4. **Deploy.**
5. **Optional: reminders on time when the site is quiet.** Create a free job at
   [cron-job.org](https://cron-job.org) that calls `https://<your site>/api/cron/maintenance` every
   10 minutes with the header `Authorization: Bearer <CRON_SECRET>`.

---

## Option 3: your own server with Docker

For a VPS (Hetzner, DigitalOcean, AWS Lightsail…) with Docker installed:

```bash
git clone <your repository> junto && cd junto
cp .env.example .env    # fill in APP_URL, POSTGRES_PASSWORD, SMTP_*, VAPID_*, CRON_SECRET, ADMIN_EMAILS
docker compose up -d --build
```

This runs PostgreSQL 18 (data kept in a Docker volume) and the app on port 3000. Put
[Caddy](https://caddyserver.com) or nginx in front for HTTPS. With Caddy, the whole configuration is
one line: `junto.yourdomain.com { reverse_proxy localhost:3000 }`.

Most VPS providers block SMTP on new accounts, so use Resend for email (below).

---

## If your host blocks SMTP: send codes with Resend

1. Create an account at [resend.com](https://resend.com) and **verify a domain you own**, by adding the
   DNS records it shows. Without a domain, Resend only delivers to your own address.
2. Set `RESEND_API_KEY=<key>` and `EMAIL_FROM=Junto <login@yourdomain.com>`, and leave `SMTP_USER` and
   `SMTP_PASS` empty.

Resend sends over HTTPS, which no host blocks, and its free tier covers a campus pilot.

---

## After deploying: checklist

- [ ] `https://<your site>/api/health` shows `"status":"ok"`, `"database":"ok"` and `"email":"smtp"` (or
  `"resend"`). `"degraded"` means email isn't configured.
- [ ] Sign in with your Thapar email: the code arrives within a few seconds (check spam the first time).
- [ ] Finish setup on a phone and on a laptop as two accounts. Post a plan with one, join it with the
  other, accept, and chat: messages should appear instantly on both.
- [ ] In Settings, turn on notifications. This needs HTTPS, so it only works on the live site.
- [ ] On iPhone: Share → Add to Home Screen, then turn on notifications inside the installed app.

## Updating

Push to GitHub. Render and Vercel rebuild and redeploy automatically; with Docker, run
`git pull && docker compose up -d --build`. Database changes (migrations) are applied automatically when
the new version starts.

## Backups

The database holds everything, including photos. Render and Neon keep automatic backups on paid plans.
With Docker, schedule `docker compose exec db pg_dump -U junto junto > backup.sql`.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Sign-in says "Sign-in emails aren't set up" | `SMTP_USER`/`SMTP_PASS` (or `RESEND_API_KEY`) missing. Add them and redeploy. |
| Codes never arrive; logs show a connection timeout to smtp.gmail.com | The host blocks SMTP. Use a paid instance, or Resend. |
| "Gmail rejected the login" | Use a 16-character App Password, with 2-Step Verification on. |
| Live chat only updates after a refresh | `DATABASE_URL` is a *pooled* connection string. Use the direct one. |
| `Invalid environment configuration` at start-up | A variable has the wrong format (for example `APP_URL` must start with `https://`). |
