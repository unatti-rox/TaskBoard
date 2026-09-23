/* One render function per sidebar view, plus the forms they open. */
(function () {
  const U = window.COUtils;
  const S = window.COStore;
  const UI = window.COUI;
  const esc = U.escapeHtml;

  const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
  const STATUS_ORDER = { blocked: 0, progress: 1, todo: 2, completed: 3 };

  /* View-local UI state (filters etc.). Not persisted. */
  const ui = {
    search: "",
    tasks: { status: "open", brand: "", assignee: "", project: "", sort: "due" },
    projects: { archived: false },
    reportDate: U.isoDate(),
    logs: { range: "week", member: "" },
    analytics: { days: 7 },
    creativeExport: { file: null, fileUrl: "", fileName: "", fit: "cover", status: "idle", error: "", results: [] }
  };

  /* ---------------- SHARED PIECES ---------------- */

  /* Returns the html only when the signed-in person is a manager. */
  function mgr(html) {
    return S.isManager() ? html : "";
  }

  function matchesSearch(t) {
    const q = ui.search.trim().toLowerCase();
    if (!q) return true;
    const p = t.projectId ? S.project(t.projectId) : null;
    return [t.name, t.brand, S.memberName(t.assignee), p ? p.name : ""].join(" ").toLowerCase().includes(q);
  }

  function statusSelect(t) {
    const options = Object.keys(S.STATUS_LABELS).map(function (key) {
      return '<option value="' + key + '"' + (key === t.status ? " selected" : "") + ">" + S.STATUS_LABELS[key] + "</option>";
    }).join("");
    const disabled = S.canWorkOn(t) ? "" : " disabled";
    return '<select class="status-select ' + t.status + '" data-action="status" data-id="' + t.id + '" aria-label="Status for ' + esc(t.name) + '"' + disabled + ">" + options + "</select>";
  }

  function taskRow(t, opts) {
    const o = opts || {};
    const due = U.dueLabel(t.due);
    const p = t.projectId ? S.project(t.projectId) : null;
    const detail = t.status === "blocked" && t.note
      ? '<span class="blocked-note">' + esc(t.note) + "</span>"
      : t.status === "completed"
        ? "Done " + (t.completedOn === U.isoDate() ? "today" : U.formatDate(t.completedOn))
        : '<span class="' + (due.overdue ? "overdue" : "") + '">' + due.text + "</span>";

    const meta = [esc(t.brand)];
    if (o.showProject && p) meta.push(esc(p.name));
    meta.push(esc(S.memberName(t.assignee)));
    meta.push(detail);

    const logged = S.hoursLoggedOnTask(t.id);
    const canWork = S.canWorkOn(t);
    const logButton = t.status === "completed" || !canWork
      ? ""
      : '<button class="link-button" data-action="quick-log" data-id="' + t.id + '" aria-label="Log 30 minutes on ' + esc(t.name) + '">+30m</button>';

    const toolButtons =
      (canWork && t.status !== "completed" ? '<button class="tool-button" data-action="log-form" data-id="' + t.id + '">Log time</button>' : "") +
      mgr('<button class="tool-button" data-action="edit-task" data-id="' + t.id + '">Edit</button>' +
        '<button class="tool-button danger" data-action="delete-task" data-id="' + t.id + '">Delete</button>');
    const tools = o.tools && toolButtons ? '<div class="row-tools">' + toolButtons + "</div>" : "";
    const title = S.isManager()
      ? '<button class="task-name" data-action="edit-task" data-id="' + t.id + '">' + esc(t.name) + "</button>"
      : esc(t.name);

    return (
      '<div class="task">' +
        '<div class="task-left">' +
          '<div class="task-dot ' + t.priority + '" title="' + t.priority + ' priority"></div>' +
          '<div class="task-info">' +
            "<h4>" + title + "</h4>" +
            "<p>" + meta.join(" · ") + "</p>" +
            tools +
          "</div>" +
        "</div>" +
        '<div class="task-right">' +
          statusSelect(t) +
          '<div class="hours' + (logged > t.estimate ? " over" : "") + '">' + U.formatHours(logged) + " / " + U.formatHours(t.estimate) + " logged" + logButton + "</div>" +
        "</div>" +
      "</div>"
    );
  }

  function summaryCards(cards) {
    return '<section class="summary-grid" style="--cols:' + cards.length + '">' + cards.map(function (c) {
      return (
        '<div class="summary-card' + (c.alert ? " alert" : "") + '">' +
          '<div class="summary-label">' + esc(c.label) + "</div>" +
          '<div class="summary-number">' + c.value + "</div>" +
          '<div class="summary-small">' + esc(c.small) + "</div>" +
        "</div>"
      );
    }).join("") + "</section>";
  }

  function panel(title, body, opts) {
    const o = opts || {};
    return (
      '<section class="panel' + (o.className ? " " + o.className : "") + '">' +
        '<div class="panel-header">' +
          "<div>" +
            '<h2 class="panel-title">' + esc(title) + "</h2>" +
            (o.note ? '<div class="panel-note">' + esc(o.note) + "</div>" : "") +
          "</div>" +
          (o.action || "") +
        "</div>" +
        body +
      "</section>"
    );
  }

  function empty(text) {
    return '<div class="empty">' + esc(text) + "</div>";
  }

  function bandwidthRow(m) {
    const a = S.allocation(m);
    const leftText = a.free > 0 ? U.formatHours(a.free) + " left" : a.free === 0 ? "At capacity" : "Over by " + U.formatHours(-a.free);
    return (
      '<div class="person">' +
        '<div class="person-top">' +
          '<div><span class="person-name">' + esc(m.name) + '</span><span class="person-role">' + esc(m.shortRole) + "</span></div>" +
          '<div class="percentage">' + a.pct + "%</div>" +
        "</div>" +
        '<div class="bar" role="progressbar" aria-valuenow="' + a.pct + '" aria-valuemin="0" aria-valuemax="100" aria-label="' + esc(m.name) + ' allocation">' +
          '<div class="bar-fill' + (a.pct > 100 ? " over" : "") + '" style="width:' + Math.min(a.pct, 100) + '%"></div>' +
        "</div>" +
        '<div class="person-bottom">' +
          "<span>" + U.formatHours(a.allocated) + " / " + U.formatHours(m.capacity) + " allocated</span>" +
          "<span>" + leftText + "</span>" +
        "</div>" +
      "</div>"
    );
  }

  function reportCards(date) {
    return '<div class="report-grid">' + S.reportFor(date).map(function (r) {
      const parts = [];
      if (r.completed) parts.push(r.completed + " completed");
      if (r.progress) parts.push(r.progress + " in progress");
      if (r.blocked) parts.push(r.blocked + " blocked");
      const status = r.updated ? (parts.join(" · ") || "Time logged") : "⚠ No update received";
      const worked = r.worked.length
        ? '<ul class="report-tasks">' + r.worked.map(function (w) {
            return "<li><span>" + esc(w.task ? w.task.name : "Deleted task") + "</span><span>" + U.formatHours(w.hours) + "</span></li>";
          }).join("") + "</ul>"
        : "";

      return (
        '<div class="report-card' + (r.updated ? "" : " missing") + '">' +
          '<div class="report-name">' + esc(r.member.name) + "</div>" +
          '<div class="report-role">' + esc(r.member.role) + "</div>" +
          '<div class="report-hours">' + (r.updated ? U.formatHours(r.hours) : "—") + "</div>" +
          '<div class="report-status">' + status + "</div>" +
          worked +
        "</div>"
      );
    }).join("") + "</div>";
  }

  function exportReport(date) {
    const rows = [["Date", "Name", "Role", "Hours logged", "Completed", "In progress", "Blocked", "Update received", "Tasks worked on"]];
    S.reportFor(date).forEach(function (r) {
      rows.push([
        date, r.member.name, r.member.role, r.hours, r.completed,
        r.progress === null ? "" : r.progress, r.blocked === null ? "" : r.blocked,
        r.updated ? "Yes" : "No",
        r.worked.map(function (w) { return (w.task ? w.task.name : "Deleted task") + " (" + U.formatHours(w.hours) + ")"; }).join("; ")
      ]);
    });
    U.downloadFile("daily-report-" + date + ".csv", U.csv(rows), "text/csv;charset=utf-8");
    UI.toast("Report exported");
  }

  function option(value, label, selected) {
    return '<option value="' + esc(value) + '"' + (String(value) === String(selected) ? " selected" : "") + ">" + esc(label) + "</option>";
  }

  function filterSelect(group, key, label, options) {
    return (
      '<label class="filter"><span>' + esc(label) + "</span>" +
        '<select data-filter="' + group + "." + key + '">' +
          options.map(function (o) { return option(o[0], o[1], ui[group][key]); }).join("") +
        "</select>" +
      "</label>"
    );
  }

  function timeAgo(isoTimestamp) {
    const mins = Math.round((Date.now() - new Date(isoTimestamp).getTime()) / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return mins + "m ago";
    const hours = Math.round(mins / 60);
    if (hours < 24) return hours + "h ago";
    const days = Math.round(hours / 24);
    return days === 1 ? "Yesterday" : days + "d ago";
  }

  /* ---------------- FORMS ---------------- */

  function memberOptions() {
    return S.state.team.map(function (m) {
      const a = S.allocation(m);
      return { value: m.id, label: m.name + " — " + m.shortRole + " (" + (a.free > 0 ? U.formatHours(a.free) + " free" : "full") + ")" };
    });
  }

  function projectOptions(includeArchivedId) {
    return [{ value: "", label: "No project" }].concat(S.state.projects.filter(function (p) {
      return !p.archived || p.id === includeArchivedId;
    }).map(function (p) {
      return { value: p.id, label: p.name + " (" + p.brand + ")" };
    }));
  }

  function openTaskForm(taskId, defaults) {
    const t = taskId ? S.task(taskId) : null;
    const d = defaults || {};
    if (!S.state.team.length) { UI.toast("Add a team member in Settings first"); return; }
    if (!S.state.brands.length) { UI.toast("Add a brand first"); return; }

    UI.form({
      title: t ? "Edit Task" : "Assign New Task",
      submitLabel: t ? "Save Changes" : "Assign Task",
      fields: [
        { id: "name", label: "Task Name", value: t ? t.name : "", placeholder: "e.g. Sensorium Reel 04" },
        { id: "projectId", label: "Project", type: "select", value: t ? t.projectId || "" : d.projectId || "", options: projectOptions(t && t.projectId) },
        { id: "brand", label: "Brand (ignored when a project is picked)", type: "select", value: t ? t.brand : d.brand || "", options: S.state.brands.map(function (b) { return { value: b, label: b }; }) },
        { id: "assignee", label: "Assign To", type: "select", value: t ? t.assignee : d.assignee || "", options: memberOptions() },
        [
          { id: "estimate", label: "Estimated Hours", type: "number", min: 0.5, step: 0.5, value: t ? t.estimate : 4 },
          { id: "due", label: "Deadline", type: "date", value: t ? t.due : U.isoDate() },
          { id: "priority", label: "Priority", type: "select", value: t ? t.priority : "medium", options: [
            { value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }
          ] }
        ],
        { id: "note", label: "Notes (optional)", type: "textarea", value: t ? t.note : "" }
      ],
      onSubmit: function (v) {
        if (!v.name) return "Enter a task name.";
        if (!(v.estimate > 0)) return "Enter estimated hours greater than 0.";
        if (!v.due) return "Pick a deadline.";
        const p = v.projectId ? S.project(v.projectId) : null;
        if (p) v.brand = p.brand;
        v.id = t ? t.id : null;
        const saved = S.saveTask(v);
        UI.toast(t ? "Saved " + saved.name : "Assigned " + saved.name + " to " + S.memberName(saved.assignee));
      }
    });
  }

  function openLogForm(taskId) {
    const tasks = S.state.tasks.filter(function (t) { return S.canWorkOn(t) && (t.status !== "completed" || t.id === taskId); });
    if (!tasks.length) { UI.toast(S.isManager() ? "No open tasks to log time on" : "You have no open tasks to log time on"); return; }

    UI.form({
      title: "Log Time",
      submitLabel: "Log Time",
      fields: [
        { id: "taskId", label: "Task", type: "select", value: taskId || "", options: tasks.map(function (t) {
          return { value: t.id, label: t.name + " — " + S.memberName(t.assignee) };
        }) },
        [
          { id: "hours", label: "Hours", type: "number", min: 0.25, step: 0.25, value: 1 },
          { id: "date", label: "Date", type: "date", value: U.isoDate() }
        ],
        { id: "note", label: "What was done (optional)", type: "textarea" }
      ],
      onSubmit: function (v) {
        if (!(v.hours > 0)) return "Enter hours greater than 0.";
        if (v.hours > 24) return "That's more than a day. Split it across dates.";
        if (!v.date) return "Pick a date.";
        if (v.date > U.isoDate()) return "Time can't be logged in the future.";
        S.logTime(v.taskId, v.hours, v.date, v.note);
        UI.toast("Logged " + U.formatHours(v.hours) + " on " + S.task(v.taskId).name);
      }
    });
  }

  function openBlockForm(taskId) {
    const t = S.task(taskId);
    UI.form({
      title: "What's blocking " + t.name + "?",
      submitLabel: "Mark Blocked",
      fields: [{ id: "note", label: "Reason", value: t.note, placeholder: "e.g. Waiting for client feedback" }],
      onSubmit: function (v) {
        S.setStatus(taskId, "blocked", v.note);
        UI.toast(t.name + " marked blocked");
      }
    });
  }

  function openProjectForm(projectId) {
    const p = projectId ? S.project(projectId) : null;
    if (!S.state.brands.length) { UI.toast("Add a brand first"); return; }
    UI.form({
      title: p ? "Edit Project" : "New Project",
      submitLabel: p ? "Save Changes" : "Create Project",
      fields: [
        { id: "name", label: "Project Name", value: p ? p.name : "", placeholder: "e.g. Monsoon Campaign" },
        [
          { id: "brand", label: "Brand", type: "select", value: p ? p.brand : "", options: S.state.brands.map(function (b) { return { value: b, label: b }; }) },
          { id: "due", label: "Delivery Date", type: "date", value: p ? p.due : U.addDays(14) }
        ]
      ],
      onSubmit: function (v) {
        if (!v.name) return "Enter a project name.";
        if (!v.due) return "Pick a delivery date.";
        v.id = p ? p.id : null;
        const saved = S.saveProject(v);
        UI.toast(p ? "Saved " + saved.name : "Created " + saved.name);
      }
    });
  }

  function openBrandForm() {
    UI.form({
      title: "Add Brand",
      submitLabel: "Add Brand",
      fields: [{ id: "name", label: "Brand Name", placeholder: "e.g. Lumina" }],
      onSubmit: function (v) {
        const error = S.addBrand(v.name);
        if (error) return error;
        UI.toast("Added " + v.name);
      }
    });
  }

  function openMemberForm(memberId) {
    const m = memberId ? S.member(memberId) : null;
    UI.form({
      title: m ? "Edit " + m.name : "Add Team Member",
      submitLabel: m ? "Save Changes" : "Add Member",
      fields: [
        { id: "name", label: "Name", value: m ? m.name : "" },
        [
          { id: "role", label: "Role", value: m ? m.role : "", placeholder: "e.g. Motion Designer" },
          { id: "shortRole", label: "Short Role", value: m ? m.shortRole : "", placeholder: "e.g. Motion" }
        ],
        [
          { id: "capacity", label: "Weekly Capacity (h)", type: "number", min: 1, step: 1, value: m ? m.capacity : 40 },
          { id: "otherHours", label: "Other Work This Week (h)", type: "number", min: 0, step: 0.5, value: m ? m.otherHours : 0 }
        ]
      ].concat(S.mode === "cloud" ? [[
        { id: "email", label: "Sign-in Email", type: "email", value: m ? m.email || "" : "", placeholder: "name@company.com" },
        { id: "access", label: "Access", type: "select", value: m ? m.access || "member" : "member", options: [
          { value: "member", label: "Team member" }, { value: "manager", label: "Manager" }
        ] }
      ]] : []),
      onSubmit: function (v) {
        if (!v.name) return "Enter a name.";
        if (S.mode === "cloud") {
          v.email = v.email.toLowerCase();
          if (v.email && !/^\S+@\S+\.\S+$/.test(v.email)) return "Enter a valid email, or leave it empty.";
          const taken = S.state.team.some(function (x) { return x.email && x.email.toLowerCase() === v.email && (!m || x.id !== m.id); });
          if (v.email && taken) return "Someone on the team already uses that email.";
          const otherManagers = S.state.team.filter(function (x) { return x.access === "manager" && (!m || x.id !== m.id); });
          if (m && m.access === "manager" && v.access !== "manager" && !otherManagers.length) return "The team needs at least one manager.";
          if (m && m.id === S.state.me.memberId && v.email !== (m.email || "").toLowerCase()) return "You can't change your own sign-in email. Ask another manager.";
        }
        if (!v.role) return "Enter a role.";
        if (!(v.capacity > 0)) return "Capacity must be more than 0.";
        if (!(v.otherHours >= 0)) return "Other work can't be negative.";
        v.shortRole = v.shortRole || v.role;
        v.id = m ? m.id : null;
        const saved = S.saveMember(v);
        UI.toast(m ? "Saved " + saved.name : "Added " + saved.name);
      }
    });
  }

  /* ---------------- VIEWS ---------------- */

  const views = {};

  views.today = {
    title: "Today",
    search: true,
    render: function () {
      const today = U.isoDate();
      const tasks = S.state.tasks;
      const open = tasks.filter(function (t) { return t.status !== "completed"; });
      const openBrands = new Set(open.map(function (t) { return t.brand; }));
      const completedToday = tasks.filter(function (t) { return t.completedOn === today; });
      const inProgress = tasks.filter(function (t) { return t.status === "progress"; });
      const peopleInProgress = new Set(inProgress.map(function (t) { return t.assignee; }));
      const missing = S.state.team.filter(function (m) { return S.hoursLogged({ memberId: m.id, date: today }) === 0; });
      const blocked = open.filter(function (t) { return t.status === "blocked"; });

      const todays = tasks
        .filter(function (t) { return t.status !== "completed" || t.completedOn === today; })
        .filter(matchesSearch)
        .sort(function (a, b) { return STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.due.localeCompare(b.due); });

      const taskList = todays.length
        ? todays.map(function (t) { return taskRow(t); }).join("")
        : empty(ui.search ? "No tasks match “" + ui.search + "”." : "No tasks for today. Assign one to get started.");

      return (
        summaryCards([
          { label: "Open Tasks", value: open.length, small: "Across " + openBrands.size + " brands" },
          { label: "Completed Today", value: completedToday.length, small: blocked.length + " blocked" },
          { label: "Team Hours", value: U.formatHours(S.hoursLogged({ date: today })), small: "Logged today" },
          { label: "In Progress", value: inProgress.length, small: "Across " + peopleInProgress.size + " people" },
          {
            label: "Missing Updates",
            value: missing.length,
            small: missing.length ? missing.map(function (m) { return m.name; }).join(", ") : "Everyone updated",
            alert: missing.length > 0
          }
        ]) +
        '<div class="grid-2">' +
          panel("Today's Tasks", taskList, { action: mgr('<button class="primary-button" data-action="new-task">+ Assign Task</button>') }) +
          panel("Team Bandwidth", S.state.team.map(bandwidthRow).join("") || empty("No team members yet."), {
            action: '<a class="panel-action" href="#/bandwidth">This week →</a>'
          }) +
        "</div>" +
        panel("Daily Team Report", reportCards(today), {
          note: "Today's work, collected from time logged on tasks",
          action: '<button class="secondary-button" data-action="export-report" data-date="' + today + '">Export Report (CSV)</button>'
        })
      );
    }
  };

  views.tasks = {
    title: "Tasks",
    search: true,
    render: function () {
      const f = ui.tasks;
      let list = S.state.tasks.filter(function (t) {
        if (f.status === "open" && t.status === "completed") return false;
        if (f.status && f.status !== "open" && f.status !== "all" && t.status !== f.status) return false;
        if (f.brand && t.brand !== f.brand) return false;
        if (f.assignee && t.assignee !== f.assignee) return false;
        if (f.project === "none" && t.projectId) return false;
        if (f.project && f.project !== "none" && t.projectId !== f.project) return false;
        return matchesSearch(t);
      });

      const sorters = {
        due: function (a, b) { return a.due.localeCompare(b.due) || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]; },
        priority: function (a, b) { return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.due.localeCompare(b.due); },
        status: function (a, b) { return STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.due.localeCompare(b.due); },
        name: function (a, b) { return a.name.localeCompare(b.name); }
      };
      list = list.sort(sorters[f.sort]);

      const filters =
        '<div class="filters">' +
          filterSelect("tasks", "status", "Status", [["open", "All open"], ["all", "Everything"]].concat(
            Object.keys(S.STATUS_LABELS).map(function (k) { return [k, S.STATUS_LABELS[k]]; }))) +
          filterSelect("tasks", "brand", "Brand", [["", "All brands"]].concat(S.state.brands.map(function (b) { return [b, b]; }))) +
          filterSelect("tasks", "assignee", "Person", [["", "Everyone"]].concat(S.state.team.map(function (m) { return [m.id, m.name]; }))) +
          filterSelect("tasks", "project", "Project", [["", "All projects"], ["none", "No project"]].concat(S.state.projects.map(function (p) { return [p.id, p.name]; }))) +
          filterSelect("tasks", "sort", "Sort by", [["due", "Deadline"], ["priority", "Priority"], ["status", "Status"], ["name", "Name"]]) +
        "</div>";

      const estimate = U.sum(list, function (t) { return t.estimate; });
      const body = list.length
        ? list.map(function (t) { return taskRow(t, { tools: true, showProject: true }); }).join("")
        : empty("No tasks match these filters.");

      return filters + panel(list.length + " task" + (list.length === 1 ? "" : "s"), body, {
        note: U.formatHours(estimate) + " estimated in total",
        action: mgr('<button class="primary-button" data-action="new-task">+ Assign Task</button>')
      });
    }
  };

  views.projects = {
    title: "Projects",
    render: function () {
      const list = S.state.projects
        .filter(function (p) { return ui.projects.archived ? p.archived : !p.archived; })
        .sort(function (a, b) { return a.due.localeCompare(b.due); });
      const archivedCount = S.state.projects.filter(function (p) { return p.archived; }).length;

      const cards = list.map(function (p) {
        const tasks = S.state.tasks.filter(function (t) { return t.projectId === p.id; });
        const done = tasks.filter(function (t) { return t.status === "completed"; }).length;
        const blocked = tasks.filter(function (t) { return t.status === "blocked"; }).length;
        const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
        const estimate = U.sum(tasks, function (t) { return t.estimate; });
        const logged = S.hoursLogged({ taskIds: new Set(tasks.map(function (t) { return t.id; })) });
        const people = Array.from(new Set(tasks.map(function (t) { return t.assignee; })));
        const due = U.dueLabel(p.due);
        const late = due.overdue && done < tasks.length;

        return (
          '<article class="card">' +
            '<div class="card-top">' +
              "<div>" +
                '<div class="card-kicker">' + esc(p.brand) + "</div>" +
                '<h3 class="card-title">' + esc(p.name) + "</h3>" +
              "</div>" +
              '<span class="pill' + (late ? " danger" : "") + '">' + (done === tasks.length && tasks.length ? "Delivered" : due.text) + "</span>" +
            "</div>" +
            '<div class="person-top"><span class="person-role">' + done + " of " + tasks.length + " tasks done" +
              (blocked ? " · " + blocked + " blocked" : "") + '</span><span class="percentage">' + pct + "%</span></div>" +
            '<div class="bar" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100" aria-label="' + esc(p.name) + ' progress">' +
              '<div class="bar-fill" style="width:' + pct + '%"></div>' +
            "</div>" +
            '<dl class="stats">' +
              "<div><dt>Logged</dt><dd>" + U.formatHours(logged) + "</dd></div>" +
              "<div><dt>Estimated</dt><dd>" + U.formatHours(estimate) + "</dd></div>" +
              "<div><dt>People</dt><dd>" + (people.length ? people.map(function (id) {
                return '<span class="mini-avatar" title="' + esc(S.memberName(id)) + '">' + esc(U.initials(S.memberName(id))) + "</span>";
              }).join("") : "—") + "</dd></div>" +
            "</dl>" +
            '<div class="card-actions">' +
              '<button class="secondary-button" data-action="project-tasks" data-id="' + p.id + '">View tasks</button>' +
              mgr((p.archived ? "" : '<button class="secondary-button" data-action="new-task" data-project="' + p.id + '">+ Task</button>') +
                '<button class="tool-button" data-action="edit-project" data-id="' + p.id + '">Edit</button>' +
                '<button class="tool-button" data-action="archive-project" data-id="' + p.id + '">' + (p.archived ? "Restore" : "Archive") + "</button>") +
            "</div>" +
          "</article>"
        );
      }).join("");

      return (
        '<div class="toolbar">' +
          '<div class="segmented" role="group" aria-label="Show projects">' +
            '<button data-action="projects-archived" data-value="false" aria-pressed="' + !ui.projects.archived + '">Active</button>' +
            '<button data-action="projects-archived" data-value="true" aria-pressed="' + ui.projects.archived + '">Archived (' + archivedCount + ")</button>" +
          "</div>" +
          mgr('<button class="primary-button" data-action="new-project">+ New Project</button>') +
        "</div>" +
        (cards ? '<div class="card-grid">' + cards + "</div>" : panel("Projects", empty(ui.projects.archived ? "No archived projects." : "No active projects. Create one to group related tasks.")))
      );
    }
  };

  views.brands = {
    title: "Brands",
    render: function () {
      const weekStart = U.startOfWeek();
      const cards = S.state.brands.map(function (b) {
        const tasks = S.state.tasks.filter(function (t) { return t.brand === b; });
        const open = tasks.filter(function (t) { return t.status !== "completed"; });
        const doneWeek = tasks.filter(function (t) { return (t.completedOn || "") >= weekStart; }).length;
        const overdue = open.filter(S.isOverdue).length;
        const hoursWeek = S.hoursLogged({ from: weekStart, taskIds: new Set(tasks.map(function (t) { return t.id; })) });
        const projects = S.state.projects.filter(function (p) { return p.brand === b && !p.archived; });
        const inUse = tasks.length || S.state.projects.some(function (p) { return p.brand === b; });

        return (
          '<article class="card">' +
            '<div class="card-top">' +
              '<h3 class="card-title">' + esc(b) + "</h3>" +
              (overdue ? '<span class="pill danger">' + overdue + " overdue</span>" : "") +
            "</div>" +
            '<dl class="stats">' +
              "<div><dt>Open tasks</dt><dd>" + open.length + "</dd></div>" +
              "<div><dt>Done this week</dt><dd>" + doneWeek + "</dd></div>" +
              "<div><dt>Hours this week</dt><dd>" + U.formatHours(hoursWeek) + "</dd></div>" +
            "</dl>" +
            '<div class="card-note">' + (projects.length ? "Projects: " + projects.map(function (p) { return esc(p.name); }).join(", ") : "No active projects") + "</div>" +
            '<div class="card-actions">' +
              '<button class="secondary-button" data-action="brand-tasks" data-brand="' + esc(b) + '">View tasks</button>' +
              mgr('<button class="secondary-button" data-action="new-task" data-brand="' + esc(b) + '">+ Task</button>' +
                (inUse ? "" : '<button class="tool-button danger" data-action="remove-brand" data-brand="' + esc(b) + '">Remove</button>')) +
            "</div>" +
          "</article>"
        );
      }).join("");

      return (
        '<div class="toolbar"><span class="panel-note">Numbers for this week start Monday ' + U.formatDate(weekStart) + '</span>' +
          mgr('<button class="primary-button" data-action="new-brand">+ Add Brand</button>') + "</div>" +
        (cards ? '<div class="card-grid">' + cards + "</div>" : panel("Brands", empty("No brands yet.")))
      );
    }
  };

  views.bandwidth = {
    title: "Bandwidth",
    render: function () {
      const team = S.state.team;
      const totals = team.reduce(function (acc, m) {
        const a = S.allocation(m);
        acc.capacity += m.capacity;
        acc.allocated += a.allocated;
        if (a.free < 0) acc.over.push(m.name);
        return acc;
      }, { capacity: 0, allocated: 0, over: [] });
      const weekStart = U.startOfWeek();

      const cards = team.map(function (m) {
        const tasks = S.weekTasks(m.id).sort(function (a, b) { return STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.due.localeCompare(b.due); });
        const loggedWeek = S.hoursLogged({ memberId: m.id, from: weekStart });
        const rows = tasks.map(function (t) {
          return '<li><span class="status-dot ' + t.status + '" title="' + S.STATUS_LABELS[t.status] + '"></span>' +
            '<span class="grow">' + esc(t.name) + '</span><span class="muted">' + U.formatHours(t.estimate) + "</span></li>";
        }).join("");

        return (
          '<article class="card">' +
            bandwidthRow(m) +
            '<ul class="load-list">' + rows +
              (m.otherHours ? '<li><span class="status-dot other"></span><span class="grow">Other work</span><span class="muted">' + U.formatHours(m.otherHours) + "</span></li>" : "") +
              (!rows && !m.otherHours ? '<li class="muted">Nothing booked this week</li>' : "") +
            "</ul>" +
            '<div class="card-note">' + U.formatHours(loggedWeek) + " logged since Monday</div>" +
            mgr('<div class="card-actions">' +
              '<button class="secondary-button" data-action="new-task" data-assignee="' + m.id + '">+ Assign</button>' +
              '<button class="tool-button" data-action="edit-member" data-id="' + m.id + '">Edit capacity</button>' +
            "</div>") +
          "</article>"
        );
      }).join("");

      const free = totals.capacity - totals.allocated;
      return (
        summaryCards([
          { label: "Team Capacity", value: U.formatHours(totals.capacity), small: team.length + " people this week" },
          { label: "Allocated", value: U.formatHours(totals.allocated), small: (totals.capacity ? Math.round(totals.allocated / totals.capacity * 100) : 0) + "% of capacity" },
          { label: "Free", value: U.formatHours(Math.max(free, 0)), small: free < 0 ? "Over by " + U.formatHours(-free) : "Available to assign" },
          { label: "Over Capacity", value: totals.over.length, small: totals.over.join(", ") || "Nobody", alert: totals.over.length > 0 }
        ]) +
        (cards ? '<div class="card-grid">' + cards + "</div>" : panel("Team", empty("No team members yet. Add them in Settings.")))
      );
    }
  };

  views.reports = {
    title: "Daily Reports",
    render: function () {
      const date = ui.reportDate;
      const today = U.isoDate();
      const rows = S.reportFor(date);
      const hours = U.sum(rows, function (r) { return r.hours; });
      const completed = U.sum(rows, function (r) { return r.completed; });
      const missing = rows.filter(function (r) { return !r.updated; });

      return (
        '<div class="toolbar">' +
          '<div class="date-nav">' +
            '<button class="icon-button" data-action="report-shift" data-value="-1" aria-label="Previous day">‹</button>' +
            '<input type="date" class="date-input" data-action="report-date" value="' + date + '" max="' + today + '" aria-label="Report date" />' +
            '<button class="icon-button" data-action="report-shift" data-value="1" aria-label="Next day"' + (date >= today ? " disabled" : "") + ">›</button>" +
            (date !== today ? '<button class="tool-button" data-action="report-today">Today</button>' : "") +
          "</div>" +
          '<button class="secondary-button" data-action="export-report" data-date="' + date + '">Export Report (CSV)</button>' +
        "</div>" +
        summaryCards([
          { label: "Hours Logged", value: U.formatHours(hours), small: U.formatDate(date, { weekday: "long", day: "numeric", month: "long" }) },
          { label: "Tasks Completed", value: completed, small: "Marked done that day" },
          { label: "Missing Updates", value: missing.length, small: missing.map(function (r) { return r.member.name; }).join(", ") || "Everyone updated", alert: missing.length > 0 }
        ]) +
        panel("Team Report", reportCards(date), { note: date === today ? "Live — updates as time is logged" : "Built from time logged on " + U.formatDate(date) })
      );
    }
  };

  views.logs = {
    title: "Time Logs",
    search: true,
    render: function () {
      const today = U.isoDate();
      const ranges = {
        today: { from: today, label: "Today" },
        week: { from: U.startOfWeek(), label: "This week" },
        last7: { from: U.addDays(-6), label: "Last 7 days" },
        last30: { from: U.addDays(-29), label: "Last 30 days" },
        all: { from: "", label: "All time" }
      };
      const range = ranges[ui.logs.range];
      const q = ui.search.trim().toLowerCase();

      const logs = S.logsWhere({ from: range.from || undefined, memberId: ui.logs.member || undefined })
        .filter(function (l) {
          if (!q) return true;
          const t = S.task(l.taskId);
          return [t ? t.name : "", t ? t.brand : "", S.memberName(l.memberId), l.note].join(" ").toLowerCase().includes(q);
        })
        .sort(function (a, b) { return b.date.localeCompare(a.date); });
      const total = U.sum(logs, function (l) { return l.hours; });

      const rows = logs.map(function (l) {
        const t = S.task(l.taskId);
        return (
          "<tr>" +
            "<td>" + U.formatDate(l.date, { weekday: "short", day: "numeric", month: "short" }) + "</td>" +
            "<td>" + esc(S.memberName(l.memberId)) + "</td>" +
            "<td>" + (t ? esc(t.name) : '<span class="muted">Deleted task</span>') + (l.note ? '<div class="muted small">' + esc(l.note) + "</div>" : "") + "</td>" +
            "<td>" + (t ? esc(t.brand) : "—") + "</td>" +
            '<td class="num">' + U.formatHours(l.hours) + "</td>" +
            '<td class="num">' + (S.canDeleteLog(l) ? '<button class="tool-button danger" data-action="delete-log" data-id="' + l.id + '" aria-label="Delete this entry">Delete</button>' : "") + "</td>" +
          "</tr>"
        );
      }).join("");

      return (
        '<div class="filters">' +
          filterSelect("logs", "range", "Period", Object.keys(ranges).map(function (k) { return [k, ranges[k].label]; })) +
          filterSelect("logs", "member", "Person", [["", "Everyone"]].concat(S.state.team.map(function (m) { return [m.id, m.name]; }))) +
        "</div>" +
        panel(U.formatHours(total) + " logged", rows
          ? '<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Person</th><th>Task</th><th>Brand</th><th class="num">Hours</th><th><span class="visually-hidden">Actions</span></th></tr></thead><tbody>' + rows + "</tbody></table></div>"
          : empty("No time logged for this period."), {
          note: logs.length + " entr" + (logs.length === 1 ? "y" : "ies") + " · " + range.label,
          action: '<div class="panel-buttons"><button class="secondary-button" data-action="export-logs">Export CSV</button><button class="primary-button" data-action="log-form">+ Log Time</button></div>'
        })
      );
    },
    exportCsv: function () {
      const rows = [["Date", "Person", "Task", "Brand", "Hours", "Note"]];
      S.state.logs.slice().sort(function (a, b) { return a.date.localeCompare(b.date); }).forEach(function (l) {
        const t = S.task(l.taskId);
        rows.push([l.date, S.memberName(l.memberId), t ? t.name : "Deleted task", t ? t.brand : "", l.hours, l.note || ""]);
      });
      U.downloadFile("time-logs-" + U.isoDate() + ".csv", U.csv(rows), "text/csv;charset=utf-8");
      UI.toast("Time logs exported");
    }
  };

  /* Horizontal bars, one series. Value label sits at the bar's end; full detail in the tooltip. */
  function barList(items) {
    const max = Math.max.apply(null, items.map(function (i) { return i.value; }).concat([0]));
    if (!max) return empty("Nothing logged in this period.");
    return '<div class="hbar-list">' + items.map(function (i) {
      const pct = (i.value / max) * 100;
      return (
        '<div class="hbar-row" tabindex="0" data-tip="' + esc(i.tip) + '" aria-label="' + esc(i.tip) + '">' +
          '<span class="hbar-label">' + esc(i.label) + "</span>" +
          '<span class="hbar-track"><span class="hbar-fill" style="width:' + pct + '%"></span></span>' +
          '<span class="hbar-value">' + esc(i.display) + "</span>" +
        "</div>"
      );
    }).join("") + "</div>";
  }

  views.analytics = {
    title: "Analytics",
    render: function () {
      const days = ui.analytics.days;
      const from = U.addDays(-(days - 1));
      const today = U.isoDate();
      const logs = S.logsWhere({ from: from, to: today });
      const total = U.sum(logs, function (l) { return l.hours; });
      const completed = S.state.tasks.filter(function (t) { return t.completedOn && t.completedOn >= from; });
      const onTime = completed.filter(function (t) { return t.completedOn <= t.due; }).length;
      const estimated = U.sum(completed, function (t) { return t.estimate; });
      const actual = U.sum(completed, function (t) { return S.hoursLoggedOnTask(t.id); });

      /* Hours per day, oldest first. */
      const series = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = U.addDays(-i);
        series.push({ date: d, hours: U.sum(logs.filter(function (l) { return l.date === d; }), function (l) { return l.hours; }) });
      }
      const peak = Math.max.apply(null, series.map(function (s) { return s.hours; }).concat([1]));
      const niceMax = Math.ceil(peak / 5) * 5 || 5;
      const peakDay = series.reduce(function (a, b) { return b.hours > a.hours ? b : a; }, series[0]);
      const columns =
        '<div class="column-chart" style="--n:' + days + '">' +
          '<div class="column-grid" aria-hidden="true">' +
            [niceMax, niceMax / 2, 0].map(function (v) { return '<div class="gridline"><span>' + Math.round(v * 10) / 10 + "h</span></div>"; }).join("") +
          "</div>" +
          '<div class="columns">' + series.map(function (s) {
            const label = U.formatDate(s.date, { weekday: "short", day: "numeric", month: "short" }) + ": " + U.formatHours(s.hours);
            return (
              '<div class="column" tabindex="0" data-tip="' + esc(label) + '" aria-label="' + esc(label) + '">' +
                '<div class="column-bar-area">' +
                  (s === peakDay && s.hours ? '<span class="column-value">' + U.formatHours(s.hours) + "</span>" : "") +
                  '<div class="column-bar" style="height:' + (s.hours / niceMax) * 100 + '%"></div>' +
                "</div>" +
                '<span class="column-label">' + (days <= 7 ? U.formatDate(s.date, { weekday: "short" }) : U.formatDate(s.date, { day: "numeric" })) + "</span>" +
              "</div>"
            );
          }).join("") + "</div>" +
        "</div>";

      const byBrand = {};
      const byMember = {};
      logs.forEach(function (l) {
        const t = S.task(l.taskId);
        const brand = t ? t.brand : "Deleted tasks";
        byBrand[brand] = (byBrand[brand] || 0) + l.hours;
        byMember[l.memberId] = (byMember[l.memberId] || 0) + l.hours;
      });
      const pctOf = function (h) { return total ? Math.round((h / total) * 100) + "%" : "0%"; };
      const brandBars = barList(Object.keys(byBrand).sort(function (a, b) { return byBrand[b] - byBrand[a]; }).map(function (b) {
        return { label: b, value: byBrand[b], display: U.formatHours(byBrand[b]), tip: b + ": " + U.formatHours(byBrand[b]) + " (" + pctOf(byBrand[b]) + " of logged time)" };
      }));
      const memberBars = barList(S.state.team.map(function (m) {
        const h = byMember[m.id] || 0;
        return { label: m.name, value: h, display: U.formatHours(h), tip: m.name + ": " + U.formatHours(h) + " logged (" + pctOf(h) + " of team time)" };
      }).sort(function (a, b) { return b.value - a.value; }));

      const accuracyRows = completed.slice().sort(function (a, b) { return b.completedOn.localeCompare(a.completedOn); }).map(function (t) {
        const logged = S.hoursLoggedOnTask(t.id);
        const diff = logged - t.estimate;
        return (
          "<tr>" +
            "<td>" + esc(t.name) + '<div class="muted small">' + esc(t.brand) + " · " + esc(S.memberName(t.assignee)) + "</div></td>" +
            "<td>" + U.formatDate(t.completedOn) + (t.completedOn > t.due ? ' <span class="pill danger">Late</span>' : "") + "</td>" +
            '<td class="num">' + U.formatHours(t.estimate) + "</td>" +
            '<td class="num">' + U.formatHours(logged) + "</td>" +
            '<td class="num">' + (diff === 0 ? "On estimate" : (diff > 0 ? "+" : "−") + U.formatHours(Math.abs(diff))) + "</td>" +
          "</tr>"
        );
      }).join("");

      return (
        '<div class="toolbar">' +
          '<div class="segmented" role="group" aria-label="Period">' +
            [7, 14, 30].map(function (n) {
              return '<button data-action="analytics-days" data-value="' + n + '" aria-pressed="' + (days === n) + '">Last ' + n + " days</button>";
            }).join("") +
          "</div>" +
        "</div>" +
        summaryCards([
          { label: "Hours Logged", value: U.formatHours(total), small: "About " + U.formatHours(total / days) + " a day" },
          { label: "Tasks Completed", value: completed.length, small: "In the last " + days + " days" },
          { label: "On-time Delivery", value: completed.length ? Math.round((onTime / completed.length) * 100) + "%" : "—", small: onTime + " of " + completed.length + " by their deadline" },
          { label: "Estimate Accuracy", value: estimated ? Math.round((actual / estimated) * 100) + "%" : "—", small: "Time logged vs estimated on completed tasks" }
        ]) +
        panel("Hours logged per day", columns, { note: "Whole team · peak " + (peakDay.hours ? U.formatDate(peakDay.date, { weekday: "long" }) + " at " + U.formatHours(peakDay.hours) : "—") }) +
        '<div class="grid-2 even">' +
          panel("Hours by brand", brandBars, { note: "Where the team's time went" }) +
          panel("Hours by person", memberBars, { note: "Time logged in the period" }) +
        "</div>" +
        panel("Estimates vs actual", accuracyRows
          ? '<div class="table-wrap"><table class="table"><thead><tr><th>Task</th><th>Completed</th><th class="num">Estimated</th><th class="num">Logged</th><th class="num">Difference</th></tr></thead><tbody>' + accuracyRows + "</tbody></table></div>"
          : empty("No tasks completed in this period."), { note: "Completed tasks in the period" })
      );
    }
  };

  views.notifications = {
    title: "Notifications",
    onEnter: function () {
      /* Remember what was unread on arrival so it stays highlighted during this visit. */
      views.notifications.seenBefore = S.state.notificationsReadAt || "";
      if (S.unreadActivityCount()) S.markNotificationsRead();
    },
    render: function () {
      const alerts = S.alerts();
      const seenBefore = views.notifications.seenBefore || "";
      const icons = { critical: "!", warning: "◐", info: "i" };

      const alertList = alerts.length
        ? '<ul class="feed">' + alerts.map(function (a) {
            const action = a.taskId && S.isManager()
              ? ' data-action="edit-task" data-id="' + a.taskId + '"'
              : a.taskId ? ' data-action="go" data-value="tasks"'
              : a.memberId ? ' data-action="go" data-value="bandwidth"' : ' data-action="go" data-value="reports"';
            return (
              '<li class="feed-item">' +
                '<span class="feed-icon ' + a.level + '" aria-hidden="true">' + icons[a.level] + "</span>" +
                '<button class="feed-text"' + action + ">" + esc(a.text) + '<span class="muted small">' + esc(a.meta) + "</span></button>" +
              "</li>"
            );
          }).join("") + "</ul>"
        : empty("All clear. Nothing needs attention.");

      const activity = S.state.activity.length
        ? '<ul class="feed">' + S.state.activity.slice(0, 40).map(function (a) {
            return (
              '<li class="feed-item' + (a.at > seenBefore ? " unread" : "") + '">' +
                '<span class="feed-icon" aria-hidden="true">•</span>' +
                '<div class="feed-text">' + esc(a.text) + '<span class="muted small">' + timeAgo(a.at) + "</span></div>" +
              "</li>"
            );
          }).join("") + "</ul>"
        : empty("No activity yet.");

      return (
        '<div class="grid-2 even">' +
          panel("Needs attention", alertList, { note: alerts.length + " item" + (alerts.length === 1 ? "" : "s") + " · updates live" }) +
          panel("Activity", activity, { note: "Latest changes across the workspace" }) +
        "</div>"
      );
    }
  };

  views.settings = {
    title: "Settings",
    render: function () {
      const s = S.state.settings;
      const cloud = S.mode === "cloud";
      const manager = S.isManager();

      const members = S.state.team.map(function (m) {
        const you = m.id === S.state.me.memberId;
        return (
          "<tr>" +
            "<td><strong>" + esc(m.name) + "</strong>" + (you ? ' <span class="muted">(you)</span>' : "") + "</td>" +
            "<td>" + esc(m.role) + "</td>" +
            (cloud ? "<td>" + (m.email ? esc(m.email) : '<span class="muted">No sign-in email</span>') + "</td>" +
              "<td>" + (m.access === "manager" ? "Manager" : "Team member") + "</td>" : "") +
            '<td class="num">' + U.formatHours(m.capacity) + "</td>" +
            '<td class="num">' + U.formatHours(m.otherHours || 0) + "</td>" +
            '<td class="num nowrap">' + mgr(
              '<button class="tool-button" data-action="edit-member" data-id="' + m.id + '">Edit</button>' +
              (you ? "" : '<button class="tool-button danger" data-action="remove-member" data-id="' + m.id + '">Remove</button>')) +
            "</td>" +
          "</tr>"
        );
      }).join("");

      const account = cloud
        ? panel("Your account",
            '<p class="panel-text">Signed in as <strong>' + esc(S.state.me.email) + "</strong> · " +
              (manager ? "Manager: you can assign work and change everything." : "Team member: you can update and log time on your own tasks.") + "</p>" +
            '<button class="secondary-button" data-action="sign-out">Sign out</button>')
        : "";

      const workspace = manager
        ? '<form class="inline-form" data-form="settings">' +
            (cloud ? "" : '<div class="field"><label for="setUser">Your name</label><input id="setUser" name="userName" value="' + esc(s.userName) + '" /></div>') +
            '<div class="field"><label for="setTeam">Team name</label><input id="setTeam" name="teamName" value="' + esc(s.teamName) + '" /></div>' +
            '<button class="primary-button" type="submit">Save</button>' +
          "</form>"
        : '<p class="panel-text">Team name: <strong>' + esc(s.teamName) + "</strong></p>";

      const dataText = cloud
        ? "The team's data is stored in Supabase and shared by everyone who signs in. " +
          (manager ? "Importing a backup adds or updates its tasks, projects, brands, people and time logs. Nothing already here is deleted." : "Export a copy any time.")
        : "Everything is stored in this browser only. Export a backup to move it to another computer, or to bring it into shared team mode later.";

      return (
        account +
        panel("Workspace", workspace) +
        panel("Team members", members
          ? '<div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Role</th>' +
              (cloud ? "<th>Sign-in email</th><th>Access</th>" : "") +
              '<th class="num">Weekly capacity</th><th class="num">Other work</th><th><span class="visually-hidden">Actions</span></th></tr></thead><tbody>' + members + "</tbody></table></div>"
          : empty("No team members yet."), {
          note: cloud ? "People can sign in once their email is added here" : "Capacity drives the bandwidth numbers",
          action: mgr('<button class="primary-button" data-action="new-member">+ Add Member</button>')
        }) +
        panel("Data",
          '<p class="panel-text">' + esc(dataText) + "</p>" +
          '<div class="panel-buttons left">' +
            '<button class="secondary-button" data-action="export-json">Export backup (JSON)</button>' +
            mgr('<label class="secondary-button file-button">Import backup<input type="file" accept="application/json,.json" data-action="import-json" /></label>') +
            (cloud ? "" : '<button class="secondary-button danger" data-action="reset">Reset demo data</button>') +
          "</div>")
      );
    }
  };

  views["creative-export"] = {
    title: "Creative Export",
    render: function () {
      const ce = ui.creativeExport;
      const sizeCount = window.COCreativeExport.SIZES.length;

      const uploadBody =
        '<div class="creative-upload">' +
          '<label class="secondary-button file-button">Choose image<input type="file" accept="image/*" data-action="creative-file" /></label>' +
          (ce.file
            ? '<div class="creative-file-info">' +
                '<img class="creative-thumb" src="' + ce.fileUrl + '" alt="" />' +
                "<div><strong>" + esc(ce.fileName) + "</strong>" +
                '<div><button class="link-button" type="button" data-action="creative-clear">Remove</button></div></div>' +
              "</div>"
            : "") +
        "</div>" +
        (ce.file
          ? '<div class="creative-controls">' +
              '<label class="filter"><span>Fit</span>' +
                '<select data-action="creative-fit">' +
                  '<option value="cover"' + (ce.fit === "cover" ? " selected" : "") + ">Crop to fill</option>" +
                  '<option value="contain"' + (ce.fit === "contain" ? " selected" : "") + ">Fit whole image</option>" +
                "</select>" +
              "</label>" +
              '<button class="primary-button" data-action="creative-run"' + (ce.status === "processing" ? " disabled" : "") + ">" +
                (ce.status === "processing" ? "Exporting…" : "Export All Sizes") +
              "</button>" +
            "</div>"
          : "");

      const errorBlock = ce.error ? '<div class="empty alert">' + esc(ce.error) + "</div>" : "";

      const resultsBlock = ce.results.length
        ? panel("Exports (" + ce.results.length + ")",
            '<div class="creative-results">' + ce.results.map(function (r) {
              return (
                '<div class="creative-result">' +
                  '<img src="' + r.url + '" alt="" />' +
                  '<div class="creative-result-name">' + esc(r.name) + "</div>" +
                  '<div class="creative-result-size">' + r.width + "×" + r.height + "</div>" +
                  '<a class="link-button" href="' + r.url + '" download="' + esc(r.filename) + '">Download</a>' +
                "</div>"
              );
            }).join("") + "</div>",
            { action: '<button class="secondary-button" data-action="creative-download-zip">Download All (.zip)</button>' })
        : "";

      return (
        '<p class="panel-text">Upload one master creative and export it to every required ad size (' + sizeCount + ' sizes), named to match each platform automatically. Everything runs in your browser — nothing is uploaded anywhere.</p>' +
        panel("Master creative", uploadBody) +
        errorBlock +
        resultsBlock
      );
    }
  };

  window.COViews = {
    views: views,
    ui: ui,
    openTaskForm: openTaskForm,
    openLogForm: openLogForm,
    openBlockForm: openBlockForm,
    openProjectForm: openProjectForm,
    openBrandForm: openBrandForm,
    openMemberForm: openMemberForm,
    exportReport: exportReport
  };
})();
