/* Supabase connection: sign-in, loading the team's data, saving changes and live updates. */
(function () {
  const cfg = window.TASKBOARD_CONFIG || {};
  const enabled = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);
  const LIB_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js";
  const READ_KEY = "creative-ops:notifications-read";
  const PAGE = 1000;

  let client = null;
  let session = null;
  let handlers = null;
  let channel = null;
  let refreshTimer = null;
  let loadStarted = false;

  /* ---------------- HELPERS ---------------- */

  function toSnake(obj) {
    const out = {};
    Object.keys(obj).forEach(function (k) {
      if (obj[k] !== undefined) out[k.replace(/[A-Z]/g, function (c) { return "_" + c.toLowerCase(); })] = obj[k];
    });
    return out;
  }

  function toCamel(obj) {
    const out = {};
    Object.keys(obj).forEach(function (k) {
      out[k.replace(/_([a-z])/g, function (_, c) { return c.toUpperCase(); })] = obj[k];
    });
    return out;
  }

  function loadLibrary() {
    return new Promise(function (resolve, reject) {
      if (window.supabase) return resolve();
      const s = document.createElement("script");
      s.src = LIB_URL;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("Couldn't load the Supabase library. Check your connection.")); };
      document.head.appendChild(s);
    });
  }

  async function fetchAll(table, order) {
    let rows = [];
    for (let from = 0; ; from += PAGE) {
      const res = await client.from(table).select("*").order(order).range(from, from + PAGE - 1);
      if (res.error) throw res.error;
      rows = rows.concat(res.data);
      if (res.data.length < PAGE) return rows;
    }
  }

  /* ---------------- SIGN-IN SCREEN ---------------- */

  const screen = document.getElementById("authScreen");

  function showScreen(html) {
    screen.innerHTML = '<div class="auth-card"><div class="logo auth-logo">CREATIVE <span>OPS</span></div>' + html + "</div>";
    screen.hidden = false;
    document.body.classList.add("auth-open");
  }

  function hideScreen() {
    screen.hidden = true;
    document.body.classList.remove("auth-open");
  }

  function showSignIn(message) {
    showScreen(
      "<h1>Sign in</h1>" +
      '<p class="auth-text">Enter your work email and we\'ll send you a sign-in link.</p>' +
      '<form id="signInForm" novalidate>' +
        '<div class="field"><label for="signInEmail">Email</label><input id="signInEmail" type="email" autocomplete="email" required /></div>' +
        '<p class="form-error" id="signInError" role="alert">' + (message || "") + "</p>" +
        '<button class="primary-button wide" type="submit">Send sign-in link</button>' +
      "</form>"
    );
    const form = document.getElementById("signInForm");
    document.getElementById("signInEmail").focus();
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      const email = document.getElementById("signInEmail").value.trim();
      const error = document.getElementById("signInError");
      if (!/^\S+@\S+\.\S+$/.test(email)) { error.textContent = "Enter a valid email address."; return; }
      const button = form.querySelector("button");
      button.disabled = true;
      button.textContent = "Sending…";
      const res = await client.auth.signInWithOtp({
        email: email,
        options: { emailRedirectTo: location.origin + location.pathname }
      });
      if (res.error) {
        error.textContent = res.error.message;
        button.disabled = false;
        button.textContent = "Send sign-in link";
        return;
      }
      showScreen(
        "<h1>Check your email</h1>" +
        '<p class="auth-text">We sent a sign-in link to <strong>' + COUtils.escapeHtml(email) + "</strong>. Open it on this device to continue.</p>" +
        '<button class="secondary-button" id="authBack">Use a different email</button>'
      );
      document.getElementById("authBack").addEventListener("click", function () { showSignIn(); });
    });
  }

  function showNotOnTeam(email) {
    showScreen(
      "<h1>You're not on the team yet</h1>" +
      '<p class="auth-text">You signed in as <strong>' + COUtils.escapeHtml(email) + "</strong>, but that email isn't on the team list. Ask a manager to add it in Settings → Team members, then reload this page.</p>" +
      '<button class="secondary-button" id="authSignOut">Sign out</button>'
    );
    document.getElementById("authSignOut").addEventListener("click", signOut);
  }

  function showError(message) {
    showScreen(
      "<h1>Something went wrong</h1>" +
      '<p class="auth-text">' + COUtils.escapeHtml(message) + "</p>" +
      '<button class="secondary-button" onclick="location.reload()">Try again</button>'
    );
  }

  /* ---------------- DATA ---------------- */

  async function fetchData() {
    const results = await Promise.all([
      fetchAll("members", "created_at"),
      fetchAll("brands", "name"),
      fetchAll("projects", "due"),
      fetchAll("tasks", "due"),
      fetchAll("time_logs", "date"),
      client.from("activity").select("*").order("at", { ascending: false }).limit(100),
      client.from("workspace").select("*").eq("id", 1).maybeSingle()
    ]);
    if (results[5].error) throw results[5].error;
    if (results[6].error) throw results[6].error;

    const email = (session.user.email || "").toLowerCase();
    const team = results[0].map(toCamel);
    const me = team.find(function (m) { return (m.email || "").toLowerCase() === email; });
    if (!me) return null;

    let readAt = null;
    try { readAt = localStorage.getItem(READ_KEY); } catch (e) { /* private mode */ }

    return {
      version: 2,
      settings: { userName: me.name, teamName: results[6].data ? results[6].data.team_name : "Creative Operations" },
      team: team,
      brands: results[1].map(function (b) { return b.name; }),
      projects: results[2].map(toCamel),
      tasks: results[3].map(toCamel),
      logs: results[4].map(toCamel),
      activity: results[5].data.map(toCamel),
      notificationsReadAt: readAt,
      me: { memberId: me.id, access: me.access, email: email }
    };
  }

  async function load() {
    if (loadStarted) return;
    loadStarted = true;
    try {
      const data = await fetchData();
      if (!data) {
        showNotOnTeam(session.user.email);
        return;
      }
      hideScreen();
      handlers.onData(data);
      subscribe();
    } catch (err) {
      console.error(err);
      showError(err.message || "Couldn't load the team's data.");
    }
  }

  /* Any change by anyone reloads the data; a short delay batches bursts of changes. */
  function refreshSoon() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async function () {
      try {
        const data = await fetchData();
        if (data) handlers.onData(data);
        else showNotOnTeam(session.user.email);
      } catch (err) {
        console.error(err);
      }
    }, 300);
  }

  function subscribe() {
    if (channel) return;
    channel = client.channel("taskboard")
      .on("postgres_changes", { event: "*", schema: "public" }, refreshSoon)
      .subscribe();
  }

  /*
    ops: [{ table, action: insert|update|upsert|delete, row, key }]
    Runs in order so that, for example, a task exists before time is logged on it.
  */
  async function apply(ops) {
    for (const op of ops) {
      const key = op.key || "id";
      let res;
      if (op.action === "insert") res = await client.from(op.table).insert(Array.isArray(op.row) ? op.row.map(toSnake) : toSnake(op.row));
      else if (op.action === "upsert") res = await client.from(op.table).upsert(Array.isArray(op.row) ? op.row.map(toSnake) : toSnake(op.row), { onConflict: key });
      else if (op.action === "update") res = await client.from(op.table).update(toSnake(op.row)).eq(key, op.id);
      else if (op.action === "delete") res = await client.from(op.table).delete().eq(key, op.id);
      if (res && res.error) throw res.error;
    }
  }

  function markRead(at) {
    try { localStorage.setItem(READ_KEY, at); } catch (e) { /* private mode */ }
  }

  async function signOut() {
    if (channel) { client.removeChannel(channel); channel = null; }
    await client.auth.signOut();
    location.hash = "";
    location.reload();
  }

  /* handlers: { onData(data) } — called on first load and whenever the data changes. */
  async function start(h) {
    handlers = h;
    showScreen('<p class="auth-text">Loading…</p>');
    try {
      await loadLibrary();
    } catch (err) {
      showError(err.message);
      return;
    }

    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

    client.auth.onAuthStateChange(function (event, s) {
      const had = session;
      session = s;
      /* Defer: calling Supabase inside this callback can deadlock the auth client. */
      if (event === "SIGNED_IN" && !had) setTimeout(load, 0);
      if (event === "SIGNED_OUT") showSignIn();
    });

    const res = await client.auth.getSession();
    session = res.data.session;

    /* The sign-in link returns with tokens in the URL hash; clear them so routing works. */
    if (/access_token|error_description/.test(location.hash)) {
      const err = new URLSearchParams(location.hash.slice(1)).get("error_description");
      history.replaceState(null, "", location.pathname + location.search + "#/today");
      if (err && !session) { showSignIn(err); return; }
    }

    if (session) load();
    else showSignIn();
  }

  window.COCloud = {
    enabled: enabled,
    start: start,
    apply: apply,
    refresh: refreshSoon,
    markRead: markRead,
    signOut: signOut
  };
})();
