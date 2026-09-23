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
- Data is saved in the browser (localStorage) and stays in sync across open tabs. Data saved by the first version is upgraded automatically.

## Run locally

Open `index.html` in a browser. Or serve the folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploy with GitHub Pages

1. Push this repo to GitHub (see below).
2. In the repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Every push to `main` deploys automatically (live at https://unatti-rox.github.io/TaskBoard/) via `.github/workflows/deploy.yml`. The live URL appears in the **Actions** tab.

## Project structure

```
index.html              Page layout and modal
css/styles.css          All styles
js/utils.js             Date, formatting, escaping and download helpers
js/data.js              Demo data (replace with an API later)
js/store.js             State, saving, migrations, derived numbers and all data changes
js/ui.js                Toast and the reusable form modal
js/views.js             One render function per view, plus the forms
js/app.js               Routing, top bar and wiring clicks to actions
.github/workflows/      GitHub Pages deployment
```

## Roadmap

- Backend and database so the whole team shares one source of truth (currently each browser keeps its own data)
- Login and roles (manager vs team member)
- Email and WhatsApp notifications when tasks are assigned
- Actually sending notifications (the Notifications view only shows alerts inside the app)
- Bandwidth history for past weeks
