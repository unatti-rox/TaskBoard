/* Toast and a reusable form modal. */
(function () {
  const U = window.COUtils;

  let toastTimer;
  function toast(message) {
    const el = document.getElementById("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, 2400);
  }

  /* ---------------- FORM MODAL ----------------
     form({
       title, submitLabel,
       fields: [ field | [field, field] ],   // an inner array renders as one row
       onSubmit(values) -> error message or nothing
     })
     field: { id, label, type: text|number|date|select|textarea, value, options: [{ value, label }],
              min, step, placeholder, required }
  */

  const overlay = document.getElementById("formModal");
  const formEl = document.getElementById("modalForm");
  let current = null;
  let opener = null;

  function fieldHtml(f) {
    const id = "f_" + f.id;
    const value = f.value === undefined || f.value === null ? "" : f.value;
    let control;

    if (f.type === "select") {
      control = '<select id="' + id + '" name="' + f.id + '">' + f.options.map(function (o) {
        return '<option value="' + U.escapeHtml(o.value) + '"' + (String(o.value) === String(value) ? " selected" : "") + ">" +
          U.escapeHtml(o.label) + "</option>";
      }).join("") + "</select>";
    } else if (f.type === "textarea") {
      control = '<textarea id="' + id + '" name="' + f.id + '" rows="3"' +
        (f.placeholder ? ' placeholder="' + U.escapeHtml(f.placeholder) + '"' : "") + ">" + U.escapeHtml(value) + "</textarea>";
    } else {
      control = '<input id="' + id + '" name="' + f.id + '" type="' + (f.type || "text") + '" value="' + U.escapeHtml(value) + '"' +
        (f.min !== undefined ? ' min="' + f.min + '"' : "") +
        (f.step !== undefined ? ' step="' + f.step + '"' : "") +
        (f.placeholder ? ' placeholder="' + U.escapeHtml(f.placeholder) + '"' : "") + " />";
    }

    return '<div class="field"><label for="' + id + '">' + U.escapeHtml(f.label) + "</label>" + control + "</div>";
  }

  function form(config) {
    current = config;
    opener = document.activeElement;

    const body = config.fields.map(function (f) {
      if (Array.isArray(f)) {
        return '<div class="field-row" style="--cols:' + f.length + '">' + f.map(fieldHtml).join("") + "</div>";
      }
      return fieldHtml(f);
    }).join("");

    formEl.innerHTML =
      '<h2 id="modalTitle">' + U.escapeHtml(config.title) + "</h2>" +
      body +
      '<p class="form-error" id="formError" role="alert"></p>' +
      '<div class="modal-actions">' +
        '<button type="button" class="secondary-button" data-close>Cancel</button>' +
        '<button type="submit" class="primary-button">' + U.escapeHtml(config.submitLabel || "Save") + "</button>" +
      "</div>";

    overlay.classList.add("open");
    const first = formEl.querySelector("input, select, textarea");
    if (first) first.focus();
  }

  function values() {
    const out = {};
    const flat = [].concat.apply([], current.fields);
    flat.forEach(function (f) {
      const el = formEl.elements[f.id];
      let v = el.value;
      if (f.type === "number") v = parseFloat(v);
      else if (typeof v === "string") v = v.trim();
      out[f.id] = v;
    });
    return out;
  }

  function close() {
    overlay.classList.remove("open");
    current = null;
    if (opener && document.body.contains(opener)) opener.focus();
  }

  formEl.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!current) return;
    const error = current.onSubmit(values());
    if (error) {
      document.getElementById("formError").textContent = error;
      return;
    }
    close();
  });

  formEl.addEventListener("click", function (e) {
    if (e.target.closest("[data-close]")) close();
  });
  overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && overlay.classList.contains("open")) close();
  });

  window.COUI = { toast: toast, form: form, closeForm: close };
})();
