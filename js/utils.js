/* Small helpers shared across the app. */
(function () {
  function isoDate(date) {
    const d = date || new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function parseIso(iso) {
    const parts = iso.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function addDays(n, fromIso) {
    const d = fromIso ? parseIso(fromIso) : new Date();
    d.setDate(d.getDate() + n);
    return isoDate(d);
  }

  function daysFromToday(iso) {
    const target = parseIso(iso);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((target - today) / 86400000);
  }

  /* Monday of the week containing the given date (defaults to today). */
  function startOfWeek(iso) {
    const d = iso ? parseIso(iso) : new Date();
    const offset = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - offset);
    return isoDate(d);
  }

  function formatDate(iso, opts) {
    return parseIso(iso).toLocaleDateString("en-GB", opts || { day: "numeric", month: "short" });
  }

  function dueLabel(iso) {
    const diff = daysFromToday(iso);
    if (diff < 0) return { text: "Overdue by " + -diff + "d", overdue: true };
    if (diff === 0) return { text: "Due today" };
    if (diff === 1) return { text: "Due tomorrow" };
    return { text: "Due " + formatDate(iso) };
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function formatHours(h) {
    return Math.round(h * 10) / 10 + "h";
  }

  function uid(prefix) {
    return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function sum(list, fn) {
    return list.reduce(function (total, item) { return total + fn(item); }, 0);
  }

  function initials(name) {
    return String(name).trim().split(/\s+/).map(function (p) { return p[0]; }).join("").slice(0, 2).toUpperCase();
  }

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type: type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function csv(rows) {
    const quote = function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; };
    return rows.map(function (r) { return r.map(quote).join(","); }).join("\n");
  }

  window.COUtils = {
    isoDate, parseIso, addDays, daysFromToday, startOfWeek, formatDate, dueLabel,
    escapeHtml, formatHours, uid, sum, initials, downloadFile, csv
  };
})();
