(function () {
  const U = window.COUtils;
  const STORAGE_KEY = "creative-ops:v1";

  const STATUS_LABELS = {
    todo: "To Do",
    progress: "In Progress",
    completed: "Completed",
    blocked: "Blocked"
  };

  let state = loadState();
  let searchQuery = "";

  /* ---------------- STATE ---------------- */

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn("Could not read saved data, using demo data.", e);
    }
    return window.createSeedData();
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("Could not save data.", e);
    }
  }

  function member(id) {
    return state.team.find(function (m) { return m.id === id; });
  }

  function hoursLoggedOnTask(taskId) {
    return state.logs
      .filter(function (l) { return l.taskId === taskId; })
      .reduce(function (sum, l) { return sum + l.hours; }, 0);
  }

  function hoursLoggedToday(memberId) {
    const today = U.isoDate();
    return state.logs
      .filter(function (l) { return l.date === today && (!memberId || l.memberId === memberId); })
      .reduce(function (sum, l) { return sum + l.hours; }, 0);
  }

  /* Today's view: everything still open, plus anything finished today. */
  function todaysTasks() {
    const today = U.isoDate();
    const q = searchQuery.trim().toLowerCase();
    const order = { blocked: 0, progress: 1, todo: 2, completed: 3 };

    return state.tasks
      .filter(function (t) { return t.status !== "completed" || t.completedOn === today; })
      .filter(function (t) {
        if (!q) return true;
        const m = member(t.assignee);
        return [t.name, t.brand, m ? m.name : ""].join(" ").toLowerCase().includes(q);
      })
      .sort(function (a, b) {
        return order[a.status] - order[b.status] || a.due.localeCompare(b.due);
      });
  }

  /* ---------------- RENDER ---------------- */

  function render() {
    renderSummary();
    renderTasks();
    renderBandwidth();
    renderReport();
  }

  function renderSummary() {
    const today = U.isoDate();
    const open = state.tasks.filter(function (t) { return t.status !== "completed"; });
    const openBrands = new Set(open.map(function (t) { return t.brand; }));
    const completedToday = state.tasks.filter(function (t) { return t.completedOn === today; });
    const inProgress = state.tasks.filter(function (t) { return t.status === "progress"; });
    const peopleInProgress = new Set(inProgress.map(function (t) { return t.assignee; }));
    const missing = state.team.filter(function (m) { return hoursLoggedToday(m.id) === 0; });
    const blocked = open.filter(function (t) { return t.status === "blocked"; });

    const cards = [
      { label: "Open Tasks", value: open.length, small: "Across " + openBrands.size + " brands" },
      { label: "Completed Today", value: completedToday.length, small: blocked.length + " blocked" },
      { label: "Team Hours", value: U.formatHours(hoursLoggedToday()), small: "Logged today" },
      { label: "In Progress", value: inProgress.length, small: "Across " + peopleInProgress.size + " people" },
      {
        label: "Missing Updates",
        value: missing.length,
        small: missing.length ? missing.map(function (m) { return m.name; }).join(", ") : "Everyone updated",
        alert: missing.length > 0
      }
    ];

    document.getElementById("summary").innerHTML = cards.map(function (c) {
      return (
        '<div class="summary-card' + (c.alert ? " alert" : "") + '">' +
          '<div class="summary-label">' + c.label + "</div>" +
          '<div class="summary-number">' + c.value + "</div>" +
          '<div class="summary-small">' + U.escapeHtml(c.small) + "</div>" +
        "</div>"
      );
    }).join("");
  }

  function renderTasks() {
    const list = document.getElementById("taskList");
    const tasks = todaysTasks();

    if (!tasks.length) {
      list.innerHTML = '<div class="empty">' +
        (searchQuery ? "No tasks match “" + U.escapeHtml(searchQuery) + "”." : "No tasks for today. Assign one to get started.") +
        "</div>";
      return;
    }

    list.innerHTML = tasks.map(function (t) {
      const m = member(t.assignee);
      const due = U.dueLabel(t.due);
      const detail = t.status === "blocked" && t.note
        ? U.escapeHtml(t.note)
        : '<span class="' + (due.overdue && t.status !== "completed" ? "overdue" : "") + '">' + due.text + "</span>";

      const options = Object.keys(STATUS_LABELS).map(function (key) {
        return '<option value="' + key + '"' + (key === t.status ? " selected" : "") + ">" + STATUS_LABELS[key] + "</option>";
      }).join("");

      const logButton = t.status === "completed"
        ? ""
        : '<button class="link-button" data-action="log" data-id="' + t.id + '" aria-label="Log 30 minutes on ' + U.escapeHtml(t.name) + '">+30m</button>';

      return (
        '<div class="task">' +
          '<div class="task-left">' +
            '<div class="task-dot ' + t.priority + '" title="' + t.priority + ' priority"></div>' +
            '<div class="task-info">' +
              "<h4>" + U.escapeHtml(t.name) + "</h4>" +
              "<p>" + U.escapeHtml(t.brand) + " · " + U.escapeHtml(m ? m.name : "Unassigned") + " · " + detail + "</p>" +
            "</div>" +
          "</div>" +
          '<div class="task-right">' +
            '<select class="status-select ' + t.status + '" data-action="status" data-id="' + t.id + '" aria-label="Status for ' + U.escapeHtml(t.name) + '">' +
              options +
            "</select>" +
            '<div class="hours">' + U.formatHours(hoursLoggedOnTask(t.id)) + " / " + U.formatHours(t.estimate) + " logged" + logButton + "</div>" +
          "</div>" +
        "</div>"
      );
    }).join("");
  }

  function renderBandwidth() {
    document.getElementById("bandwidth").innerHTML = state.team.map(function (m) {
      const pct = Math.round((m.allocated / m.capacity) * 100);
      const left = m.capacity - m.allocated;
      const leftText = left > 0 ? U.formatHours(left) + " left" : left === 0 ? "At capacity" : "Over by " + U.formatHours(-left);

      return (
        '<div class="person">' +
          '<div class="person-top">' +
            '<div><span class="person-name">' + U.escapeHtml(m.name) + '</span><span class="person-role">' + U.escapeHtml(m.shortRole) + "</span></div>" +
            '<div class="percentage">' + pct + "%</div>" +
          "</div>" +
          '<div class="bar" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100" aria-label="' + U.escapeHtml(m.name) + ' allocation">' +
            '<div class="bar-fill' + (pct > 100 ? " over" : "") + '" style="width:' + Math.min(pct, 100) + '%"></div>' +
          "</div>" +
          '<div class="person-bottom">' +
            "<span>" + U.formatHours(m.allocated) + " / " + U.formatHours(m.capacity) + " allocated</span>" +
            "<span>" + leftText + "</span>" +
          "</div>" +
        "</div>"
      );
    }).join("");
  }

  function reportRows() {
    const today = U.isoDate();
    return state.team.map(function (m) {
      const mine = state.tasks.filter(function (t) { return t.assignee === m.id; });
      const completed = mine.filter(function (t) { return t.completedOn === today; }).length;
      const progress = mine.filter(function (t) { return t.status === "progress"; }).length;
      const blocked = mine.filter(function (t) { return t.status === "blocked"; }).length;
      const hours = hoursLoggedToday(m.id);
      return { member: m, hours, completed, progress, blocked, updated: hours > 0 };
    });
  }

  function renderReport() {
    document.getElementById("report").innerHTML = reportRows().map(function (r) {
      const parts = [];
      if (r.completed) parts.push(r.completed + " completed");
      if (r.progress) parts.push(r.progress + " in progress");
      if (r.blocked) parts.push(r.blocked + " blocked");
      const status = r.updated ? (parts.join(" · ") || "Time logged") : "⚠ No update received";

      return (
        '<div class="report-card">' +
          '<div class="report-name">' + U.escapeHtml(r.member.name) + "</div>" +
          '<div class="report-role">' + U.escapeHtml(r.member.role) + "</div>" +
          '<div class="report-hours">' + (r.updated ? U.formatHours(r.hours) : "—") + "</div>" +
          '<div class="report-status">' + status + "</div>" +
        "</div>"
      );
    }).join("");
  }

  /* ---------------- ACTIONS ---------------- */

  function setStatus(taskId, status) {
    const task = state.tasks.find(function (t) { return t.id === taskId; });
    if (!task) return;
    task.status = status;
    task.completedOn = status === "completed" ? U.isoDate() : null;
    saveState();
    render();
    toast(task.name + " marked " + STATUS_LABELS[status].toLowerCase());
  }

  function logTime(taskId, hours) {
    const task = state.tasks.find(function (t) { return t.id === taskId; });
    if (!task) return;
    state.logs.push({ taskId: task.id, memberId: task.assignee, hours: hours, date: U.isoDate() });
    if (task.status === "todo") task.status = "progress";
    saveState();
    render();
    toast("Logged " + U.formatHours(hours) + " on " + task.name);
  }

  function assignTask(data) {
    const task = {
      id: U.uid("t"),
      name: data.name,
      brand: data.brand,
      assignee: data.assignee,
      estimate: data.estimate,
      due: data.due,
      priority: data.priority,
      status: "todo",
      completedOn: null
    };
    state.tasks.push(task);
    const m = member(data.assignee);
    if (m) m.allocated += data.estimate;
    saveState();
    render();
    toast("Assigned " + task.name + " to " + (m ? m.name : "team"));
  }

  function exportCsv() {
    const today = U.isoDate();
    const quote = function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; };
    const lines = [["Date", "Name", "Role", "Hours logged", "Completed", "In progress", "Blocked", "Update received"].map(quote).join(",")];

    reportRows().forEach(function (r) {
      lines.push([today, r.member.name, r.member.role, r.hours, r.completed, r.progress, r.blocked, r.updated ? "Yes" : "No"].map(quote).join(","));
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "daily-report-" + today + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("Report exported");
  }

  /* ---------------- MODAL ---------------- */

  const modal = document.getElementById("taskModal");
  const form = document.getElementById("taskForm");
  const formError = document.getElementById("formError");

  function openModal() {
    document.getElementById("taskBrand").innerHTML = state.brands.map(function (b) {
      return "<option>" + U.escapeHtml(b) + "</option>";
    }).join("");

    document.getElementById("taskAssignee").innerHTML = state.team.map(function (m) {
      const left = m.capacity - m.allocated;
      return '<option value="' + m.id + '">' + U.escapeHtml(m.name) + " — " + U.escapeHtml(m.shortRole) +
        " (" + (left > 0 ? U.formatHours(left) + " free" : "full") + ")</option>";
    }).join("");

    form.reset();
    document.getElementById("taskDeadline").value = U.isoDate();
    formError.textContent = "";
    modal.classList.add("open");
    document.getElementById("taskName").focus();
  }

  function closeModal() {
    modal.classList.remove("open");
    document.getElementById("openModal").focus();
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    const name = document.getElementById("taskName").value.trim();
    const estimate = parseFloat(document.getElementById("taskEstimate").value);
    const due = document.getElementById("taskDeadline").value;

    if (!name) { formError.textContent = "Enter a task name."; return; }
    if (!(estimate > 0)) { formError.textContent = "Enter estimated hours greater than 0."; return; }
    if (!due) { formError.textContent = "Pick a deadline."; return; }

    assignTask({
      name: name,
      brand: document.getElementById("taskBrand").value,
      assignee: document.getElementById("taskAssignee").value,
      estimate: estimate,
      due: due,
      priority: document.getElementById("taskPriority").value
    });
    closeModal();
  });

  /* ---------------- TOAST ---------------- */

  let toastTimer;
  function toast(message) {
    const el = document.getElementById("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, 2400);
  }

  /* ---------------- EVENTS ---------------- */

  document.getElementById("openModal").addEventListener("click", openModal);
  document.getElementById("closeModal").addEventListener("click", closeModal);
  modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modal.classList.contains("open")) closeModal();
  });

  const taskList = document.getElementById("taskList");
  taskList.addEventListener("change", function (e) {
    if (e.target.dataset.action === "status") setStatus(e.target.dataset.id, e.target.value);
  });
  taskList.addEventListener("click", function (e) {
    const btn = e.target.closest("[data-action='log']");
    if (btn) logTime(btn.dataset.id, 0.5);
  });

  const searchInput = document.getElementById("searchInput");
  document.getElementById("searchToggle").addEventListener("click", function () {
    searchInput.hidden = !searchInput.hidden;
    if (!searchInput.hidden) {
      searchInput.focus();
    } else {
      searchInput.value = "";
      searchQuery = "";
      renderTasks();
    }
  });
  searchInput.addEventListener("input", function () {
    searchQuery = searchInput.value;
    renderTasks();
  });

  document.getElementById("exportReport").addEventListener("click", exportCsv);

  document.getElementById("notifyButton").addEventListener("click", function () {
    toast("Notifications are on the roadmap");
  });

  document.getElementById("nav").addEventListener("click", function (e) {
    const item = e.target.closest(".nav-item");
    if (item && item.dataset.view !== "Today") toast(item.dataset.view + " view is on the roadmap");
  });

  document.getElementById("resetData").addEventListener("click", function () {
    if (!confirm("Reset all tasks and time logs to the demo data?")) return;
    state = window.createSeedData();
    saveState();
    render();
    toast("Demo data restored");
  });

  /* ---------------- INIT ---------------- */

  document.getElementById("todayLabel").textContent =
    new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) +
    " · Creative Operations";

  render();
})();
