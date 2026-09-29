/* ==========================================================================
   40-theme.js — PM.theme (theming, the token editor's engine, CSS export) and
   PM.views.data (the "Data & theme" tab: the provenance panel).

   Two jobs live in one file because they are the same job seen twice: the
   token editor is the write half of the CSS contract in SCHEMA.md §6, and the
   provenance panel is the read half of the data contract in §3. Both exist so
   the dashboard can be interrogated rather than believed.

   Constraints this file is written against:
     - No colour literal, anywhere. 00-tokens.css is the only file allowed to
       name a colour, so every colour here is read back out of the cascade at
       runtime. That is also why `tokens()` carries no colour fallbacks.
     - Every localStorage touch is wrapped. A file:// page with site data
       disabled throws on access, and a dashboard that refuses to render
       because it cannot remember a colour is a bad trade.
     - No innerHTML. Token names, provenance notes and payload text all reach
       the DOM through U.el() / text nodes only.
   ========================================================================== */

window.PM = window.PM || {};
PM.views = PM.views || {};

(function () {
  "use strict";

  var U = PM.util;
  var el = U.el;

  var MODES = ["auto", "light", "dark"];
  var KEY_THEME = "pm.theme";
  var KEY_TOKENS = "pm.tokens";
  var EXPORT_NAME = "dashboard.custom.css";

  /* Chips are a scan aid, not a manifest: past ~40 the list stops being
     readable and the count carries the information instead. */
  var CHIP_CAP = 40;

  /* How much of the pretty-printed payload the Payload card paints. A reader
     auditing a number wants the shape, not a 2 MB reflow. */
  var PAYLOAD_PREVIEW = 2000;

  /* ----------------------------------------------------------------------
     Storage. Falls back to an in-memory map so that every caller can treat
     persistence as best-effort and none of them has to know it failed.
     ---------------------------------------------------------------------- */

  var memory = {};

  function storageGet(key) {
    try {
      var value = window.localStorage.getItem(key);
      if (value != null) return value;
    } catch (e) { /* private mode, file:// with site data off, quota policy */ }
    return memory[key] == null ? null : memory[key];
  }

  function storageSet(key, value) {
    memory[key] = value;
    try { window.localStorage.setItem(key, value); } catch (e) { /* see above */ }
  }

  function storageRemove(key) {
    delete memory[key];
    try { window.localStorage.removeItem(key); } catch (e) { /* see above */ }
  }

  /* ----------------------------------------------------------------------
     The closed token set — SCHEMA.md §6, in table order.

     `fallback` is null for every token the light/dark palettes define, and
     that is deliberate: a fallback for those would be a hex literal in JS,
     which the CSS contract forbids and which would silently diverge from
     00-tokens.css the first time a palette changed. The live computed value
     is the only legitimate source for a colour. --pm-shadow is null for the
     same reason — its value contains colour.
     ---------------------------------------------------------------------- */

  var TOKENS = [
    { group: "Surface", name: "--pm-bg", fallback: null },
    { group: "Surface", name: "--pm-bg-elev", fallback: null },
    { group: "Surface", name: "--pm-bg-sunken", fallback: null },
    { group: "Surface", name: "--pm-border", fallback: null },
    { group: "Surface", name: "--pm-border-strong", fallback: null },

    { group: "Text", name: "--pm-fg", fallback: null },
    { group: "Text", name: "--pm-fg-muted", fallback: null },
    { group: "Text", name: "--pm-fg-faint", fallback: null },
    { group: "Text", name: "--pm-fg-inverse", fallback: null },

    { group: "Accent", name: "--pm-accent", fallback: null },
    { group: "Accent", name: "--pm-accent-fg", fallback: null },
    { group: "Accent", name: "--pm-accent-weak", fallback: null },

    { group: "Semantic", name: "--pm-ok", fallback: null },
    { group: "Semantic", name: "--pm-ok-weak", fallback: null },
    { group: "Semantic", name: "--pm-warn", fallback: null },
    { group: "Semantic", name: "--pm-warn-weak", fallback: null },
    { group: "Semantic", name: "--pm-bad", fallback: null },
    { group: "Semantic", name: "--pm-bad-weak", fallback: null },
    { group: "Semantic", name: "--pm-info", fallback: null },
    { group: "Semantic", name: "--pm-info-weak", fallback: null },

    { group: "Series", name: "--pm-series-1", fallback: null },
    { group: "Series", name: "--pm-series-2", fallback: null },
    { group: "Series", name: "--pm-series-3", fallback: null },
    { group: "Series", name: "--pm-series-4", fallback: null },
    { group: "Series", name: "--pm-series-5", fallback: null },
    { group: "Series", name: "--pm-series-6", fallback: null },
    { group: "Series", name: "--pm-series-7", fallback: null },
    { group: "Series", name: "--pm-series-8", fallback: null },

    { group: "Chart", name: "--pm-grid", fallback: null },
    { group: "Chart", name: "--pm-axis", fallback: null },
    { group: "Chart", name: "--pm-ref", fallback: null },
    { group: "Chart", name: "--pm-tooltip-bg", fallback: null },
    { group: "Chart", name: "--pm-tooltip-fg", fallback: null },

    { group: "Shape", name: "--pm-radius", fallback: "10px" },
    { group: "Shape", name: "--pm-radius-sm", fallback: "6px" },
    { group: "Shape", name: "--pm-gap", fallback: "16px" },
    { group: "Shape", name: "--pm-pad", fallback: "18px" },
    { group: "Shape", name: "--pm-shadow", fallback: null },

    { group: "Type", name: "--pm-font", fallback: "system-ui, sans-serif" },
    { group: "Type", name: "--pm-font-mono", fallback: "ui-monospace, monospace" },
    { group: "Type", name: "--pm-fs-base", fallback: "14px" },
    { group: "Type", name: "--pm-fs-sm", fallback: "12px" },
    { group: "Type", name: "--pm-fs-lg", fallback: "17px" },
    { group: "Type", name: "--pm-fs-xl", fallback: "26px" }
  ];

  /* ----------------------------------------------------------------------
     Colour parsing. Used only to decide which control a row gets and to feed
     `input[type=color]`, which accepts nothing but `#rrggbb`.
     ---------------------------------------------------------------------- */

  function clamp255(value) {
    var v = Math.round(value);
    return v < 0 ? 0 : v > 255 ? 255 : v;
  }

  function hex2(value) {
    return ("0" + clamp255(value).toString(16)).slice(-2);
  }

  /* Returns "#rrggbb" for anything a colour input can hold, else null.
     Anchored at the start on purpose: --pm-shadow's value *contains* rgba()
     but is a shadow, not a colour, and must not get a colour picker. */
  function parseColor(value) {
    var raw = String(value == null ? "" : value).trim();
    if (!raw) return null;

    var hex = /^#([0-9a-fA-F]{3,8})$/.exec(raw);
    if (hex) {
      var h = hex[1];
      if (h.length === 3 || h.length === 4) {
        return "#" + h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) +
                     h.charAt(2) + h.charAt(2);
      }
      if (h.length === 6 || h.length === 8) return "#" + h.slice(0, 6).toLowerCase();
      return null;
    }

    var rgb = /^rgba?\(([^)]*)\)$/i.exec(raw);
    if (rgb) {
      var parts = rgb[1].split(/[,/\s]+/).filter(function (p) { return p !== ""; });
      if (parts.length < 3) return null;
      var channels = [];
      for (var i = 0; i < 3; i++) {
        var p = parts[i];
        var num = parseFloat(p);
        if (!isFinite(num)) return null;
        channels.push(p.indexOf("%") >= 0 ? (num / 100) * 255 : num);
      }
      return "#" + hex2(channels[0]) + hex2(channels[1]) + hex2(channels[2]);
    }

    return null;
  }

  /* ----------------------------------------------------------------------
     PM.theme
     ---------------------------------------------------------------------- */

  var overrideMap = readOverrides();
  var wired = false;

  function readOverrides() {
    var raw = storageGet(KEY_TOKENS);
    if (!raw) return {};
    var parsed;
    try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
    if (!parsed || typeof parsed !== "object") {
      /* A corrupt map is dropped rather than half-applied: a partially
         overridden palette is harder to diagnose than a default one. */
      storageRemove(KEY_TOKENS);
      return {};
    }
    var clean = {};
    Object.keys(parsed).forEach(function (name) {
      if (name.slice(0, 2) === "--" && parsed[name] != null) {
        clean[name] = String(parsed[name]);
      }
    });
    return clean;
  }

  function persistOverrides() {
    if (!Object.keys(overrideMap).length) { storageRemove(KEY_TOKENS); return; }
    var text;
    try { text = JSON.stringify(overrideMap); } catch (e) { return; }
    storageSet(KEY_TOKENS, text);
  }

  function fire(name, detail) {
    var ev;
    try {
      ev = new CustomEvent(name, { detail: detail });
    } catch (e) {
      ev = document.createEvent("CustomEvent");
      ev.initCustomEvent(name, false, false, detail);
    }
    window.dispatchEvent(ev);
  }

  function mediaQuery() {
    return window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  }

  function get() {
    var stored = storageGet(KEY_THEME);
    return MODES.indexOf(stored) >= 0 ? stored : "auto";
  }

  function effective() {
    var mode = get();
    if (mode !== "auto") return mode;
    var mq = mediaQuery();
    return mq && mq.matches ? "dark" : "light";
  }

  function label(mode) {
    return mode.charAt(0).toUpperCase() + mode.slice(1);
  }

  /* Both <html> and <body> carry data-theme: 00-tokens.css selects on the bare
     [data-theme] attribute, template.html sets it on both, and moving only one
     leaves the other advertising the old palette to any future selector. */
  function set(mode) {
    var next = MODES.indexOf(mode) >= 0 ? mode : "auto";
    if (document.documentElement) document.documentElement.dataset.theme = next;
    if (document.body) document.body.dataset.theme = next;
    storageSet(KEY_THEME, next);

    var labelNode = document.getElementById("pm-theme-label");
    if (labelNode) labelNode.textContent = label(next);

    fire("pm:themechange", { mode: next, effective: effective() });
    return next;
  }

  function cycle() {
    var i = MODES.indexOf(get());
    return set(MODES[(i + 1) % MODES.length]);
  }

  function read(name) {
    var value = "";
    try {
      if (document.body) {
        value = window.getComputedStyle(document.body).getPropertyValue(name);
      }
      if (!value && document.documentElement) {
        value = window.getComputedStyle(document.documentElement).getPropertyValue(name);
      }
    } catch (e) { value = ""; }
    value = String(value || "").trim();
    if (value) return value;

    for (var i = 0; i < TOKENS.length; i++) {
      if (TOKENS[i].name === name) return TOKENS[i].fallback || "";
    }
    return "";
  }

  /* An inline custom property on <body> beats every stylesheet selector, which
     is what makes the editor feel live — and is also why the exported file
     needs !important to win against it.

     Deliberately silent: no 'pm:themechange' fires here. Every chart takes its
     colour from a class bound to these tokens, so the cascade repaints on its
     own, and firing the event would have PM.app rebuild the panel under the
     control the user is still dragging. */
  function override(name, value) {
    if (!name || name.slice(0, 2) !== "--") return;
    var text = String(value == null ? "" : value);
    if (document.body) document.body.style.setProperty(name, text);
    overrideMap[name] = text;
    persistOverrides();
  }

  function clearOverride(name) {
    if (document.body) document.body.style.removeProperty(name);
    delete overrideMap[name];
    persistOverrides();
  }

  function clearAll() {
    Object.keys(overrideMap).forEach(function (name) {
      if (document.body) document.body.style.removeProperty(name);
    });
    overrideMap = {};
    persistOverrides();
  }

  function overrides() {
    var copy = {};
    Object.keys(overrideMap).forEach(function (name) { copy[name] = overrideMap[name]; });
    return copy;
  }

  function apply() {
    if (!document.body) return;
    Object.keys(overrideMap).forEach(function (name) {
      document.body.style.setProperty(name, overrideMap[name]);
    });
  }

  /* A value is about to be written into a comment-free declaration block, so
     anything that could close the declaration, the rule or the file's own
     header comment is stripped. Colours and lengths lose nothing to this. */
  function sanitize(value) {
    return String(value == null ? "" : value)
      .replace(/\*\//g, "")
      .replace(/[;{}<>]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function exportCss() {
    var names = TOKENS.map(function (t) { return t.name; })
                      .filter(function (name) { return overrideMap[name] != null; });
    var known = names.length;
    /* An override for a token no longer in the closed set is still the user's
       and still exported — dropping it silently would lose their work. It is
       counted separately below, because "45 of 44" is not a number a reader
       can act on. */
    Object.keys(overrideMap).forEach(function (name) {
      if (names.indexOf(name) < 0) names.push(name);
    });
    var strays = names.length - known;

    var head = [
      "/* " + EXPORT_NAME + " — written by the token editor on the Data & theme tab.",
      "",
      "   WHERE THIS FILE GOES",
      "   Save it beside the generated dashboard HTML, in the same folder. The",
      "   page links it last, after every inlined stylesheet, and its absence is",
      "   not an error: it is optional by design, so a dashboard shipped without",
      "   it renders exactly as generated.",
      "",
      "   WHY EVERY DECLARATION IS !important",
      "   Three things set these tokens, in increasing strength:",
      "     1. css/00-tokens.css, under [data-theme=\"light\"] / [data-theme=\"dark\"];",
      "     2. this file, under body[data-theme] — more specific, and loaded last;",
      "     3. the token editor itself, which writes the same properties inline on",
      "        <body>, and an inline declaration outranks any selector.",
      "   Only !important outranks an inline declaration. Without it this file",
      "   would lose to whatever editor session happens to be remembered in the",
      "   reader's browser; with it, the file wins on every machine and travels",
      "   with the HTML.",
      "",
      "   Mode when exported: " + get() + " (rendering " + effective() + ").",
      "   Tokens overridden: " + known + " of " + TOKENS.length +
        (strays ? ", plus " + strays + " no longer in the closed token set" : "") + ".",
      "*/",
      ""
    ].join("\n");

    if (!names.length) {
      return head + "/* No token overrides yet. Change a token in the editor and\n" +
             "   this file fills itself in. */\n";
    }

    var lines = ["body[data-theme] {"];
    names.forEach(function (name) {
      lines.push("  " + name + ": " + sanitize(overrideMap[name]) + " !important;");
    });
    lines.push("}");
    return head + lines.join("\n") + "\n";
  }

  function init() {
    set(get());
    apply();
    if (wired) return;
    wired = true;

    var toggle = document.getElementById("pm-theme-toggle");
    if (toggle) toggle.addEventListener("click", function () { cycle(); });

    /* In "auto" the palette changes with no event of our own, so the OS query
       has to re-announce it or every chart keeps its stale rendering. */
    var mq = mediaQuery();
    if (mq) {
      var onSystemChange = function () {
        if (get() === "auto") fire("pm:themechange", { mode: "auto", effective: effective() });
      };
      if (mq.addEventListener) mq.addEventListener("change", onSystemChange);
      else if (mq.addListener) mq.addListener(onSystemChange);
    }
  }

  PM.theme = {
    MODES: MODES,
    get: get,
    set: set,
    cycle: cycle,
    tokens: function () { return TOKENS.slice(); },
    effective: effective,
    read: read,
    override: override,
    clearOverride: clearOverride,
    clearAll: clearAll,
    overrides: overrides,
    apply: apply,
    exportCss: exportCss,
    init: init,
    parseColor: parseColor
  };

  /* ==========================================================================
     PM.views.data — the Data & theme tab
     ========================================================================== */

  /* SCHEMA.md §1.2's ten sources, in its own precedence order, each with the
     one clause a reader needs to weigh a number derived from it. */
  var SOURCE_ORDER = [
    "header_date", "status_line", "log_md", "filename", "body_found_during",
    "git_added", "git_last", "roadmap_sprint", "file_mtime", "unknown"
  ];

  var SOURCE_DESC = {
    header_date: "Hand-recorded in a purpose-built Date header — highest trust.",
    status_line: "Hand-recorded in the brief's Status line — highest trust.",
    log_md: "Hand-recorded in the audit trail, dated by the author — high trust.",
    filename: "Hand-chosen YYYY-MM-DD filename — high trust.",
    body_found_during: "Hand-recorded Found during line in the item's own body — high trust.",
    git_added: "Derived from commit history: the first commit that added the file.",
    git_last: "Derived from commit history: the last commit that touched the file.",
    roadmap_sprint: "The sprint's date range only — approximate to sprint granularity.",
    file_mtime: "Filesystem timestamp — weak; records when the file was written, not when the work happened.",
    unknown: "Nothing resolved; the date is null and the task is excluded from time series."
  };

  /* Sources that make a date approximate rather than observed. Kept in one
     place because both the table and the derived counts below read it. */
  var WEAK_SOURCES = { roadmap_sprint: 1, file_mtime: 1 };

  function dl(rows) {
    var kids = [];
    (rows || []).forEach(function (row) {
      if (!row) return;
      kids.push(el("dt", { text: row[0] }));
      kids.push(el("dd", null, row[1] == null || row[1] === "" ? "—" : row[1]));
    });
    return el("dl", { class: "pm-dl" }, kids);
  }

  function chips(values, emptyMessage) {
    var list = (values || []).filter(function (v) { return v != null; });
    if (!list.length) return U.empty(emptyMessage);
    var nodes = list.slice(0, CHIP_CAP).map(function (v) {
      return el("span", { class: "pm-chip", text: String(v) });
    });
    if (list.length > CHIP_CAP) {
      nodes.push(el("span", {
        class: "pm-chip",
        title: "Capped at " + CHIP_CAP + " chips; the full list is in the payload below.",
        text: "+" + (list.length - CHIP_CAP) + " more"
      }));
    }
    return el("div", { class: "pm-chips" }, nodes);
  }

  function pre(text) {
    return el("pre", { class: "pm-code", tabindex: "0", text: text });
  }

  function button(text, title, onClick) {
    return el("button", {
      class: "pm-btn", type: "button", title: title || "", onclick: onClick, text: text
    });
  }

  /* One status line per card, rewritten in place: stacking a new note per
     click would grow the card every time someone pressed Copy. */
  function statusLine() {
    var node = U.note("");
    node.hidden = true;
    node.say = function (text, tone) {
      node.className = "pm-note" + (tone ? " is-" + tone : "");
      node.textContent = text;
      node.hidden = !text;
    };
    return node;
  }

  function copyText(text, status, what) {
    var fallback = "Could not copy — the clipboard is usually blocked on a " +
                   "file:// page. Select the text below and copy it, or use the " +
                   "download button.";
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      status.say(fallback, "warn");
      return;
    }
    try {
      navigator.clipboard.writeText(text).then(
        function () { status.say(what + " copied to the clipboard.", null); },
        function () { status.say(fallback, "warn"); }
      );
    } catch (e) {
      status.say(fallback, "warn");
    }
  }

  /* --- 1. Theme ---------------------------------------------------------- */

  function themeCard() {
    var card = U.card("Theme",
      "Stored mode: " + PM.theme.get() + " · rendering " + PM.theme.effective() + ".");

    var group = el("div", { class: "pm-chips", role: "group", "aria-label": "Theme mode" });
    PM.theme.MODES.forEach(function (mode) {
      var active = PM.theme.get() === mode;
      /* No stylesheet rule keys off aria-pressed, so the pressed state is
         carried in the label text as well — an invisible toggle state would
         be worse than a slightly redundant one. */
      var btn = el("button", {
        class: "pm-btn", type: "button", "aria-pressed": active ? "true" : "false",
        dataset: { mode: mode },
        title: mode === "auto" ? "Follow the operating system" : "Force " + mode,
        text: (active ? "✓ " : "") + label(mode),
        onclick: function () {
          PM.theme.set(mode);
          /* PM.app re-renders this panel on pm:themechange; refreshing the
             group here keeps the control honest if it ever runs standalone. */
          Array.prototype.forEach.call(group.children, function (node) {
            var on = node.dataset.mode === PM.theme.get();
            node.setAttribute("aria-pressed", on ? "true" : "false");
            node.textContent = (on ? "✓ " : "") + label(node.dataset.mode);
          });
        }
      });
      group.appendChild(btn);
    });

    card.body.appendChild(group);
    card.body.appendChild(U.note(
      "\"Auto\" follows the operating system's light/dark setting and switches " +
      "live when it changes — no reload. \"Light\" and \"Dark\" pin the palette " +
      "regardless of the OS. The choice is remembered in this browser."
    ));
    return card;
  }

  /* --- 2. Token editor --------------------------------------------------- */

  /* Which CSS property makes a non-colour token's value visible in its 28px
     swatch. Presentational only — the value itself is in the row's title. */
  var PREVIEW_PROP = {
    "--pm-radius": "border-radius",
    "--pm-radius-sm": "border-radius",
    "--pm-shadow": "box-shadow",
    "--pm-gap": "width",
    "--pm-pad": "width",
    "--pm-font": "font-family",
    "--pm-font-mono": "font-family",
    "--pm-fs-base": "font-size",
    "--pm-fs-sm": "font-size",
    "--pm-fs-lg": "font-size",
    "--pm-fs-xl": "font-size"
  };

  function paintSwatch(swatch, name, value, isColor) {
    swatch.setAttribute("title", name + ": " + (value || "unset"));
    swatch.style.cssText = "";
    if (isColor) {
      swatch.style.setProperty("background", value);
      U.clear(swatch);
      return;
    }
    var prop = PREVIEW_PROP[name];
    if (prop) swatch.style.setProperty(prop, value);
    U.clear(swatch);
    if (prop === "font-family" || prop === "font-size") {
      swatch.style.setProperty("line-height", "1");
      U.append(swatch, "Aa");
    }
  }

  function tokenEditorCard() {
    var previewNode = pre(PM.theme.exportCss());
    var status = statusLine();

    function refresh() {
      previewNode.textContent = PM.theme.exportCss();
    }

    var grid = el("div", { class: "pm-tokens" });
    var groups = {};

    PM.theme.tokens().forEach(function (token) {
      if (!groups[token.group]) {
        var box = el("div", { class: "pm-token-group" }, [
          /* 20-components.css defines no group-heading class, so the card-title
             type scale is reused rather than inventing a selector nothing
             styles. */
          el("h4", { class: "pm-card-title", text: token.group })
        ]);
        groups[token.group] = box;
        grid.appendChild(box);
      }

      var value = PM.theme.read(token.name);
      /* Colour-ness is decided from the live computed value, never from a
         second hardcoded list: such a list would have to be kept in step with
         00-tokens.css by hand, and would be wrong the first time a token
         changed type. It also means a user who types a colour into a length
         token still gets a text box until the page is rebuilt, which is the
         conservative failure. */
      var hex = parseColor(value);
      var isColor = hex != null;

      var swatch = el("span", { class: "pm-token-swatch", "aria-hidden": "true" });
      paintSwatch(swatch, token.name, value, isColor);

      var control;
      if (isColor) {
        control = el("input", {
          type: "color", class: "pm-color", value: hex,
          "aria-label": token.name, title: token.name,
          oninput: function () {
            PM.theme.override(token.name, control.value);
            paintSwatch(swatch, token.name, PM.theme.read(token.name), true);
            refresh();
          }
        });
      } else {
        control = el("input", {
          type: "text", class: "pm-select", value: value, size: 12,
          spellcheck: "false", "aria-label": token.name, title: token.name,
          oninput: function () {
            PM.theme.override(token.name, control.value);
            paintSwatch(swatch, token.name, PM.theme.read(token.name), false);
            refresh();
          }
        });
      }

      var reset = el("button", {
        class: "pm-btn", type: "button", text: "↺",
        "aria-label": "Reset " + token.name,
        title: "Reset " + token.name + " to the theme default",
        onclick: function () {
          PM.theme.clearOverride(token.name);
          var fresh = PM.theme.read(token.name);
          var freshHex = parseColor(fresh);
          control.value = isColor ? (freshHex || control.value) : fresh;
          paintSwatch(swatch, token.name, fresh, isColor);
          refresh();
        }
      });

      groups[token.group].appendChild(el("div", { class: "pm-token-row" }, [
        el("span", { class: "pm-token-name", text: token.name }),
        swatch, control, reset
      ]));
    });

    var card = U.card(
      "Token editor",
      "Every custom property in the closed token set (SCHEMA.md §6). Changes " +
      "apply immediately and are remembered in this browser only.",
      {
        span: "full",
        actions: [
          button("Reset all", "Remove every override and return to the theme defaults",
            function () {
              PM.theme.clearAll();
              status.say("All overrides cleared. Re-open this tab to reload the controls.", null);
              refresh();
            }),
          button("Copy CSS", "Copy " + EXPORT_NAME + " to the clipboard",
            function () { copyText(PM.theme.exportCss(), status, EXPORT_NAME); }),
          button("Download " + EXPORT_NAME, "Save the override file next to this dashboard",
            function () {
              U.download(EXPORT_NAME, PM.theme.exportCss(), "text/css");
              status.say("Saved " + EXPORT_NAME + " — put it beside this HTML file.", null);
            })
        ]
      }
    );

    card.body.appendChild(grid);
    card.body.appendChild(U.note(
      "A colour token gets a colour picker and everything else a text box, " +
      "decided by reading the token's current value rather than from a list of " +
      "names — so a token added to 00-tokens.css needs no second edit here " +
      "beyond its row in the group list."
    ));
    card.body.appendChild(el("h4", { class: "pm-card-title", text: EXPORT_NAME }));
    card.body.appendChild(previewNode);
    card.body.appendChild(status);
    return card;
  }

  /* --- 3. How to customise ---------------------------------------------- */

  function howToCard() {
    var card = U.card("How to customise",
      "Three routes, in increasing order of both effort and permanence.");

    [
      "1. The theme toggle in the header cycles auto → light → dark. It changes " +
      "nothing but which palette 00-tokens.css serves, and is remembered in this " +
      "browser under the key pm.theme.",

      "2. The token editor above writes each changed token as an inline custom " +
      "property on <body> and remembers the whole map under pm.tokens. That is " +
      "per-browser and per-machine: it does not travel with the file, and a " +
      "colleague opening the same HTML sees the defaults.",

      "3. A sibling " + EXPORT_NAME + " file, linked last by the page. It is " +
      "portable — it travels with the HTML — and it is the only route that " +
      "survives being emailed to someone. It is optional, and its absence is " +
      "not an error: the page renders exactly as generated when the file is " +
      "missing.",

      "Precedence, weakest first: 00-tokens.css, then " + EXPORT_NAME + " " +
      "(more specific and loaded last), then the token editor's inline values " +
      "(an inline declaration beats any selector). Because of that last step, " +
      "every declaration the export writes carries !important — which is the " +
      "only thing that outranks an inline value, and makes the file win over " +
      "both of the other two routes."
    ].forEach(function (text) {
      card.body.appendChild(el("p", { class: "pm-note", text: text }));
    });

    return card;
  }

  /* --- 4. Data provenance ------------------------------------------------ */

  function provenanceCard(data) {
    var prov = data.provenance || {};
    var sources = prov.date_sources || {};
    var card = U.card(
      "Data provenance",
      "No date in this corpus was recorded as a date. Each one was resolved " +
      "from the best available evidence, and this is the record of which.",
      { span: "full" }
    );

    /* --- date sources ------------------------------------------------- */
    var names = SOURCE_ORDER.filter(function (key) { return sources[key] != null; });
    Object.keys(sources).forEach(function (key) {
      if (names.indexOf(key) < 0) names.push(key);   // tolerate a source we do not know
    });

    var total = 0;
    names.forEach(function (key) { total += Number(sources[key]) || 0; });

    card.body.appendChild(el("h4", { class: "pm-card-title", text: "How each date was resolved" }));
    if (!names.length) {
      card.body.appendChild(U.empty(
        "The payload carries no provenance.date_sources map, so there is nothing " +
        "to attribute — treat every date in this dashboard as unverified."
      ));
    } else {
      card.body.appendChild(U.table([
        { key: "source", label: "Source", cls: "pm-mono" },
        { key: "count", label: "Dates", align: "right",
          fmt: function (v) { return U.fmt.n(v); } },
        { key: "share", label: "Share", align: "right",
          fmt: function (v) { return v == null ? "—" : U.fmt.pct(v); } },
        { key: "desc", label: "What that means", fmt: function (v, row) {
            return WEAK_SOURCES[row.source]
              ? U.frag([v, U.approxMark("Dates from " + row.source + " are approximate.")])
              : v;
          } }
      ], names.map(function (key) {
        var count = Number(sources[key]) || 0;
        return {
          source: key,
          count: count,
          share: total ? (count / total) * 100 : null,
          desc: SOURCE_DESC[key] || "Not a source this dashboard knows; treat it as unverified."
        };
      })));
      /* The unknown row is part of this total, so it is a count of attempted
         resolutions rather than of resolved dates — calling it the latter
         would overstate what the corpus actually yielded. */
      card.body.appendChild(U.note(
        "Shares are of the " +
        U.fmt.plural(total, "date the generator tried to resolve",
                     "dates the generator tried to resolve") +
        ", which includes the unknown row where nothing resolved. It is not " +
        "the task count either — one task can contribute a created and a " +
        "closed date."
      ));
    }

    /* --- git baseline and floored dates ------------------------------- */
    var baseline = prov.git_baseline || {};
    card.body.appendChild(el("h4", { class: "pm-card-title", text: "The git floor" }));
    if (baseline.available && (baseline.date || baseline.hash)) {
      card.body.appendChild(dl([
        ["Baseline date", U.fmt.dateLong(baseline.date)],
        ["Commit", el("code", { text: String(baseline.hash || "—") })],
        ["Subject", baseline.subject || null],
        ["Why it matters", baseline.note || null]
      ]));
    } else if (data.project && data.project.git_available === false) {
      card.body.appendChild(U.empty(
        "Git was not available when this payload was generated, so no commit " +
        "date backs any figure here — dates came from the briefs, the audit log " +
        "and the filesystem alone."
      ));
    } else {
      card.body.appendChild(U.empty(
        "No git baseline was recorded, so a git-derived date cannot be checked " +
        "against the point where history begins."
      ));
    }

    var floored = prov.floored_dates;
    card.body.appendChild(U.note(
      floored == null
        ? "The payload does not say how many dates are floored, so the count of " +
          "lower bounds in this corpus is unknown."
        : U.fmt.plural(floored, "date") + " in this corpus " +
          (floored === 1 ? "is" : "are") + " floored: the value is a lower " +
          "bound — the work happened on or before it — not an observation. " +
          "A chart cannot tell the difference, which is why every such point " +
          "is marked " + "≈" + " where it is listed.",
      floored ? "warn" : null
    ));

    /* Not a cross-check of floored_dates above, and must not be read as one:
       that figure counts every floored date in the corpus — tasks, ad-hoc
       items, ADRs, reviews, created and closed alike — while this one is
       narrower on purpose (closure dates only, sprint granularity counted as
       well as floored). The two are expected to differ. */
    var tasks = (data.tasks || []).filter(function (t) { return t && t.closed_at; });
    var approxClosures = tasks.filter(function (t) {
      return t.closed_at_floored === true || WEAK_SOURCES[t.closed_at_source];
    }).length;
    if (tasks.length) {
      card.body.appendChild(U.note(
        U.fmt.n(approxClosures) + " of " + U.fmt.n(tasks.length) +
        " closure dates are lower bounds or sprint-granularity, not " +
        "observations — counted here from tasks[] directly."
      ));
    }

    /* --- chips -------------------------------------------------------- */
    card.body.appendChild(el("h4", { class: "pm-card-title", text: "Approximate tasks" }));
    card.body.appendChild(chips(prov.approximate_tasks,
      "No task carries an approximate date — every date in the corpus resolved " +
      "to an observation."));

    card.body.appendChild(el("h4", {
      class: "pm-card-title", text: "Excluded from time series"
    }));
    card.body.appendChild(chips(prov.excluded_from_timeseries,
      "No task was excluded: every brief resolved to a date a time series can " +
      "plot."));

    /* --- notes -------------------------------------------------------- */
    card.body.appendChild(el("h4", { class: "pm-card-title", text: "Caveats" }));
    var notes = (prov.notes || []).filter(function (t) { return t != null && t !== ""; });
    if (!notes.length) {
      card.body.appendChild(U.empty(
        "The generator recorded no caveats for this run. That is not a promise " +
        "there are none — only that nothing it checks for tripped."
      ));
    } else {
      card.body.appendChild(el("ul", { class: "pm-note" }, notes.map(function (text) {
        return el("li", { text: String(text) });
      })));
    }

    /* --- sources read ------------------------------------------------- */
    card.body.appendChild(el("h4", { class: "pm-card-title", text: "What was read" }));
    var read = prov.sources_read || [];
    if (!read.length) {
      card.body.appendChild(U.empty(
        "The payload does not list the paths it was built from, so the corpus " +
        "behind these figures cannot be re-walked from this page alone."
      ));
    } else {
      card.body.appendChild(U.table([
        { key: "path", label: "Path", cls: "pm-mono" },
        { key: "kind", label: "Kind", fmt: function (v) { return U.fmt.deCamel(v); } },
        { key: "count", label: "Items", align: "right",
          fmt: function (v) { return U.fmt.n(v); } }
      ], read.map(function (row) {
        return { path: (row && row.path) || "—", kind: (row && row.kind) || null,
                 count: row ? row.count : null };
      })));
    }

    card.body.appendChild(U.note(
      "These counts describe the whole corpus. The sprint and lane filters in " +
      "the header apply to task lists, not to provenance."
    ));
    return card;
  }

  /* --- 5. Units ---------------------------------------------------------- */

  function unitsCard(data) {
    var units = data.units || {};
    var coverage = units.points_coverage;
    var card = U.card("Units",
      "What the headline numbers count, and what they cannot.");

    card.body.appendChild(dl([
      ["Primary unit", units.primary ? U.fmt.deCamel(units.primary) : null],
      /* Three states, matching the note below: a missing field must not be
         rendered as a positive claim that the corpus carries no estimates. */
      ["Estimates present", units.points_available == null
        ? U.badge("Not stated", "neutral")
        : units.points_available
          ? U.badge("Yes", "good")
          : U.badge("No", "warn")],
      ["Points coverage", coverage == null ? null : U.fmt.pct(coverage * 100)],
      ["Points total", units.points_total == null ? null : U.fmt.n(units.points_total)],
      ["Size proxy", units.size_proxy_note || null]
    ]));

    /* Three cases, not two: "the payload says there are no estimates" and "the
       payload does not say" support different sentences, and collapsing them
       would put a claim about the corpus behind a missing field. */
    card.body.appendChild(U.note(
      units.points_available == null
        ? "This payload does not state whether any estimates exist, so read " +
          "every burn, velocity and forecast figure as count-based — one task " +
          "counted as equal to any other — which is what the rest of this " +
          "dashboard assumes."
        : units.points_available
        ? "Points exist for part of the corpus only, so a points figure is never " +
          "presented as whole-corpus: coverage above says how much of it is real."
        : "The consequence: with no estimates anywhere in the corpus, every burn, " +
          "velocity and forecast figure in this dashboard treats one task as " +
          "equal in size to any other. That is exactly the assumption " +
          "count-based forecasting makes — it is stated rather than hidden, and " +
          "it is why the cycle-time spread matters more here than any average."
    ));
    return card;
  }

  /* --- 6. Payload -------------------------------------------------------- */

  function payloadCard(data) {
    var project = data.project || {};
    var generator = data.generator || {};
    var status = statusLine();

    var json;
    try {
      json = JSON.stringify(data, null, 2);
    } catch (e) {
      json = null;   // a cyclic or unstringifiable payload must not kill the tab
    }

    var card = U.card(
      "Payload",
      "Everything on every tab is rendered from this one JSON object, inlined " +
      "in the page. Nothing is fetched and nothing is hand-entered.",
      {
        span: "full",
        actions: [
          button("Download dashboard-data.json", "Save the payload as a file",
            function () {
              if (json == null) { status.say("The payload could not be serialised.", "bad"); return; }
              U.download("dashboard-data.json", json, "application/json");
              status.say("Saved dashboard-data.json.", null);
            }),
          button("Copy", "Copy the payload to the clipboard",
            function () {
              if (json == null) { status.say("The payload could not be serialised.", "bad"); return; }
              copyText(json, status, "The payload");
            })
        ]
      }
    );

    card.body.appendChild(dl([
      ["Generated at", project.today
        ? (data.generated_at || "—") + " (as of " + U.fmt.dateLong(project.today) + ")"
        : (data.generated_at || null)],
      ["Schema version", data.schema_version == null ? null : String(data.schema_version)],
      ["Generator", (generator.name || "—") +
        (generator.version ? " " + generator.version : "")],
      ["Project", project.name || null],
      ["Corpus read", project.workflow_dir ? el("code", { text: project.workflow_dir }) : null],
      ["Audit log", project.log_path ? el("code", { text: project.log_path }) : null],
      ["Git available", project.git_available === true
        ? U.badge("Yes", "good")
        : project.git_available === false
          ? U.badge("No", "warn")
          : U.badge("Not stated", "neutral")]
    ]));

    if (data.schema_version != null && Number(data.schema_version) !== 1) {
      card.body.appendChild(U.note(
        "This payload declares schema_version " + data.schema_version +
        " and this front end implements 1. Field names may have moved, so " +
        "anything above or on another tab may be mislabelled rather than wrong.",
        "bad"
      ));
    }

    var arrays = [
      ["tasks", "Task briefs"], ["sprints", "Sprints"], ["adhoc", "Ad-hoc items"],
      ["decisions", "Decisions (ADRs)"], ["reviews", "Reviews"],
      ["log", "Audit-log entries"], ["commits", "Commits"],
      ["defects", "Corpus defects"]
    ];
    card.body.appendChild(U.table([
      { key: "label", label: "Top-level array" },
      { key: "key", label: "Field", cls: "pm-mono" },
      { key: "count", label: "Entries", align: "right",
        fmt: function (v) { return U.fmt.n(v); } }
    ], arrays.map(function (pair) {
      return {
        label: pair[1], key: pair[0],
        count: Array.isArray(data[pair[0]]) ? data[pair[0]].length : 0
      };
    })));

    if (json == null) {
      card.body.appendChild(U.empty(
        "The payload could not be serialised for preview, so its shape cannot " +
        "be shown here — the tabs above are still rendering from the live object."
      ));
    } else {
      var shown = json.slice(0, PAYLOAD_PREVIEW);
      card.body.appendChild(pre(shown));
      card.body.appendChild(U.note(
        json.length > PAYLOAD_PREVIEW
          ? "Showing the first " + U.fmt.n(shown.length) + " of " +
            U.fmt.n(json.length) + " characters — " +
            U.fmt.n(json.length - shown.length) + " elided. Download or copy " +
            "for the whole object."
          : "The whole payload is shown: " + U.fmt.n(json.length) + " characters."
      ));
    }

    card.body.appendChild(status);
    return card;
  }

  /* --- the view ---------------------------------------------------------- */

  PM.views.data = function (root, data) {
    var d = data || {};
    /* PM.app hands over an emptied panel, but this view is re-called on theme
       change and on resize and must not depend on that. */
    U.clear(root);

    var appearance = U.section("Appearance",
      "The palette, the token set behind it, and how to make a change that " +
      "outlives this browser profile.");
    appearance.body.appendChild(themeCard());
    appearance.body.appendChild(tokenEditorCard());
    appearance.body.appendChild(howToCard());
    root.appendChild(appearance);

    var provenance = U.section("Data provenance",
      "Where every number came from, what it is a lower bound for, and what " +
      "this corpus does not contain.");
    provenance.body.appendChild(provenanceCard(d));
    provenance.body.appendChild(closureSourceCard(d));
    provenance.body.appendChild(unitsCard(d));
    provenance.body.appendChild(payloadCard(d));
    root.appendChild(provenance);
  };

  /* ----------------------------------------------------------------------
     How each closure date was obtained.

     The tool this replaces reported three values — commit date, Updated field,
     or nothing. This reports the full source vocabulary, so "a status line
     said so" and "a commit said so" stay distinguishable instead of collapsing
     into "recorded". Both are hand-recorded; only one is a fact about history.
     ---------------------------------------------------------------------- */

  var SOURCE_QUALITY = {
    status_line: "ok", header_date: "ok", created_field: "ok",
    commit_hash: "ok", log_md: "ok", filename: "ok",
    body_found_during: "ok",
    git_added: "a1", git_last: "a1",
    updated_field: "warn", roadmap_sprint: "warn",
    file_mtime: "warn", unknown: "bad"
  };

  var SOURCE_MEANS = {
    status_line: "an explicit date in the brief's own status line",
    header_date: "an explicit Date header field",
    created_field: "the brief's own Created field",
    updated_field: "the brief's Updated field — editable, and edited for other reasons",
    commit_hash: "the date of a commit the brief itself names",
    log_md: "a dated audit-log entry naming the task",
    filename: "a date in the filename",
    body_found_during: "a date in the item's own Found during line",
    git_added: "the commit that added the file",
    git_last: "the most recent commit touching the file",
    roadmap_sprint: "the sprint's window, not a day",
    file_mtime: "the filesystem's mtime — the weakest source there is",
    unknown: "nothing resolved it"
  };

  function closureSourceCard(d) {
    var rows = ((d.metrics || {}).closure_sources) || [];
    var card = U.card(
      "How completion dates were obtained",
      "Every closed task, by the evidence that dated it"
    );

    if (!rows.length) {
      card.body.appendChild(U.empty(
        "No task is closed yet, so no closure date has been resolved."
      ));
      return card;
    }

    var total = 0;
    rows.forEach(function (r) { total += r.count; });
    var max = rows[0].count;

    var c = PM.svg.chart(card.body, {
      height: 240, xType: "band",
      x: { domain: rows.map(function (r) { return r.source; }), padding: 0.25 },
      y: { domain: [0, max] },
      label: "Closure dates by the source that produced them"
    });
    c.yAxis({ ticks: 4, title: "tasks" });
    c.xAxis({ anchor: "end" });
    c.bars(rows, {
      x: function (r) { return r.source; },
      y: function (r) { return r.count; },
      cls: function (key, ki, p) {
        return "pm-" + (SOURCE_QUALITY[p.source] || "muted");
      },
      label: function (r) {
        return [r.source, SOURCE_MEANS[r.source] || "",
                U.fmt.plural(r.count, "task") + ", " +
                U.fmt.pct((r.count / total) * 100)];
      }
    });
    c.done();

    card.body.appendChild(U.table([
      { key: "source", label: "Source" },
      {
        key: "source", label: "What it means",
        fmt: function (v) { return SOURCE_MEANS[v] || "—"; }
      },
      {
        key: "count", label: "Tasks", align: "right",
        fmt: function (v) { return U.fmt.n(v); }
      },
      {
        key: "count", label: "Share", align: "right",
        fmt: function (v) { return U.fmt.pct((v / total) * 100); }
      }
    ], rows, { cls: "is-compact" }));

    card.body.appendChild(U.note(
      "Read this before quoting any duration. A cycle time built on a status " +
      "line is an observation; one built on a sprint window or an mtime is an " +
      "estimate wearing the same units, and the charts mark those with ≈ for " +
      "that reason."
    ));
    return card;
  }
})();
