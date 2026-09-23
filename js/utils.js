/* Small helpers shared across the app. */
(function () {
  function isoDate(date) {
    const d = date || new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function addDays(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return isoDate(d);
  }

  function daysFromToday(iso) {
    const parts = iso.split("-").map(Number);
    const target = new Date(parts[0], parts[1] - 1, parts[2]);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((target - today) / 86400000);
  }

  function dueLabel(iso) {
    const diff = daysFromToday(iso);
    if (diff < 0) return { text: "Overdue by " + -diff + "d", overdue: true };
    if (diff === 0) return { text: "Due today" };
    if (diff === 1) return { text: "Due tomorrow" };
    const [y, m, d] = iso.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return { text: "Due " + date.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) };
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

  window.COUtils = { isoDate, addDays, daysFromToday, dueLabel, escapeHtml, formatHours, uid };
})();
