# TaskBoard — Creative Ops Dashboard

A daily operations dashboard for a creative team: today's tasks, team bandwidth, and an automatic end-of-day report built from time logged on tasks.

Plain HTML, CSS and JavaScript. No build step, no dependencies.

## What works today

Every view in the sidebar works. Each one has its own URL (`#/tasks`, `#/analytics`, and so on), so you can bookmark it.

- **Today**: summary cards, today's tasks, team bandwidth and the live daily report.
- **Tasks**: every task, with filters for status, brand, person and project, plus sorting. You can edit, delete and log time on any task. Click a task name to edit it.
- **Projects**: group tasks by campaign. Each project shows progress, hours logged against the estimate, and who's working on it. Projects can be archived.
- **Brands**: open work, tasks finished this week and hours logged this week for each brand. You can add brands, and remove ones that aren't in use.
- **Bandwidth**: each person's load this week: tasks, other work booked outside TaskBoard, and the gap between hours allocated and their capacity.
- **Daily Reports**: the report for any past day, including what each person worked on. It can be exported as CSV.
- **Time Logs**: every time entry, filtered by period and person. You can add entries for a chosen date and note, delete them, or export them as CSV.
- **Analytics**: hours per day, hours by brand and by person, on-time delivery, and estimated vs actual hours for completed tasks, over 7, 14 or 30 days.
- **Notifications**: things that need attention (blocked, overdue, due today and not started, over capacity, missing updates) and an activity feed. The bell shows how many items need attention.
- **Settings**: your name, the team name, team members and their weekly capacity, and JSON backup export and import.
- Marking a task **Blocked** asks for the reason. Logging time on a To Do task moves it to In Progress.
- **Search** in the top bar filters Today, Tasks and Time Logs.
- Works on phones: the sidebar becomes a menu.
- **Two modes:**
  - **Demo mode** (the default): data is saved in this browser only and stays in sync across open tabs. Data saved by the first version is upgraded automatically.
  - **Team mode**: once Supabase is connected (see below), everyone signs in with their work email and shares the same data, with live updates.

## Team mode (Supabase)

In team mode there are two kinds of access:

| | Manager | Team member |
|---|---|---|
| See everything | ✓ | ✓ |
| Change status and log time on **their own** tasks | ✓ | ✓ |
| Assign, edit and delete tasks; projects, brands, team, settings, import | ✓ | |

The database enforces these rules itself (row level security in `supabase/schema.sql`), not just the page.

### Setup (about 10 minutes)

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste the whole of `supabase/schema.sql` and click **Run**. It's safe to run again later.
3. Add yourself as the first manager. The last lines of `schema.sql` show how: fill in your name and email, then run just that `insert`.
4. Go to **Authentication → URL Configuration**:
   - Set **Site URL** to your Vercel address, e.g. `https://taskboard-<something>.vercel.app/`.
   - Add the same address, and `http://localhost:8000/` for local testing, under **Redirect URLs**. If you want sign-in to work on pull request previews too, also add `https://*-<your-vercel-team>.vercel.app/**`.
5. Go to **Project Settings → API**. Copy the **Project URL** and the **anon public** key into `js/config.js`, then commit and push. The anon key is meant to be public, because the database's rules protect the data.
6. Open the site and sign in with your email. You'll get a sign-in link.
7. In **Settings → Team members**, give each person a sign-in email, and make any other managers. They can sign in as soon as their email is there.

**Moving your demo data across:** before connecting, use **Settings → Export backup** in demo mode. After signing in as a manager, use **Settings → Import backup**. It adds and updates tasks, projects, brands, people and time logs, and never deletes anything.

Supabase's built-in email sender is limited to a few emails an hour. That's fine for trying it out, but for the whole team, set up your own email sender (SMTP) under **Authentication → Emails**.


## Run locally

Open `index.html` in a browser. Or serve the folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploy with Vercel

The site is plain static files, so Vercel serves it as-is with no build step. `vercel.json` adds a few security headers.

One-time setup:

1. Sign in at [vercel.com](https://vercel.com) with GitHub.
2. Click **Add New → Project**, pick **unatti-rox/TaskBoard** and click **Import**.
3. Leave **Framework Preset** as **Other**, with no build command and the output directory left empty. Click **Deploy**.

After that:

- Every push to `main` goes live automatically.
- Every pull request gets its own preview link.
- The live address is shown on the project page, e.g. `https://taskboard-<something>.vercel.app`. You can add your own domain under **Settings → Domains**.

## Project structure

```
index.html              Page layout and modal
css/styles.css          All styles
js/config.js            Supabase URL and key (empty = demo mode)
js/utils.js             Date, formatting, escaping and download helpers
js/data.js              Demo data (replace with an API later)
js/cloud.js             Supabase sign-in, loading, saving and live updates
js/store.js             State, saving, migrations, permissions, derived numbers and all data changes
js/ui.js                Toast and the reusable form modal
js/views.js             One render function per view, plus the forms
js/app.js               Routing, top bar and wiring clicks to actions
vercel.json             Vercel hosting settings (security headers)
supabase/schema.sql     Database tables, access rules and live updates for team mode
```

## Roadmap

- Email and WhatsApp notifications when tasks are assigned
- Daily reminder for people who haven't logged time
- Bandwidth history for past weeks
