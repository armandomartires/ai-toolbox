/* ==========================================================================
   00-util.js — PM.util: formatting, date maths, small statistics, and the DOM
   builders every view uses. Depends on nothing.

   Two rules this file exists to enforce:
     - No view formats a date, a percentage or a count by hand. One formatter
       means one place to fix a locale bug.
     - No view writes innerHTML from data. `el()` builds nodes and sets text,
       so a task title containing `<` or `&` cannot become markup.
   ========================================================================== */

window.PM = window.PM || {};

(function () {
  "use strict";

  /* ----------------------------------------------------------------------
     Dates. Every date in the payload is a bare `YYYY-MM-DD` string, and it
     is parsed as UTC noon deliberately: `new Date("2026-09-28")` is UTC
     midnight, which in any negative-offset timezone renders as the 27th.
     Noon keeps every date stable in every timezone on earth.
     ---------------------------------------------------------------------- */
  var DAY_MS = 86400000;

  function parse(value) {
    if (value == null || value === "") return null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
    if (!m) {
      var loose = new Date(value);
      return isNaN(loose.getTime()) ? null : loose;
    }
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12, 0, 0));
  }

  function iso(date) {
    var d = parse(date);
    if (!d) return null;
    return (
      d.getUTCFullYear() +
      "-" + String(d.getUTCMonth() + 1).padStart(2, "0") +
      "-" + String(d.getUTCDate()).padStart(2, "0")
    );
  }

  function addDays(date, n) {
    var d = parse(date);
    if (!d) return null;
    return new Date(d.getTime() + n * DAY_MS);
  }

  function diffDays(a, b) {
    var da = parse(a), db = parse(b);
    if (!da || !db) return null;
    return Math.round((db.getTime() - da.getTime()) / DAY_MS);
  }

  /* ISO week starts Monday. */
  function startOfWeek(date) {
    var d = parse(date);
    if (!d) return null;
    var dow = d.getUTCDay();            // 0 = Sunday
    var back = dow === 0 ? 6 : dow - 1;
    return new Date(d.getTime() - back * DAY_MS);
  }

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function monthLabel(value) {
    /* Accepts "2026-09" or a full date. */
    var m = /^(\d{4})-(\d{2})/.exec(String(value || ""));
    if (!m) return String(value || "");
    return MONTHS[+m[2] - 1] + " " + m[1];
  }

  function range(from, to, stepDays) {
    var a = parse(from), b = parse(to), out = [];
    if (!a || !b) return out;
    var step = stepDays || 1;
    for (var t = a.getTime(); t <= b.getTime(); t += step * DAY_MS) {
      out.push(new Date(t));
    }
    return out;
  }

  /* ----------------------------------------------------------------------
     Formatting
     ---------------------------------------------------------------------- */
  function n(value, decimals) {
    if (value == null || (typeof value === "number" && !isFinite(value))) return "—";
    var dp = decimals == null ? 0 : decimals;
    return Number(value).toFixed(dp).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }

  function pct(value, decimals) {
    if (value == null || !isFinite(value)) return "—";
    return n(value, decimals == null ? 1 : decimals) + "%";
  }

  function compact(value) {
    if (value == null || !isFinite(value)) return "—";
    var v = Math.abs(value);
    if (v >= 1e9) return (value / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
    if (v >= 1e6) return (value / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
    if (v >= 1e4) return Math.round(value / 1e3) + "k";
    if (v >= 1e3) return (value / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
    return n(value);
  }

  function dateShort(value) {
    var d = parse(value);
    if (!d) return "—";
    return MONTHS[d.getUTCMonth()] + " " + d.getUTCDate();
  }

  function dateLong(value) {
    var d = parse(value);
    if (!d) return "not known";
    return MONTHS[d.getUTCMonth()] + " " + d.getUTCDate() + ", " + d.getUTCFullYear();
  }

  function days(value) {
    if (value == null || !isFinite(value)) return "—";
    var v = Math.round(value);
    return v + (Math.abs(v) === 1 ? " day" : " days");
  }

  function bytes(value) {
    if (value == null || !isFinite(value)) return "—";
    if (value < 1024) return value + " B";
    if (value < 1024 * 1024) return (value / 1024).toFixed(1) + " KB";
    return (value / 1048576).toFixed(1) + " MB";
  }

  function plural(count, singular, pluralForm) {
    var word = Math.abs(count) === 1 ? singular : (pluralForm || singular + "s");
    return n(count) + " " + word;
  }

  /* `CoverThreeModes` -> `Cover Three Modes`; `Vram12GB` -> `Vram 12GB`. */
  function deCamel(text) {
    return String(text || "")
      .replace(/[_-]+/g, " ")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/([A-Za-z])(\d)/g, "$1 $2")
      .replace(/\s+/g, " ")
      .trim();
  }

  function truncate(text, max) {
    var s = String(text == null ? "" : text);
    if (s.length <= max) return s;
    return s.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
  }

  /* ----------------------------------------------------------------------
     Statistics. Percentile uses the nearest-rank method, which is what
     Kanban practice means by "85% of items finished within N days" — an
     interpolated value would name a duration no item actually took.
     ---------------------------------------------------------------------- */
  function sum(values) {
    var t = 0;
    for (var i = 0; i < values.length; i++) t += values[i] || 0;
    return t;
  }

  function mean(values) {
    return values.length ? sum(values) / values.length : null;
  }

  function stddev(values) {
    if (values.length < 2) return null;
    var m = mean(values), acc = 0;
    for (var i = 0; i < values.length; i++) acc += Math.pow(values[i] - m, 2);
    return Math.sqrt(acc / (values.length - 1));
  }

  function maxOf(values) {
    var best = null;
    for (var i = 0; i < values.length; i++) {
      if (values[i] != null && (best == null || values[i] > best)) best = values[i];
    }
    return best;
  }

  function percentile(values, p) {
    var sorted = values.filter(function (v) { return v != null && isFinite(v); })
                       .slice().sort(function (a, b) { return a - b; });
    if (!sorted.length) return null;
    var rank = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.min(sorted.length - 1, Math.max(0, rank))];
  }

  /* ----------------------------------------------------------------------
     DOM. `el` is the only node factory; nothing in this dashboard assigns
     innerHTML from payload data.
     ---------------------------------------------------------------------- */
  var SVG_NS = "http://www.w3.org/2000/svg";
  var SVG_TAGS = {
    svg: 1, g: 1, path: 1, rect: 1, circle: 1, line: 1, text: 1, polyline: 1,
    polygon: 1, defs: 1, clipPath: 1, title: 1, tspan: 1, use: 1, marker: 1,
    linearGradient: 1, stop: 1, ellipse: 1
  };

  function el(tag, attrs, children) {
    var node = SVG_TAGS[tag]
      ? document.createElementNS(SVG_NS, tag)
      : document.createElement(tag);

    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        var value = attrs[key];
        if (value == null || value === false) return;
        if (key === "text") { node.textContent = String(value); return; }
        if (key === "html") { throw new Error("PM.util.el: html is not allowed"); }
        if (key === "style" && typeof value === "object") {
          Object.keys(value).forEach(function (p) { node.style.setProperty(p, value[p]); });
          return;
        }
        if (key === "dataset") {
          Object.keys(value).forEach(function (p) { node.dataset[p] = value[p]; });
          return;
        }
        if (key.slice(0, 2) === "on" && typeof value === "function") {
          node.addEventListener(key.slice(2).toLowerCase(), value);
          return;
        }
        if (value === true) { node.setAttribute(key, ""); return; }
        node.setAttribute(key, String(value));
      });
    }

    append(node, children);
    return node;
  }

  function append(parent, children) {
    if (children == null || children === false) return parent;
    if (Array.isArray(children)) {
      children.forEach(function (c) { append(parent, c); });
      return parent;
    }
    if (children instanceof Node) { parent.appendChild(children); return parent; }
    parent.appendChild(document.createTextNode(String(children)));
    return parent;
  }

  function frag(children) {
    return append(document.createDocumentFragment(), children);
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  /* ----------------------------------------------------------------------
     Shared components. Every view builds its panels out of these so the
     eleven tabs look like one product rather than eleven.
     ---------------------------------------------------------------------- */

  /* A titled card. Returns the card element with `.body` pointing at the
     content area, so a caller does `var c = card("Burn-up"); c.body.appendChild(svg)`. */
  function card(title, subtitle, opts) {
    var options = opts || {};
    var body = el("div", { class: "pm-card-body" });
    var head = null;
    if (title || subtitle || options.actions) {
      head = el("div", { class: "pm-card-head" }, [
        el("div", { class: "pm-card-titles" }, [
          title ? el("h3", { class: "pm-card-title", text: title }) : null,
          subtitle ? el("p", { class: "pm-card-sub", text: subtitle }) : null
        ]),
        options.actions ? el("div", { class: "pm-card-actions" }, options.actions) : null
      ]);
    }
    var node = el("section", {
      class: "pm-card" + (options.span ? " pm-span-" + options.span : "") +
             (options.cls ? " " + options.cls : "")
    }, [head, body]);
    node.body = body;
    return node;
  }

  /* One KPI tile. `spec` matches metrics.kpis[] from SCHEMA.md §2. */
  function kpi(spec) {
    var tone = spec.tone || "neutral";
    var value = spec.unit === "%" ? pct(spec.value) : n(spec.value, spec.decimals);
    if (spec.display != null) value = spec.display;
    else if (spec.unit && spec.unit !== "%") value = n(spec.value, spec.decimals) + " " + spec.unit;

    var trend = null;
    if (spec.trend != null && isFinite(spec.trend) && spec.trend !== 0) {
      var up = spec.trend > 0;
      trend = el("span", {
        class: "pm-kpi-trend " + (up ? "is-up" : "is-down"),
        title: "Change over the trailing 14 days"
      }, (up ? "▲ " : "▼ ") + n(Math.abs(spec.trend), 1) + (spec.unit === "%" ? " pp" : ""));
    }

    return el("div", { class: "pm-kpi is-" + tone, title: spec.hint || "" }, [
      el("div", { class: "pm-kpi-label", text: spec.label }),
      el("div", { class: "pm-kpi-value" }, [value, trend]),
      spec.sub ? el("div", { class: "pm-kpi-sub", text: spec.sub }) : null
    ]);
  }

  /* A data table. `cols` is [{key, label, align, fmt, cls, width}]; `rows` is
     an array of objects. `fmt` receives (value, row) and may return a Node. */
  function table(cols, rows, opts) {
    var options = opts || {};
    var head = el("thead", null, el("tr", null, cols.map(function (c) {
      return el("th", {
        class: (c.align ? "is-" + c.align : ""),
        style: c.width ? { width: c.width } : null,
        text: c.label
      });
    })));

    var body = el("tbody", null, rows.map(function (row) {
      return el("tr", { class: options.rowClass ? options.rowClass(row) : null },
        cols.map(function (c) {
          var raw = typeof c.key === "function" ? c.key(row) : row[c.key];
          var content = c.fmt ? c.fmt(raw, row) : (raw == null ? "—" : String(raw));
          return el("td", {
            class: (c.align ? "is-" + c.align : "") + (c.cls ? " " + c.cls : "")
          }, content);
        }));
    }));

    var node = el("table", { class: "pm-table" + (options.cls ? " " + options.cls : "") },
                  [head, body]);
    return options.scroll === false ? node : el("div", { class: "pm-table-wrap" }, node);
  }

  function badge(text, tone) {
    return el("span", { class: "pm-badge is-" + (tone || "neutral"), text: text });
  }

  function empty(message) {
    return el("div", { class: "pm-empty" }, [
      el("div", { class: "pm-empty-mark", text: "—" }),
      el("p", { text: message })
    ]);
  }

  function note(text, tone) {
    return el("p", { class: "pm-note" + (tone ? " is-" + tone : ""), text: text });
  }

  function section(title, sub) {
    var body = el("div", { class: "pm-grid" });
    var node = el("div", { class: "pm-section" }, [
      el("div", { class: "pm-section-head" }, [
        el("h2", { class: "pm-section-title", text: title }),
        sub ? el("p", { class: "pm-section-sub", text: sub }) : null
      ]),
      body
    ]);
    node.body = body;
    return node;
  }

  /* Map a value onto a tone given ascending thresholds, e.g.
     toneFor(89, {bad: 40, warn: 70, good: 0}) -> "good". */
  function toneFor(value, thresholds) {
    if (value == null || !isFinite(value)) return "neutral";
    var t = thresholds || {};
    if (t.invert) {
      if (t.bad != null && value >= t.bad) return "bad";
      if (t.warn != null && value >= t.warn) return "warn";
      return "good";
    }
    if (t.bad != null && value <= t.bad) return "bad";
    if (t.warn != null && value <= t.warn) return "warn";
    return "good";
  }

  var STATE_TONES = {
    done: "good", in_progress: "info", blocked: "bad",
    not_started: "neutral", unparseable: "warn",
    open: "warn", resolved: "good",
    active: "info", planned: "neutral", closed: "good"
  };

  function stateTone(state) {
    return STATE_TONES[state] || "neutral";
  }

  var STATE_LABELS = {
    done: "Done", in_progress: "In progress", blocked: "Blocked",
    not_started: "Not started", unparseable: "Unreadable status"
  };

  function stateLabel(state) {
    return STATE_LABELS[state] || deCamel(state || "unknown");
  }

  /* Trigger a client-side download. Used by the CSS export and the raw-JSON
     button; works from file:// in every current browser. */
  function download(filename, text, mime) {
    var blob = new Blob([text], { type: (mime || "text/plain") + ";charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = el("a", { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* An "approximate" marker every chart uses for floored/sprint-granularity
     dates, so a reader can tell an observation from a lower bound. */
  function approxMark(reason) {
    return el("abbr", {
      class: "pm-approx",
      title: reason || "This date is derived, not recorded. See the Data tab.",
      text: "≈"
    });
  }

  PM.util = {
    DAY_MS: DAY_MS,
    fmt: {
      n: n, pct: pct, compact: compact, date: dateShort, dateLong: dateLong,
      days: days, bytes: bytes, plural: plural, deCamel: deCamel, truncate: truncate
    },
    d: {
      parse: parse, iso: iso, addDays: addDays, diffDays: diffDays,
      startOfWeek: startOfWeek, monthLabel: monthLabel, range: range, MONTHS: MONTHS
    },
    st: {
      sum: sum, mean: mean, stddev: stddev, max: maxOf, percentile: percentile
    },
    el: el, frag: frag, append: append, clear: clear,
    card: card, kpi: kpi, table: table, badge: badge, empty: empty,
    note: note, section: section,
    toneFor: toneFor, stateTone: stateTone, stateLabel: stateLabel,
    download: download, approxMark: approxMark
  };
})();
