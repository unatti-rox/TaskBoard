/* App shell: routing, top bar, and wiring clicks to actions. */
(function () {
  const U = window.COUtils;
  const S = window.COStore;
  const UI = window.COUI;
  const V = window.COViews;
  const views = V.views;
  const ui = V.ui;

  const DEFAULT_VIEW = "today";
  let currentView = DEFAULT_VIEW;

  const viewEl = document.getElementById("view");
  const searchInput = document.getElementById("searchInput");
  const searchToggle = document.getElementById("searchToggle");
  const sidebar = document.getElementById("sidebar");

  /* ---------------- ROUTING ---------------- */

  function viewFromHash() {
    const name = location.hash.replace(/^#\/?/, "");
    return views[name] ? name : DEFAULT_VIEW;
  }

  function go(name) {
    if (location.hash !== "#/" + name) location.hash = "#/" + name;
    else route();
  }

  function route() {
    const next = viewFromHash();
    const changed = next !== currentView;
    currentView = next;
    if (views[next].onEnter) views[next].onEnter();
    document.querySelectorAll(".nav-item").forEach(function (item) {
      const active = item.dataset.view === next;
      item.classList.toggle("active", active);
      if (active) item.setAttribute("aria-current", "page"); else item.removeAttribute("aria-current");
    });
    closeSidebar();
    render();
    if (changed) {
      window.scrollTo(0, 0);
      document.getElementById("pageTitle").focus({ preventScroll: true });
    }
  }

  /* ---------------- RENDER ---------------- */

  function render() {
    const view = views[currentView];
    const s = S.state.settings;

    document.title = view.title + " · " + s.teamName;
    document.getElementById("pageTitle").textContent = view.title;
    document.getElementById("todayLabel").textContent =
      new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) + " · " + s.teamName;

    const avatar = document.getElementById("avatar");
    avatar.textContent = U.initials(s.userName);
    avatar.title = "Signed in as " + s.userName;

    searchToggle.hidden = !view.search;
    if (!view.search) searchInput.hidden = true;

    const alerts = S.alerts().filter(function (a) { return a.level !== "info"; }).length;
    const badge = document.getElementById("notifyBadge");
    badge.textContent = alerts;
    badge.hidden = !alerts;
    document.getElementById("notifyButton").setAttribute("aria-label", "Notifications" + (alerts ? ", " + alerts + " need attention" : ""));

    /* Keep focus on a filter/select across re-renders when possible. */
    const active = document.activeElement;
    const focusKey = active && viewEl.contains(active) ? focusKeyFor(active) : null;
    viewEl.innerHTML = views[currentView].render();
    if (focusKey) {
      const again = viewEl.querySelector(focusKey);
      if (again) again.focus();
    }
  }

  function focusKeyFor(el) {
    if (el.dataset.filter) return '[data-filter="' + el.dataset.filter + '"]';
    if (el.dataset.action && el.dataset.id) return '[data-action="' + el.dataset.action + '"][data-id="' + el.dataset.id + '"]';
    if (el.dataset.action && el.dataset.value) return '[data-action="' + el.dataset.action + '"][data-value="' + el.dataset.value + '"]';
    if (el.dataset.action) return '[data-action="' + el.dataset.action + '"]';
    return null;
  }

  S.onChange = render;

  /* ---------------- ACTIONS ---------------- */

  const clickActions = {
    "new-task": function (el) {
      V.openTaskForm(null, { projectId: el.dataset.project, brand: el.dataset.brand, assignee: el.dataset.assignee });
    },
    "edit-task": function (el) { V.openTaskForm(el.dataset.id); },
    "delete-task": function (el) {
      const t = S.task(el.dataset.id);
      if (!t || !confirm("Delete “" + t.name + "” and its time logs?")) return;
      S.deleteTask(t.id);
      UI.toast("Deleted " + t.name);
    },
    "quick-log": function (el) {
      S.logTime(el.dataset.id, 0.5);
      UI.toast("Logged 30m on " + S.task(el.dataset.id).name);
    },
    "log-form": function (el) { V.openLogForm(el.dataset.id); },
    "delete-log": function (el) {
      if (!confirm("Delete this time entry?")) return;
      S.deleteLog(el.dataset.id);
      UI.toast("Time entry deleted");
    },
    "export-report": function (el) { V.exportReport(el.dataset.date); },
    "export-logs": function () { views.logs.exportCsv(); },

    "new-project": function () { V.openProjectForm(); },
    "edit-project": function (el) { V.openProjectForm(el.dataset.id); },
    "archive-project": function (el) {
      const p = S.project(el.dataset.id);
      S.setProjectArchived(p.id, !p.archived);
      UI.toast((p.archived ? "Archived " : "Restored ") + p.name);
    },
    "project-tasks": function (el) {
      Object.assign(ui.tasks, { status: "all", brand: "", assignee: "", project: el.dataset.id });
      go("tasks");
    },
    "projects-archived": function (el) {
      ui.projects.archived = el.dataset.value === "true";
      render();
    },

    "new-brand": function () { V.openBrandForm(); },
    "remove-brand": function (el) {
      const error = S.removeBrand(el.dataset.brand);
      UI.toast(error || "Removed " + el.dataset.brand);
    },
    "brand-tasks": function (el) {
      Object.assign(ui.tasks, { status: "open", brand: el.dataset.brand, assignee: "", project: "" });
      go("tasks");
    },

    "new-member": function () { V.openMemberForm(); },
    "edit-member": function (el) { V.openMemberForm(el.dataset.id); },
    "remove-member": function (el) {
      const m = S.member(el.dataset.id);
      if (!m || !confirm("Remove " + m.name + " from the team?")) return;
      const error = S.removeMember(m.id);
      UI.toast(error || "Removed " + m.name);
    },

    "report-shift": function (el) {
      const next = U.addDays(Number(el.dataset.value), ui.reportDate);
      if (next > U.isoDate()) return;
      ui.reportDate = next;
      render();
    },
    "report-today": function () { ui.reportDate = U.isoDate(); render(); },
    "analytics-days": function (el) { ui.analytics.days = Number(el.dataset.value); render(); },
    "go": function (el) { go(el.dataset.value); },

    "export-json": function () {
      U.downloadFile("taskboard-backup-" + U.isoDate() + ".json", JSON.stringify(S.state, null, 2), "application/json");
      UI.toast("Backup downloaded");
    },
    "reset": function () {
      if (!confirm("Reset all tasks and time logs to the demo data?")) return;
      S.reset();
      UI.toast("Demo data restored");
    }
  };

  viewEl.addEventListener("click", function (e) {
    const el = e.target.closest("[data-action]");
    if (!el || el.tagName === "SELECT" || el.tagName === "INPUT") return;
    const fn = clickActions[el.dataset.action];
    if (fn) fn(el);
  });

  viewEl.addEventListener("change", function (e) {
    const el = e.target;

    if (el.dataset.filter) {
      const parts = el.dataset.filter.split(".");
      ui[parts[0]][parts[1]] = el.value;
      render();
      return;
    }

    if (el.dataset.action === "status") {
      if (el.value === "blocked") {
        el.value = S.task(el.dataset.id).status;
        V.openBlockForm(el.dataset.id);
        return;
      }
      S.setStatus(el.dataset.id, el.value);
      UI.toast(S.task(el.dataset.id).name + " marked " + S.STATUS_LABELS[el.value].toLowerCase());
    }

    if (el.dataset.action === "report-date" && el.value) {
      ui.reportDate = el.value > U.isoDate() ? U.isoDate() : el.value;
      render();
    }

    if (el.dataset.action === "import-json" && el.files.length) {
      const reader = new FileReader();
      reader.onload = function () {
        try {
          const data = JSON.parse(reader.result);
          if (!confirm("Replace all current data with this backup?")) return;
          S.replaceAll(data);
          UI.toast("Backup imported");
        } catch (err) {
          UI.toast("That file isn't a TaskBoard backup");
        }
      };
      reader.readAsText(el.files[0]);
      el.value = "";
    }
  });

  viewEl.addEventListener("submit", function (e) {
    const form = e.target;
    if (form.dataset.form !== "settings") return;
    e.preventDefault();
    const userName = form.elements.userName.value.trim();
    const teamName = form.elements.teamName.value.trim();
    if (!userName || !teamName) { UI.toast("Name and team name can't be empty"); return; }
    S.saveSettings({ userName: userName, teamName: teamName });
    UI.toast("Settings saved");
  });

  /* ---------------- TOP BAR & SIDEBAR ---------------- */

  searchToggle.addEventListener("click", function () {
    searchInput.hidden = !searchInput.hidden;
    if (!searchInput.hidden) {
      searchInput.focus();
    } else {
      searchInput.value = "";
      ui.search = "";
      render();
    }
  });
  searchInput.addEventListener("input", function () {
    ui.search = searchInput.value;
    render();
  });

  document.getElementById("notifyButton").addEventListener("click", function () { go("notifications"); });

  document.getElementById("nav").addEventListener("click", function (e) {
    const item = e.target.closest(".nav-item");
    if (item) go(item.dataset.view);
  });

  function closeSidebar() {
    sidebar.classList.remove("open");
    document.getElementById("menuToggle").setAttribute("aria-expanded", "false");
  }
  document.getElementById("menuToggle").addEventListener("click", function () {
    const open = sidebar.classList.toggle("open");
    this.setAttribute("aria-expanded", String(open));
  });
  document.getElementById("sidebarScrim").addEventListener("click", closeSidebar);

  document.getElementById("resetData").addEventListener("click", clickActions.reset);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && sidebar.classList.contains("open")) closeSidebar();
  });

  /* Re-render when the day rolls over or another tab changes the data. */
  let lastDay = U.isoDate();
  setInterval(function () {
    if (U.isoDate() !== lastDay) {
      lastDay = U.isoDate();
      render();
    }
  }, 60000);

  window.addEventListener("storage", function (e) {
    if (e.key === S.STORAGE_KEY) S.reload();
  });

  window.addEventListener("hashchange", route);

  /* ---------------- INIT ---------------- */

  route();
})();
