# TaskBoard — Creative Ops Dashboard

A daily operations dashboard for a creative team: today's tasks, team bandwidth, and an automatic end-of-day report built from time logged on tasks.

Plain HTML, CSS and JavaScript. No build step, no dependencies.

## What works today

- **Assign tasks** with brand, assignee, estimate, deadline and priority. The assignee's bandwidth updates immediately, and the dropdown shows how many free hours each person has.
- **Change status** (To Do, In Progress, Completed, Blocked) straight from the task list.
- **Log time** in 30-minute steps. Logging on a To Do task moves it to In Progress.
- **Summary cards and the daily report are calculated** from tasks and time logs, including who hasn't logged anything today.
- **Search** tasks by name, brand or person.
- **Export** the daily report as CSV.
- Data is saved in the browser (localStorage). Use *Reset demo data* in the sidebar to start over.

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
js/utils.js             Date, formatting and escaping helpers
js/data.js              Demo data (replace with an API later)
js/app.js               State, rendering and actions
.github/workflows/      GitHub Pages deployment
```

## Roadmap

- Backend and database so the whole team shares one source of truth (currently each browser keeps its own data)
- Login and roles (manager vs team member)
- Email and WhatsApp notifications when tasks are assigned
- Remaining views: Tasks, Projects, Brands, Time Logs, Analytics, Settings
- Weekly bandwidth reset and history
