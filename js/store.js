/* State, persistence, derived numbers and every change to the data. */
(function () {
  const U = window.COUtils;
  const STORAGE_KEY = "creative-ops:v1";
  const ACTIVITY_LIMIT = 100;

  const STATUS_LABELS = {
    todo: "To Do",
    progress: "In Progress",
    completed: "Completed",
    blocked: "Blocked"
  };

  let state = load();

  /* ---------------- PERSISTENCE ---------------- */

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return migrate(JSON.parse(raw));
    } catch (e) {
      console.warn("Could not read saved data, using demo data.", e);
    }
    return window.createSeedData();
  }

  /* Bring data saved by older versions up to the current shape. */
  function migrate(data) {
    if (!data || !Array.isArray(data.tasks) || !Array.isArray(data.team) || !Array.isArray(data.logs)) throw new Error("Unrecognised data");

    if (!data.version || data.version < 2) {
      const weekStart = U.startOfWeek();
      data.settings = data.settings || { userName: "Anika Kapoor", teamName: "Creative Operations" };
      data.projects = data.projects || [];
      data.activity = data.activity || [];
      data.notificationsReadAt = data.notificationsReadAt || null;
      data.tasks.forEach(function (t) {
        if (t.projectId === undefined) t.projectId = null;
        if (t.note === undefined) t.note = "";
        if (!t.createdOn) t.createdOn = U.isoDate();
      });
      data.logs.forEach(function (l, i) {
        if (!l.id) l.id = "l_m" + i;
        if (l.note === undefined) l.note = "";
      });
      /* v1 stored a single "allocated" number; keep it by booking the remainder as other work. */
      data.team.forEach(function (m) {
        if (m.otherHours === undefined) {
          const taskHours = U.sum(data.tasks.filter(function (t) {
            return t.assignee === m.id && (t.status !== "completed" || (t.completedOn || "") >= weekStart);
          }), function (t) { return t.estimate; });
          m.otherHours = Math.max(0, (m.allocated || 0) - taskHours);
        }
        delete m.allocated;
      });
      data.version = 2;
    }
    return data;
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("Could not save data.", e);
    }
  }

  function commit(activityText) {
    if (activityText) {
      state.activity.unshift({ id: U.uid("a"), at: new Date().toISOString(), text: activityText });
      state.activity.length = Math.min(state.activity.length, ACTIVITY_LIMIT);
    }
    save();
    if (typeof S.onChange === "function") S.onChange();
  }

  /* ---------------- LOOKUPS ---------------- */

  function member(id) {
    return state.team.find(function (m) { return m.id === id; });
  }

  function memberName(id) {
    const m = member(id);
    return m ? m.name : "Unassigned";
  }

  function task(id) {
    return state.tasks.find(function (t) { return t.id === id; });
  }

  function project(id) {
    return state.projects.find(function (p) { return p.id === id; });
  }

  /* ---------------- DERIVED NUMBERS ---------------- */

  function hoursLoggedOnTask(taskId) {
    return U.sum(state.logs.filter(function (l) { return l.taskId === taskId; }), function (l) { return l.hours; });
  }

  function hoursLogged(opts) {
    return U.sum(logsWhere(opts), function (l) { return l.hours; });
  }

  /* opts: { memberId, date, from, to, taskIds } — all optional */
  function logsWhere(opts) {
    const o = opts || {};
    return state.logs.filter(function (l) {
      if (o.memberId && l.memberId !== o.memberId) return false;
      if (o.date && l.date !== o.date) return false;
      if (o.from && l.date < o.from) return false;
      if (o.to && l.date > o.to) return false;
      if (o.taskIds && !o.taskIds.has(l.taskId)) return false;
      return true;
    });
  }

  /* This week's load: open tasks plus anything finished since Monday, plus other booked work. */
  function weekTasks(memberId) {
    const weekStart = U.startOfWeek();
    return state.tasks.filter(function (t) {
      return t.assignee === memberId && (t.status !== "completed" || (t.completedOn || "") >= weekStart);
    });
  }

  function allocation(m) {
    const allocated = U.sum(weekTasks(m.id), function (t) { return t.estimate; }) + (m.otherHours || 0);
    const pct = m.capacity ? Math.round((allocated / m.capacity) * 100) : 0;
    return { allocated: allocated, free: m.capacity - allocated, pct: pct };
  }

  function isOverdue(t) {
    return t.status !== "completed" && U.daysFromToday(t.due) < 0;
  }

  function reportFor(date) {
    return state.team.map(function (m) {
      const mine = state.tasks.filter(function (t) { return t.assignee === m.id; });
      const logs = logsWhere({ memberId: m.id, date: date });
      const hours = U.sum(logs, function (l) { return l.hours; });
      const isToday = date === U.isoDate();
      const worked = {};
      logs.forEach(function (l) { worked[l.taskId] = (worked[l.taskId] || 0) + l.hours; });

      return {
        member: m,
        hours: hours,
        completed: mine.filter(function (t) { return t.completedOn === date; }).length,
        /* Current status only makes sense for today; for past days count what they touched. */
        progress: isToday ? mine.filter(function (t) { return t.status === "progress"; }).length : null,
        blocked: isToday ? mine.filter(function (t) { return t.status === "blocked"; }).length : null,
        updated: hours > 0,
        worked: Object.keys(worked).map(function (id) { return { task: task(id), hours: worked[id] }; })
      };
    });
  }

  /* Things that need someone's attention right now. */
  function alerts() {
    const today = U.isoDate();
    const list = [];

    state.tasks.forEach(function (t) {
      if (t.status === "blocked") {
        list.push({ level: "critical", taskId: t.id, text: t.name + " is blocked" + (t.note ? ": " + t.note : ""), meta: memberName(t.assignee) });
      } else if (isOverdue(t)) {
        list.push({ level: "critical", taskId: t.id, text: t.name + " is overdue", meta: memberName(t.assignee) + " · " + U.dueLabel(t.due).text });
      } else if (t.status === "todo" && t.due === today) {
        list.push({ level: "warning", taskId: t.id, text: t.name + " is due today and not started", meta: memberName(t.assignee) });
      }
    });

    state.team.forEach(function (m) {
      const a = allocation(m);
      if (a.free < 0) list.push({ level: "warning", memberId: m.id, text: m.name + " is over capacity by " + U.formatHours(-a.free), meta: "This week" });
    });

    const missing = state.team.filter(function (m) { return hoursLogged({ memberId: m.id, date: today }) === 0; });
    if (missing.length) {
      list.push({
        level: "info",
        text: "No time logged today by " + missing.map(function (m) { return m.name; }).join(", "),
        meta: "Daily report"
      });
    }
    return list;
  }

  function unreadActivityCount() {
    const since = state.notificationsReadAt || "";
    return state.activity.filter(function (a) { return a.at > since; }).length;
  }

  /* ---------------- TASKS ---------------- */

  function saveTask(data) {
    const existing = data.id && task(data.id);
    if (existing) {
      const reassigned = existing.assignee !== data.assignee;
      Object.assign(existing, {
        name: data.name, projectId: data.projectId || null, brand: data.brand, assignee: data.assignee,
        estimate: data.estimate, due: data.due, priority: data.priority, note: data.note || ""
      });
      commit(reassigned ? existing.name + " reassigned to " + memberName(data.assignee) : existing.name + " updated");
      return existing;
    }

    const t = {
      id: U.uid("t"),
      name: data.name,
      projectId: data.projectId || null,
      brand: data.brand,
      assignee: data.assignee,
      estimate: data.estimate,
      due: data.due,
      priority: data.priority,
      status: "todo",
      completedOn: null,
      note: data.note || "",
      createdOn: U.isoDate()
    };
    state.tasks.push(t);
    commit(state.settings.userName + " assigned " + t.name + " to " + memberName(t.assignee));
    return t;
  }

  function deleteTask(id) {
    const t = task(id);
    if (!t) return;
    state.tasks = state.tasks.filter(function (x) { return x.id !== id; });
    state.logs = state.logs.filter(function (l) { return l.taskId !== id; });
    commit(t.name + " deleted");
  }

  function setStatus(id, status, note) {
    const t = task(id);
    if (!t) return;
    t.status = status;
    t.completedOn = status === "completed" ? U.isoDate() : null;
    if (status === "blocked" && note !== undefined) t.note = note;
    commit(memberName(t.assignee) + " — " + t.name + " marked " + STATUS_LABELS[status].toLowerCase() +
      (status === "blocked" && t.note ? ": " + t.note : ""));
  }

  /* ---------------- TIME LOGS ---------------- */

  function logTime(taskId, hours, date, note) {
    const t = task(taskId);
    if (!t) return;
    state.logs.push({ id: U.uid("l"), taskId: t.id, memberId: t.assignee, hours: hours, date: date || U.isoDate(), note: note || "" });
    if (t.status === "todo") t.status = "progress";
    commit(memberName(t.assignee) + " logged " + U.formatHours(hours) + " on " + t.name);
  }

  function deleteLog(id) {
    const l = state.logs.find(function (x) { return x.id === id; });
    if (!l) return;
    state.logs = state.logs.filter(function (x) { return x.id !== id; });
    const t = task(l.taskId);
    commit("Removed " + U.formatHours(l.hours) + " logged on " + (t ? t.name : "a task"));
  }

  /* ---------------- PROJECTS & BRANDS ---------------- */

  function saveProject(data) {
    const existing = data.id && project(data.id);
    if (existing) {
      Object.assign(existing, { name: data.name, brand: data.brand, due: data.due });
      /* Keep tasks' brand in line with their project. */
      state.tasks.forEach(function (t) { if (t.projectId === existing.id) t.brand = existing.brand; });
      commit("Project " + existing.name + " updated");
      return existing;
    }
    const p = { id: U.uid("p"), name: data.name, brand: data.brand, due: data.due, archived: false };
    state.projects.push(p);
    commit("Project " + p.name + " created for " + p.brand);
    return p;
  }

  function setProjectArchived(id, archived) {
    const p = project(id);
    if (!p) return;
    p.archived = archived;
    commit("Project " + p.name + (archived ? " archived" : " restored"));
  }

  function addBrand(name) {
    const clean = name.trim();
    if (!clean) return "Enter a brand name.";
    if (state.brands.some(function (b) { return b.toLowerCase() === clean.toLowerCase(); })) return clean + " already exists.";
    state.brands.push(clean);
    commit("Brand " + clean + " added");
    return null;
  }

  function removeBrand(name) {
    const inUse = state.tasks.some(function (t) { return t.brand === name; }) ||
      state.projects.some(function (p) { return p.brand === name; });
    if (inUse) return name + " still has tasks or projects.";
    state.brands = state.brands.filter(function (b) { return b !== name; });
    commit("Brand " + name + " removed");
    return null;
  }

  /* ---------------- TEAM & SETTINGS ---------------- */

  function saveMember(data) {
    const existing = data.id && member(data.id);
    if (existing) {
      Object.assign(existing, {
        name: data.name, role: data.role, shortRole: data.shortRole, capacity: data.capacity, otherHours: data.otherHours
      });
      commit(existing.name + "'s details updated");
      return existing;
    }
    const m = {
      id: U.uid("m"), name: data.name, role: data.role, shortRole: data.shortRole,
      capacity: data.capacity, otherHours: data.otherHours
    };
    state.team.push(m);
    commit(m.name + " joined the team");
    return m;
  }

  function removeMember(id) {
    const m = member(id);
    if (!m) return;
    const open = state.tasks.filter(function (t) { return t.assignee === id && t.status !== "completed"; });
    if (open.length) return m.name + " still has " + open.length + " open task" + (open.length > 1 ? "s" : "") + ". Reassign them first.";
    state.team = state.team.filter(function (x) { return x.id !== id; });
    commit(m.name + " removed from the team");
    return null;
  }

  function saveSettings(data) {
    Object.assign(state.settings, data);
    commit();
  }

  function markNotificationsRead() {
    state.notificationsReadAt = new Date().toISOString();
    commit();
  }

  function replaceAll(data) {
    state = migrate(data);
    commit("Data imported");
  }

  function reload() {
    state = load();
    if (typeof S.onChange === "function") S.onChange();
  }

  function reset() {
    state = window.createSeedData();
    commit();
  }

  const S = {
    STATUS_LABELS: STATUS_LABELS,
    STORAGE_KEY: STORAGE_KEY,
    get state() { return state; },
    onChange: null,
    member, memberName, task, project,
    hoursLoggedOnTask, hoursLogged, logsWhere, weekTasks, allocation, isOverdue, reportFor, alerts, unreadActivityCount,
    saveTask, deleteTask, setStatus, logTime, deleteLog,
    saveProject, setProjectArchived, addBrand, removeBrand,
    saveMember, removeMember, saveSettings, markNotificationsRead, replaceAll, reload, reset
  };

  window.COStore = S;
})();
