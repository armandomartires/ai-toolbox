/* ===========================================================================
   dashboard.js — renders the model the generator embedded. Nothing here
   parses markdown, computes a metric or decides what a number means: the
   series arrive finished from scripts/dashboard_lib.py, which is their one
   owner. This file is a view, and keeping it one is what stops the chart and
   the --json export from ever disagreeing.

   COLOUR IS NEVER LITERAL IN THIS FILE. Every hue is read from a CSS custom
   property at draw time, so a stylesheet override recolours the charts with
   no JavaScript change. There is not one hex value below — a missing token
   falls back to currentColor, which is still the stylesheet's decision and
   not this file's. That is checkable, and it is what makes
   assets/custom.css.example a complete surface rather than a partial one.

   Labels come from markdown headings and table cells — untrusted text. They
   are inserted with textContent / createTextNode, never innerHTML.
   =========================================================================== */
(function () {
  "use strict";

  var M = JSON.parse(document.getElementById("model").textContent);
  var S = M.series;
  var SVGNS = "http://www.w3.org/2000/svg";

  /* ------------------------------------------------------------- tokens */
  var tokenCache = {};
  function tok(name) {
    if (!(name in tokenCache)) {
      tokenCache[name] = getComputedStyle(document.documentElement)
        .getPropertyValue(name).trim() || "currentColor";
    }
    return tokenCache[name];
  }
  function dropTokens() { tokenCache = {}; }

  var BAND_COLOR = {
    todo: "--band-todo", doing: "--band-doing",
    blocked: "--band-blocked", done: "--band-done"
  };
  function bandColor(b) { return tok(BAND_COLOR[b] || "--text-muted"); }

  /* -------------------------------------------------------------- dom */
  function h(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }
  function e(tag, attrs, parent) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) {
      if (attrs[k] !== undefined && attrs[k] !== null) {
        n.setAttribute(k, attrs[k]);
      }
    }
    if (parent) parent.appendChild(n);
    return n;
  }
  function txt(node, s) { node.appendChild(document.createTextNode(String(s))); }

  /* ------------------------------------------------------------ format */
  function num(v, dp) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    var n = dp === undefined ? Math.round(v * 10) / 10 : Number(v).toFixed(dp);
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  function pct(v) { return v === null || v === undefined ? "—" : num(v, 1) + "%"; }
  function d2n(s) {                       /* "2026-09-14" -> ms, UTC-stable */
    if (!s) return NaN;
    var p = String(s).split("-");
    return Date.UTC(+p[0], +p[1] - 1, +p[2]);
  }
  function n2d(ms) { return new Date(ms).toISOString().slice(0, 10); }
  function shortDate(s) {
    var p = String(s).split("-");
    return p[2] + " " + ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul",
      "Aug", "Sep", "Oct", "Nov", "Dec"][+p[1] - 1];
  }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }

  /* ------------------------------------------------------------ scales */
  function linear(d0, d1, r0, r1) {
    var span = (d1 - d0) || 1;
    var f = function (v) { return r0 + (v - d0) * (r1 - r0) / span; };
    f.invert = function (p) { return d0 + (p - r0) * span / (r1 - r0); };
    f.domain = [d0, d1]; f.range = [r0, r1];
    return f;
  }
  function niceTicks(lo, hi, count) {
    if (hi <= lo) hi = lo + 1;
    var raw = (hi - lo) / Math.max(count, 2);
    var mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
    var norm = raw / mag;
    var step = (norm >= 7.5 ? 10 : norm >= 3.5 ? 5 : norm >= 1.5 ? 2 : 1) * mag;
    var out = [], v = Math.ceil(lo / step) * step;
    for (; v <= hi + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
    return out;
  }
  function dateTicks(lo, hi, count) {
    var days = (hi - lo) / 864e5;
    var everyN = Math.max(1, Math.ceil(days / Math.max(count, 2)));
    var out = [];
    for (var t = lo; t <= hi; t += everyN * 864e5) out.push(t);
    if (out[out.length - 1] !== hi) out.push(hi);
    return out;
  }

  /* ----------------------------------------------------------- tooltip */
  var tipEl = document.getElementById("tip");
  function tipShow(ev, title, rows) {
    while (tipEl.firstChild) tipEl.removeChild(tipEl.firstChild);
    var head = h("div", "t-head"); txt(head, title); tipEl.appendChild(head);
    rows.forEach(function (r) {
      var row = h("div", "t-row");
      if (r.color) {
        var k = h("span", "k"); k.style.background = r.color; row.appendChild(k);
      }
      /* Values lead, labels follow: the reader already has the series. */
      var v = h("span", "v"); txt(v, r.value); row.appendChild(v);
      var n = h("span", "n"); txt(n, r.label); row.appendChild(n);
      tipEl.appendChild(row);
    });
    tipEl.setAttribute("data-open", "1");
    tipMove(ev);
  }
  function tipMove(ev) {
    var pad = 14, w = tipEl.offsetWidth, ht = tipEl.offsetHeight;
    var x = ev.clientX + pad, y = ev.clientY + pad;
    if (x + w > window.innerWidth - 8) x = ev.clientX - w - pad;
    if (y + ht > window.innerHeight - 8) y = ev.clientY - ht - pad;
    tipEl.style.left = Math.max(4, x) + "px";
    tipEl.style.top = Math.max(4, y) + "px";
  }
  function tipHide() { tipEl.setAttribute("data-open", "0"); }
  document.addEventListener("scroll", tipHide, true);

  /* -------------------------------------------------------------- plot */
  /* A plot owns its margins, scales and axes. Every chart below builds one,
     so axis style, tick rounding and the x-axis band are decided once —
     including the band's height, which is the fix for the "fixed height
     excludes the axis labels" failure. */
  function Plot(host, opt) {
    opt = opt || {};
    var width = Math.max(host.clientWidth || 640, 260);
    var height = opt.height || 260;
    var m = opt.margin || {};
    var mar = {
      top: m.top === undefined ? 14 : m.top,
      right: m.right === undefined ? 18 : m.right,
      bottom: m.bottom === undefined ? 30 : m.bottom,
      left: m.left === undefined ? 44 : m.left
    };
    var svg = e("svg", {
      "class": "plot", width: width, height: height,
      viewBox: "0 0 " + width + " " + height, role: "img"
    });
    host.appendChild(svg);
    var g = e("g", {}, svg);
    return {
      svg: svg, g: g, w: width, h: height, m: mar,
      iw: width - mar.left - mar.right,
      ih: height - mar.top - mar.bottom,
      x0: mar.left, y0: mar.top,
      x1: width - mar.right, y1: height - mar.bottom
    };
  }

  function axisY(p, scale, opt) {
    opt = opt || {};
    var ticks = opt.ticks || niceTicks(scale.domain[0], scale.domain[1], 5);
    ticks.forEach(function (t) {
      var y = Math.round(scale(t)) + .5;
      if (y < p.y0 - 1 || y > p.y1 + 1) return;
      e("line", { "class": "tick-line", x1: p.x0, x2: p.x1, y1: y, y2: y }, p.g);
      var lb = e("text", { x: p.x0 - 8, y: y + 3.5, "text-anchor": "end" }, p.g);
      txt(lb, opt.fmt ? opt.fmt(t) : num(t));
    });
    e("line", { "class": "axis-line", x1: p.x0 + .5, x2: p.x0 + .5,
                y1: p.y0, y2: p.y1 }, p.g);
  }

  function axisXDate(p, scale, opt) {
    opt = opt || {};
    var ticks = dateTicks(scale.domain[0], scale.domain[1],
                          Math.max(3, Math.floor(p.iw / 90)));
    ticks.forEach(function (t) {
      var x = Math.round(scale(t)) + .5;
      var lb = e("text", { x: x, y: p.y1 + 16, "text-anchor": "middle" }, p.g);
      txt(lb, shortDate(n2d(t)));
    });
    e("line", { "class": "axis-line", x1: p.x0, x2: p.x1,
                y1: p.y1 + .5, y2: p.y1 + .5 }, p.g);
  }

  function axisXBand(p, labels, step, opt) {
    opt = opt || {};
    var every = Math.max(1, Math.ceil(labels.length / Math.max(
      1, Math.floor(p.iw / (opt.minWidth || 52)))));
    labels.forEach(function (lab, i) {
      if (i % every) return;
      var x = p.x0 + step * (i + .5);
      var lb = e("text", { x: x, y: p.y1 + 16, "text-anchor": "middle" }, p.g);
      txt(lb, lab);
    });
    e("line", { "class": "axis-line", x1: p.x0, x2: p.x1,
                y1: p.y1 + .5, y2: p.y1 + .5 }, p.g);
  }

  function pathOf(points) {
    return points.map(function (pt, i) {
      return (i ? "L" : "M") + pt[0].toFixed(1) + " " + pt[1].toFixed(1);
    }).join(" ");
  }

  /* --------------------------------------------------- legend & tables */
  function legend(host, items) {
    /* Always present for two or more series — identity is never colour
       alone. One series gets none: the card title already names it. */
    if (items.length < 2) return;
    var box = h("div", "legend");
    items.forEach(function (it) {
      var item = h("div", "item");
      var sw = h("span", it.line ? "key-line" : "swatch");
      sw.style.background = it.color;
      item.appendChild(sw);
      var t = h("span"); txt(t, it.label); item.appendChild(t);
      box.appendChild(item);
    });
    host.appendChild(box);
  }

  function table(cols, rows, opt) {
    opt = opt || {};
    var wrap = h("div", "tablewrap");
    var t = h("table"), thead = h("thead"), tr = h("tr");
    cols.forEach(function (c, i) {
      var th = h("th", (c.num ? "num " : "") + (opt.sortable ? "sortable" : ""));
      txt(th, c.label);
      if (opt.sortable) {
        th.tabIndex = 0;
        var go = function () { sortBy(i, c.num); };
        th.addEventListener("click", go);
        th.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); go(); }
        });
      }
      tr.appendChild(th);
    });
    thead.appendChild(tr); t.appendChild(thead);
    var tbody = h("tbody"); t.appendChild(tbody);
    var dir = 1, sorted = rows.slice();

    function paint() {
      while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
      if (!sorted.length) {
        var er = h("tr"), ec = h("td", "empty", "Nothing matches the current filters.");
        ec.colSpan = cols.length; er.appendChild(ec); tbody.appendChild(er);
        return;
      }
      sorted.forEach(function (r) {
        var row = h("tr");
        cols.forEach(function (c, i) {
          var td = h("td", (c.num ? "num " : "") + (c.cls || ""));
          var v = r[i];
          if (v && v.nodeType) td.appendChild(v);
          else txt(td, v === null || v === undefined ? "—" : v);
          row.appendChild(td);
        });
        tbody.appendChild(row);
      });
    }
    function sortBy(i, isNum) {
      dir = -dir;
      sorted.sort(function (a, b) {
        var x = a[i], y = b[i];
        if (x && x.nodeType) x = x.textContent;
        if (y && y.nodeType) y = y.textContent;
        if (isNum) {
          x = parseFloat(String(x).replace(/[^\d.\-]/g, "")) || 0;
          y = parseFloat(String(y).replace(/[^\d.\-]/g, "")) || 0;
          return (x - y) * dir;
        }
        return String(x).localeCompare(String(y)) * dir;
      });
      Array.prototype.forEach.call(thead.querySelectorAll("th"), function (th) {
        th.removeAttribute("aria-sort");
      });
      thead.querySelectorAll("th")[i]
        .setAttribute("aria-sort", dir > 0 ? "ascending" : "descending");
      paint();
    }
    paint();
    wrap.appendChild(t);
    return wrap;
  }

  function chip(band, label) {
    var c = h("span", "chip " + band);
    c.appendChild(h("span", "dot"));
    var s = h("span"); txt(s, label); c.appendChild(s);
    return c;
  }

  /* -------------------------------------------------------------- card */
  var allTables = [];
  function card(grid, opt) {
    var c = h("div", "card" + (opt.span ? " " + opt.span : ""));
    var head = h("div");
    head.className = "";
    var hd = document.createElement("header");
    var t = h("h3"); txt(t, opt.title); hd.appendChild(t);
    var btn = h("button", "btn toggle", "Table");
    btn.type = "button";
    btn.setAttribute("aria-pressed", "false");
    hd.appendChild(btn);
    c.appendChild(hd);
    if (opt.note) {
      var nt = h("p", "note" + (opt.caveat ? " caveat" : ""));
      txt(nt, opt.note); c.appendChild(nt);
    }
    var body = h("div", "body");
    c.appendChild(body);
    var tableHost = h("div");
    tableHost.hidden = true;
    c.appendChild(tableHost);
    btn.addEventListener("click", function () {
      var open = tableHost.hidden;
      tableHost.hidden = !open;
      btn.setAttribute("aria-pressed", open ? "true" : "false");
      btn.textContent = open ? "Chart only" : "Table";
    });
    allTables.push({ host: tableHost, btn: btn });
    grid.appendChild(c);
    return {
      body: body,
      setTable: function (cols, rows, o) {
        while (tableHost.firstChild) tableHost.removeChild(tableHost.firstChild);
        tableHost.appendChild(table(cols, rows, o));
      },
      empty: function (msg) {
        body.appendChild(h("p", "empty", msg));
        btn.hidden = true;
      }
    };
  }

  /* ============================== charts ============================== */

  /* A time-series line/area chart with a crosshair that snaps to the nearest
     date and reports EVERY series at that date — the reader never has to land
     on a 2px line to get a value. */
  function lineChart(host, opt) {
    var series = opt.series.filter(function (s) { return s.points.length; });
    if (!series.length) { host.appendChild(h("p", "empty", "No data in range.")); return; }
    var p = Plot(host, { height: opt.height || 250, margin: opt.margin });
    var xs = [], ys = [0];
    series.forEach(function (s) {
      s.points.forEach(function (pt) { xs.push(pt.x); ys.push(pt.y); });
    });
    var x = linear(Math.min.apply(null, xs), Math.max.apply(null, xs), p.x0, p.x1);
    var maxY = Math.max.apply(null, ys) || 1;
    var ticks = niceTicks(0, maxY, 5);
    var y = linear(0, ticks[ticks.length - 1] || maxY, p.y1, p.y0);
    axisY(p, y, { ticks: ticks, fmt: opt.yFmt });
    axisXDate(p, x);

    series.forEach(function (s) {
      var pts = s.points.map(function (pt) { return [x(pt.x), y(pt.y)]; });
      if (s.area) {
        var poly = pts.concat([[pts[pts.length - 1][0], y(0)], [pts[0][0], y(0)]]);
        e("path", { "class": "mark-area", fill: s.color, d: pathOf(poly) + " Z" }, p.g);
      }
      e("path", { "class": s.dash ? "mark-proj" : "mark-line",
                  stroke: s.color, d: pathOf(pts) }, p.g);
      /* Direct label at the end of the line — selective by construction:
         one per series, never a number on every point. */
      if (!s.dash && pts.length && opt.endLabels !== false) {
        var last = pts[pts.length - 1];
        e("circle", { "class": "mark-dot", cx: last[0], cy: last[1],
                      r: 4, fill: s.color }, p.g);
        if (series.length <= 4) {
          var lb = e("text", { "class": "label-strong", x: last[0] - 6,
                               y: last[1] - 9, "text-anchor": "end" }, p.g);
          txt(lb, (opt.yFmt || num)(s.points[s.points.length - 1].y));
        }
      }
    });

    var cross = e("line", { "class": "crosshair", y1: p.y0, y2: p.y1,
                            x1: -99, x2: -99, opacity: 0 }, p.g);
    var hit = e("rect", { "class": "hit", x: p.x0, y: p.y0,
                          width: p.iw, height: p.ih }, p.g);
    function at(ev) {
      var r = p.svg.getBoundingClientRect();
      var want = x.invert(ev.clientX - r.left);
      var rows = [], best = null;
      series.forEach(function (s) {
        var pick = null, dist = Infinity;
        s.points.forEach(function (pt) {
          var d = Math.abs(pt.x - want);
          if (d < dist) { dist = d; pick = pt; }
        });
        if (pick) {
          if (!best || Math.abs(pick.x - want) < Math.abs(best.x - want)) best = pick;
          rows.push({ color: s.color, label: s.name,
                      value: (opt.yFmt || num)(pick.y) });
        }
      });
      if (!best) return;
      cross.setAttribute("x1", x(best.x)); cross.setAttribute("x2", x(best.x));
      cross.setAttribute("opacity", 1);
      tipShow(ev, shortDate(n2d(best.x)), rows);
    }
    hit.addEventListener("pointermove", at);
    hit.addEventListener("pointerleave", function () {
      cross.setAttribute("opacity", 0); tipHide();
    });
    legend(host, series.filter(function (s) { return !s.hideLegend; })
      .map(function (s) {
        return { label: s.name + (s.dash ? " (projected)" : ""),
                 color: s.color, line: true };
      }));
  }

  /* Stacked areas, separated by a 2px surface gap rather than a border. */
  function stackedArea(host, opt) {
    if (!opt.rows.length) { host.appendChild(h("p", "empty", "No data in range.")); return; }
    var p = Plot(host, { height: opt.height || 270 });
    var xsAll = opt.rows.map(function (r) { return d2n(r.date); });
    var x = linear(Math.min.apply(null, xsAll), Math.max.apply(null, xsAll), p.x0, p.x1);
    var totals = opt.rows.map(function (r) {
      return opt.bands.reduce(function (a, b) { return a + (r[b.key] || 0); }, 0);
    });
    var ticks = niceTicks(0, Math.max.apply(null, totals) || 1, 5);
    var y = linear(0, ticks[ticks.length - 1], p.y1, p.y0);
    axisY(p, y, { ticks: ticks });
    axisXDate(p, x);
    var base = opt.rows.map(function () { return 0; });
    opt.bands.forEach(function (b) {
      var top = [], bottom = [];
      opt.rows.forEach(function (r, i) {
        var v = base[i] + (r[b.key] || 0);
        top.push([x(xsAll[i]), y(v)]);
        bottom.push([x(xsAll[i]), y(base[i])]);
        base[i] = v;
      });
      bottom.reverse();
      e("path", { "class": "mark-band", fill: b.color,
                  d: pathOf(top.concat(bottom)) + " Z" }, p.g);
    });
    var cross = e("line", { "class": "crosshair", y1: p.y0, y2: p.y1,
                            x1: -99, x2: -99, opacity: 0 }, p.g);
    var hit = e("rect", { "class": "hit", x: p.x0, y: p.y0,
                          width: p.iw, height: p.ih }, p.g);
    hit.addEventListener("pointermove", function (ev) {
      var r = p.svg.getBoundingClientRect();
      var want = x.invert(ev.clientX - r.left), bi = 0, dist = Infinity;
      xsAll.forEach(function (v, i) {
        var d = Math.abs(v - want);
        if (d < dist) { dist = d; bi = i; }
      });
      cross.setAttribute("x1", x(xsAll[bi])); cross.setAttribute("x2", x(xsAll[bi]));
      cross.setAttribute("opacity", 1);
      tipShow(ev, shortDate(opt.rows[bi].date), opt.bands.slice().reverse()
        .map(function (b) {
          return { color: b.color, label: b.label,
                   value: num(opt.rows[bi][b.key] || 0) };
        }));
    });
    hit.addEventListener("pointerleave", function () {
      cross.setAttribute("opacity", 0); tipHide();
    });
    legend(host, opt.bands.map(function (b) {
      return { label: b.label, color: b.color };
    }));
  }

  /* Columns. Capped thickness, 4px rounded cap, square at the baseline. */
  function barChart(host, opt) {
    var groups = opt.series || [{ name: opt.name || "", color: opt.color,
                                  values: opt.values }];
    if (!opt.labels.length) { host.appendChild(h("p", "empty", "No data in range.")); return; }
    var p = Plot(host, { height: opt.height || 250,
                         margin: { bottom: opt.rotate ? 52 : 30 } });
    var step = p.iw / opt.labels.length;
    var maxV = 1;
    groups.forEach(function (g) {
      g.values.forEach(function (v) { maxV = Math.max(maxV, v || 0); });
    });
    var ticks = niceTicks(0, maxV, 5);
    var y = linear(0, ticks[ticks.length - 1], p.y1, p.y0);
    axisY(p, y, { ticks: ticks, fmt: opt.yFmt });
    var capped = Math.min(24, (step - 8) / groups.length);
    var bw = Math.max(3, capped);
    opt.labels.forEach(function (lab, i) {
      groups.forEach(function (g, gi) {
        var v = g.values[i] || 0;
        var x = p.x0 + step * i + (step - bw * groups.length) / 2 + gi * bw;
        var top = y(v), hgt = Math.max(0, p.y1 - top);
        var r = Math.min(4, bw / 2, hgt);
        /* Rounded data-end, square at the baseline — drawn as a path so the
           two ends differ; rx on a rect would round all four corners. */
        var d = "M" + x + " " + p.y1 + " L" + x + " " + (top + r) +
                " Q" + x + " " + top + " " + (x + r) + " " + top +
                " L" + (x + bw - r) + " " + top +
                " Q" + (x + bw) + " " + top + " " + (x + bw) + " " + (top + r) +
                " L" + (x + bw) + " " + p.y1 + " Z";
        var bar = e("path", { "class": "mark-bar", fill: g.color, d: d }, p.g);
        var hit = e("rect", { "class": "hit", x: x - 3, y: p.y0,
                              width: bw + 6, height: p.ih }, p.g);
        hit.addEventListener("pointermove", function (ev) {
          bar.setAttribute("opacity", .78);
          tipShow(ev, lab, groups.map(function (gg) {
            return { color: gg.color, label: gg.name || opt.valueLabel || "value",
                     value: (opt.yFmt || num)(gg.values[i] || 0) };
          }));
        });
        hit.addEventListener("pointerleave", function () {
          bar.removeAttribute("opacity"); tipHide();
        });
      });
    });
    if (opt.rotate) {
      opt.labels.forEach(function (lab, i) {
        var cx = p.x0 + step * (i + .5);
        var lb = e("text", { x: cx, y: p.y1 + 14, "text-anchor": "end",
                             transform: "rotate(-40 " + cx + " " + (p.y1 + 14) + ")" }, p.g);
        txt(lb, lab);
      });
      e("line", { "class": "axis-line", x1: p.x0, x2: p.x1,
                  y1: p.y1 + .5, y2: p.y1 + .5 }, p.g);
    } else {
      axisXBand(p, opt.labels, step, {});
    }
    if (groups.length > 1) {
      legend(host, groups.map(function (g) {
        return { label: g.name, color: g.color };
      }));
    }
  }

  /* Scatter with percentile rules. Every point carries a hit area far larger
     than the 8px dot — a pinpoint target is one nobody reliably hits. */
  function scatter(host, opt) {
    if (!opt.points.length) { host.appendChild(h("p", "empty", "No completed work in range.")); return; }
    var p = Plot(host, { height: opt.height || 270 });
    var xs = opt.points.map(function (q) { return q.x; });
    var x = linear(Math.min.apply(null, xs), Math.max.apply(null, xs), p.x0, p.x1);
    var maxY = Math.max.apply(null, opt.points.map(function (q) { return q.y; })) || 1;
    var ticks = niceTicks(0, maxY, 5);
    var y = linear(0, ticks[ticks.length - 1], p.y1, p.y0);
    axisY(p, y, { ticks: ticks });
    axisXDate(p, x);
    (opt.rules || []).forEach(function (r) {
      if (r.y === null || r.y === undefined) return;
      e("line", { "class": "mark-rule", x1: p.x0, x2: p.x1,
                  y1: y(r.y), y2: y(r.y) }, p.g);
      var lb = e("text", { "class": "label-soft", x: p.x1, y: y(r.y) - 6,
                           "text-anchor": "end" }, p.g);
      txt(lb, r.label);
    });
    opt.points.forEach(function (q) {
      var cx = x(q.x), cy = y(q.y);
      var dot = e("circle", { "class": "mark-dot", cx: cx, cy: cy, r: 4,
                              fill: opt.color }, p.g);
      var hit = e("circle", { "class": "hit", cx: cx, cy: cy, r: 12 }, p.g);
      hit.addEventListener("pointermove", function (ev) {
        dot.setAttribute("r", 6);
        tipShow(ev, q.id, [
          { color: opt.color, label: opt.unit || "days", value: num(q.y) },
          { label: "closed", value: shortDate(n2d(q.x)) },
          { label: "", value: q.label }
        ]);
      });
      hit.addEventListener("pointerleave", function () {
        dot.setAttribute("r", 4); tipHide();
      });
    });
  }

  /* Part-to-whole at a glance only. Six segments is the ceiling and this
     never has more than five. */
  function donut(host, opt) {
    var total = opt.slices.reduce(function (a, s) { return a + s.value; }, 0);
    if (!total) { host.appendChild(h("p", "empty", "Nothing to show.")); return; }
    var size = 200, r = 84, ir = 54, cx = size / 2, cy = size / 2;
    var svg = e("svg", { "class": "plot", width: size, height: size,
                         viewBox: "0 0 " + size + " " + size, role: "img" });
    svg.style.margin = "0 auto";
    host.appendChild(svg);
    var a0 = -Math.PI / 2;
    opt.slices.forEach(function (s) {
      var frac = s.value / total, a1 = a0 + frac * Math.PI * 2;
      var big = frac > .5 ? 1 : 0;
      var p0 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)];
      var p1 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
      var q0 = [cx + ir * Math.cos(a1), cy + ir * Math.sin(a1)];
      var q1 = [cx + ir * Math.cos(a0), cy + ir * Math.sin(a0)];
      var d = "M" + p0 + " A" + r + " " + r + " 0 " + big + " 1 " + p1 +
              " L" + q0 + " A" + ir + " " + ir + " 0 " + big + " 0 " + q1 + " Z";
      var seg = e("path", { "class": "mark-band", fill: s.color, d: d }, svg);
      seg.addEventListener("pointermove", function (ev) {
        seg.setAttribute("opacity", .78);
        tipShow(ev, s.label, [{ color: s.color, label: "of " + total,
                                value: num(s.value) + " (" + pct(100 * frac) + ")" }]);
      });
      seg.addEventListener("pointerleave", function () {
        seg.removeAttribute("opacity"); tipHide();
      });
      a0 = a1;
    });
    var big = e("text", { "class": "label-strong", x: cx, y: cy - 2,
                          "text-anchor": "middle", "font-size": 24 }, svg);
    txt(big, num(total));
    var sub = e("text", { x: cx, y: cy + 16, "text-anchor": "middle" }, svg);
    txt(sub, opt.centerLabel || "total");
    legend(host, opt.slices.map(function (s) {
      return { label: s.label + " — " + num(s.value), color: s.color };
    }));
  }

  /* Calendar heatmap, one hue light→dark. Never a rainbow. */
  function heatmap(host, opt) {
    var days = Object.keys(opt.counts);
    if (!days.length) { host.appendChild(h("p", "empty", "No commit history available.")); return; }
    var lo = d2n(opt.start), hi = d2n(opt.end);
    var first = lo - ((new Date(lo).getUTCDay() + 6) % 7) * 864e5;
    var weeks = Math.ceil((hi - first) / (7 * 864e5)) + 1;
    var cell = Math.max(10, Math.min(18, Math.floor((host.clientWidth - 40) / weeks) - 3));
    var gap = 3, W = weeks * (cell + gap) + 34, H = 7 * (cell + gap) + 24;
    var svg = e("svg", { "class": "plot", width: "100%", height: H,
                         viewBox: "0 0 " + W + " " + H, role: "img" });
    host.appendChild(svg);
    var max = 1;
    for (var k in opt.counts) max = Math.max(max, opt.counts[k]);
    var ramp = ["--seq-100", "--seq-200", "--seq-400", "--seq-600", "--seq-700"]
      .map(tok);
    ["Mon", "", "Wed", "", "Fri", "", ""].forEach(function (lab, i) {
      if (!lab) return;
      var t = e("text", { x: 0, y: 20 + i * (cell + gap) + cell - 2 }, svg);
      txt(t, lab);
    });
    for (var t0 = first; t0 <= hi; t0 += 864e5) {
      var key = n2d(t0);
      var w = Math.floor((t0 - first) / (7 * 864e5));
      var dow = (new Date(t0).getUTCDay() + 6) % 7;
      var v = opt.counts[key] || 0;
      var idx = v === 0 ? -1 : Math.min(ramp.length - 1,
        Math.floor((v - 1) / Math.max(max, 1) * ramp.length));
      var rect = e("rect", {
        "class": "cell", x: 30 + w * (cell + gap), y: 14 + dow * (cell + gap),
        width: cell, height: cell, rx: 2,
        fill: idx < 0 ? tok("--surface-2") : ramp[idx]
      }, svg);
      (function (key, v) {
        rect.addEventListener("pointermove", function (ev) {
          tipShow(ev, shortDate(key), [{ label: "commits", value: num(v) }]);
        });
        rect.addEventListener("pointerleave", tipHide);
      }(key, v));
    }
    var lg = h("div", "legend");
    var less = h("span", "item"); txt(less, "fewer"); lg.appendChild(less);
    ramp.forEach(function (c) {
      var it = h("div", "item"), sw = h("span", "swatch");
      sw.style.background = c; it.appendChild(sw); lg.appendChild(it);
    });
    var more = h("span", "item"); txt(more, "more"); lg.appendChild(more);
    host.appendChild(lg);
  }

  /* A horizontal timeline. One row per phase or sprint. */
  function timeline(host, opt) {
    var items = opt.items.filter(function (i) { return i.start && i.end; });
    if (!items.length) { host.appendChild(h("p", "empty", "No dated items.")); return; }
    var rowH = 26;
    var p = Plot(host, { height: items.length * rowH + 46,
                         margin: { left: opt.left || 108, bottom: 28, top: 8 } });
    var lo = Math.min.apply(null, items.map(function (i) { return d2n(i.start); }));
    var hi = Math.max.apply(null, items.map(function (i) { return d2n(i.end); }));
    var x = linear(lo, hi + 864e5, p.x0, p.x1);
    dateTicks(lo, hi, Math.max(3, Math.floor(p.iw / 100))).forEach(function (t) {
      var xx = Math.round(x(t)) + .5;
      e("line", { "class": "tick-line", x1: xx, x2: xx, y1: p.y0, y2: p.y1 }, p.g);
      var lb = e("text", { x: xx, y: p.y1 + 16, "text-anchor": "middle" }, p.g);
      txt(lb, shortDate(n2d(t)));
    });
    items.forEach(function (it, i) {
      var y = p.y0 + i * rowH + 4;
      var lb = e("text", { "class": "label-soft", x: p.x0 - 10,
                           y: y + 13, "text-anchor": "end" }, p.g);
      txt(lb, it.label);
      var xa = x(d2n(it.start)), xb = Math.max(x(d2n(it.end) + 864e5), xa + 4);
      var bar = e("rect", { "class": "mark-bar", x: xa, y: y, rx: 4,
                            width: xb - xa, height: rowH - 10,
                            fill: it.color }, p.g);
      var hit = e("rect", { "class": "hit", x: xa - 4, y: y - 3,
                            width: xb - xa + 8, height: rowH - 4 }, p.g);
      hit.addEventListener("pointermove", function (ev) {
        bar.setAttribute("opacity", .78);
        tipShow(ev, it.label, [
          { color: it.color, label: "days", value: num(it.days) },
          { label: "from", value: shortDate(it.start) },
          { label: "to", value: shortDate(it.end) },
          { label: "", value: it.detail || "" }
        ]);
      });
      hit.addEventListener("pointerleave", function () {
        bar.removeAttribute("opacity"); tipHide();
      });
    });
    e("line", { "class": "axis-line", x1: p.x0, x2: p.x1,
                y1: p.y1 + .5, y2: p.y1 + .5 }, p.g);
  }

  /* Priority × value, area by count, one sequential hue. */
  function bubbleMatrix(host, opt) {
    if (!opt.cells.length) { host.appendChild(h("p", "empty", "Nothing open.")); return; }
    var ax = opt.xs, ay = opt.ys;
    var p = Plot(host, { height: 60 + ay.length * 64,
                         margin: { left: 86, bottom: 40, top: 14 } });
    var stepX = p.iw / ax.length, stepY = p.ih / ay.length;
    var max = Math.max.apply(null, opt.cells.map(function (c) { return c.count; }));
    ax.forEach(function (lab, i) {
      var t = e("text", { x: p.x0 + stepX * (i + .5), y: p.y1 + 18,
                          "text-anchor": "middle" }, p.g);
      txt(t, lab);
    });
    ay.forEach(function (lab, j) {
      var t = e("text", { x: p.x0 - 10, y: p.y0 + stepY * (j + .5) + 4,
                          "text-anchor": "end" }, p.g);
      txt(t, lab);
      e("line", { "class": "tick-line", x1: p.x0, x2: p.x1,
                  y1: p.y0 + stepY * (j + 1), y2: p.y0 + stepY * (j + 1) }, p.g);
    });
    var ramp = ["--seq-200", "--seq-400", "--seq-600"].map(tok);
    opt.cells.forEach(function (c) {
      var i = ax.indexOf(c.x), j = ay.indexOf(c.y);
      if (i < 0 || j < 0) return;
      var cx = p.x0 + stepX * (i + .5), cy = p.y0 + stepY * (j + .5);
      var r = 10 + 20 * Math.sqrt(c.count / max);
      var idx = Math.min(2, Math.floor(c.count / Math.max(max, 1) * 3));
      var dot = e("circle", { "class": "mark-dot", cx: cx, cy: cy, r: r,
                              fill: ramp[idx] }, p.g);
      var lb = e("text", { x: cx, y: cy + 4, "text-anchor": "middle",
                           fill: tok("--surface-1"), "font-weight": 600 }, p.g);
      txt(lb, c.count);
      var hit = e("circle", { "class": "hit", cx: cx, cy: cy,
                              r: Math.max(r, 14) }, p.g);
      hit.addEventListener("pointermove", function (ev) {
        dot.setAttribute("opacity", .78);
        tipShow(ev, c.y + " value · " + c.x + " priority",
          [{ label: "open items", value: num(c.count) },
           { label: "", value: c.ids.join(", ") }]);
      });
      hit.addEventListener("pointerleave", function () {
        dot.removeAttribute("opacity"); tipHide();
      });
    });
  }

  /* ============================== tiles ================================ */
  function tiles(host, items) {
    var box = h("div", "tiles");
    items.forEach(function (it) {
      var t = h("div", "tile" + (it.hero ? " hero" : ""));
      var l = h("div", "label"); txt(l, it.label); t.appendChild(l);
      var v = h("div", "value"); txt(v, it.value); t.appendChild(v);
      if (it.foot) { var f = h("div", "foot"); txt(f, it.foot); t.appendChild(f); }
      if (it.meter !== undefined) {
        var m = h("div", "meter"), i = h("i");
        i.style.width = Math.max(0, Math.min(100, it.meter)) + "%";
        m.appendChild(i); t.appendChild(m);
      }
      box.appendChild(t);
    });
    host.appendChild(box);
  }

  /* ============================== filters ============================== */
  var F = { range: "all", sprint: "", status: "", q: "" };

  function inRange(dateStr) {
    if (F.range === "all" || !dateStr) return true;
    var cut = d2n(S.window.today) - (+F.range) * 864e5;
    return d2n(dateStr) >= cut;
  }
  function clip(rows, key) {
    return rows.filter(function (r) { return inRange(r[key || "date"]); });
  }
  function tasksFiltered() {
    var q = F.q.toLowerCase();
    return M.tasks.filter(function (t) {
      if (F.sprint && t.sprint !== F.sprint) return false;
      if (F.status && t.status !== F.status) return false;
      if (q && (t.id + " " + t.title).toLowerCase().indexOf(q) < 0) return false;
      if (F.range !== "all") {
        var d = t.done || t.updated || t.created;
        if (!inRange(d)) return false;
      }
      return true;
    });
  }
  function filtersActive() {
    return F.range !== "all" || F.sprint || F.status || F.q;
  }

  /* ============================== panels =============================== */
  var TABS = [
    { id: "overview", label: "Overview", build: tabOverview },
    { id: "burn", label: "Burn charts", build: tabBurn },
    { id: "sprints", label: "Sprints", build: tabSprints },
    { id: "flow", label: "Flow", build: tabFlow },
    { id: "backlog", label: "Backlog", build: tabBacklog },
    { id: "roadmap", label: "Roadmap & forecast", build: tabRoadmap },
    { id: "tasks", label: "Tasks", build: tabTasks },
    { id: "decisions", label: "Decisions", build: tabDecisions },
    { id: "activity", label: "Activity", build: tabActivity }
  ];

  function lede(host, text) {
    var p = h("p", "lede"); txt(p, text); host.appendChild(p);
  }
  function newGrid(host) {
    var g = h("div", "grid"); host.appendChild(g); return g;
  }

  /* ------------------------------------------------------------ overview */
  function tabOverview(host) {
    var k = S.kpi, ft = tasksFiltered();
    var done = ft.filter(function (t) { return t.status === "done"; }).length;
    tiles(host, [
      { label: "Delivered", value: pct(100 * done / Math.max(ft.length, 1)),
        foot: done + " of " + ft.length + " task briefs", hero: true,
        meter: 100 * done / Math.max(ft.length, 1) },
      { label: "In flight", value: num(k.wip),
        foot: k.blocked + " blocked" },
      { label: "Throughput", value: num(k.throughput_week),
        foot: "tasks / week, last 4 weeks" },
      { label: "Lead time", value: k.lead_p85 === null ? "—" : k.lead_p85 + "d",
        foot: "85th percentile (" + (k.lead_p50 === null ? "—" : k.lead_p50 + "d") + " median)" },
      { label: "Sprints closed", value: num(k.sprints),
        foot: k.sprint_open ? k.sprint_open + " open" : "none open" },
      { label: "Backlog open", value: num(k.backlog_open),
        foot: "of " + k.backlog_total + " raised" },
      { label: "Decisions", value: num(k.adrs),
        foot: k.reviews + " review checkpoints" },
      { label: "Elapsed", value: plural(k.elapsed, "day", "days"),
        foot: S.window.start + " → " + S.window.today }
    ]);
    var g = newGrid(host);

    var c1 = card(g, {
      span: "twothirds", title: "Release burn-up",
      note: "Scope and completed work, both cumulative. The gap between the "
          + "two lines is the work left; the top line rising is scope growth, "
          + "which a burn-down chart hides."
    });
    var bu = clip(S.burnup);
    lineChart(c1.body, {
      series: [
        { name: "Scope", color: tok("--series-2"),
          points: bu.map(function (r) { return { x: d2n(r.date), y: r.scope }; }) },
        { name: "Completed", color: tok("--series-1"), area: true,
          points: bu.map(function (r) { return { x: d2n(r.date), y: r.done }; }) }
      ]
    });
    c1.setTable([{ label: "Date" }, { label: "Scope", num: true },
                 { label: "Completed", num: true }, { label: "Remaining", num: true }],
      bu.map(function (r) {
        return [r.date, num(r.scope), num(r.done), num(r.scope - r.done)];
      }), { sortable: true });

    var c2 = card(g, { span: "third", title: "Where the work stands",
      note: "Every task brief by current status." });
    var mix = ["done", "doing", "blocked", "todo"].map(function (b) {
      return { label: S.band_label[b], value: ft.filter(function (t) {
        return t.status === b; }).length, color: bandColor(b) };
    }).filter(function (s) { return s.value; });
    var cancelled = ft.filter(function (t) { return t.status === "cancelled"; }).length;
    if (cancelled) {
      mix.push({ label: "Cancelled", value: cancelled, color: tok("--text-muted") });
    }
    donut(c2.body, { slices: mix, centerLabel: "briefs" });
    c2.setTable([{ label: "Status" }, { label: "Tasks", num: true }],
      mix.map(function (s) { return [s.label, num(s.value)]; }));

    var c3 = card(g, { span: "half", title: "Velocity by sprint",
      note: "Tasks committed to a sprint against tasks it delivered. Equal "
          + "bars mean the sprint delivered everything it took on." });
    if (S.velocity.length) {
      barChart(c3.body, {
        labels: S.velocity.map(function (v) { return v.sprint; }),
        series: [
          { name: "Committed", color: tok("--series-2"),
            values: S.velocity.map(function (v) { return v.committed; }) },
          { name: "Delivered", color: tok("--series-1"),
            values: S.velocity.map(function (v) { return v.points; }) }
        ]
      });
      c3.setTable([{ label: "Sprint" }, { label: "Committed", num: true },
                   { label: "Delivered", num: true }, { label: "Days", num: true }],
        S.velocity.map(function (v) {
          return [v.sprint, num(v.committed), num(v.points), num(v.days)];
        }), { sortable: true });
    } else { c3.empty("No sprint has any member task."); }

    var c4 = card(g, { span: "half", title: "Tasks completed per week",
      note: "The throughput a forecast is sampled from. Weeks start Monday." });
    var th = S.throughput.filter(function (r) { return inRange(r.week); });
    barChart(c4.body, {
      labels: th.map(function (r) { return shortDate(r.week); }),
      values: th.map(function (r) { return r.count; }),
      color: tok("--series-1"), valueLabel: "tasks"
    });
    c4.setTable([{ label: "Week of" }, { label: "Tasks completed", num: true }],
      th.map(function (r) { return [r.week, num(r.count)]; }), { sortable: true });

    var c5 = card(g, { span: "half", title: "Oldest work still open",
      note: "Ageing work in progress. Age is measured from the brief's "
          + "Created date, not from when it was started." });
    var aging = S.aging.slice(0, 12);
    if (aging.length) {
      barChart(c5.body, {
        labels: aging.map(function (a) { return a.id.replace("TASK-", ""); }),
        values: aging.map(function (a) { return a.age; }),
        color: tok("--series-2"), valueLabel: "days open", rotate: true
      });
      c5.setTable([{ label: "Task" }, { label: "Status" }, { label: "Title", cls: "wide" },
                   { label: "Age (days)", num: true }, { label: "Criteria met" }],
        S.aging.map(function (a) {
          return [a.id, chip(a.status, a.status_raw), a.title, num(a.age),
                  a.criteria.checked + " / " + a.criteria.total];
        }), { sortable: true });
    } else { c5.empty("Nothing is open."); }

    var c6 = card(g, { span: "half", title: "Acceptance criteria met",
      note: "Ticked checkboxes across every brief. A brief keeps its unticked "
          + "boxes after closing, so this is a record of what was verified, "
          + "not a completion percentage.",
      caveat: false });
    var byS = {};
    M.tasks.forEach(function (t) {
      var s = t.sprint || "unassigned";
      byS[s] = byS[s] || { t: 0, c: 0 };
      byS[s].t += t.criteria.total; byS[s].c += t.criteria.checked;
    });
    var keys = Object.keys(byS).filter(function (s) { return byS[s].t; });
    keys.sort();
    /* Not every layout has this section. project-workflow's task schema
       carries `## Verification` and no checkbox list at all, so zero here is
       a fact about the schema, not a project that verified nothing — and
       "No data in range" would have said the wrong one. */
    if (!keys.length) {
      c6.empty("No brief in this layout records acceptance criteria as "
             + "checkboxes, so there is nothing to count. The "
             + "project-workflow task schema carries a Verification section "
             + "instead of a criteria checklist.");
      return;
    }
    barChart(c6.body, {
      labels: keys, rotate: true,
      series: [
        { name: "Total", color: tok("--series-2"),
          values: keys.map(function (s) { return byS[s].t; }) },
        { name: "Ticked", color: tok("--series-1"),
          values: keys.map(function (s) { return byS[s].c; }) }
      ]
    });
    c6.setTable([{ label: "Sprint" }, { label: "Criteria", num: true },
                 { label: "Ticked", num: true }, { label: "Share" }],
      keys.map(function (s) {
        return [s, num(byS[s].t), num(byS[s].c),
                pct(100 * byS[s].c / Math.max(byS[s].t, 1))];
      }), { sortable: true });
  }

  /* ---------------------------------------------------------------- burn */
  function tabBurn(host) {
    lede(host, "Burn-up first: it is the only one of these that separates "
      + "progress from scope change. The burn-down below shows the same data "
      + "as one line, which is easier to read and easier to mislead with.");
    var g = newGrid(host);
    var bu = clip(S.burnup), bd = clip(S.burndown);

    var c1 = card(g, { span: "half", title: "Release burn-up",
      note: "Two cumulative lines: total scope, and what is finished. Scope "
          + "rising means work was added after the start." });
    lineChart(c1.body, { height: 290, series: [
      { name: "Scope", color: tok("--series-2"),
        points: bu.map(function (r) { return { x: d2n(r.date), y: r.scope }; }) },
      { name: "Completed", color: tok("--series-1"), area: true,
        points: bu.map(function (r) { return { x: d2n(r.date), y: r.done }; }) }
    ] });
    c1.setTable([{ label: "Date" }, { label: "Scope", num: true },
                 { label: "Completed", num: true }],
      bu.map(function (r) { return [r.date, num(r.scope), num(r.done)]; }),
      { sortable: true });

    var c2 = card(g, { span: "half", title: "Release burn-down",
      note: S.projected_done
        ? "Remaining work, with a least-squares trend over the last three "
          + "weeks projected to zero — a claim about observed pace, not a "
          + "committed date. No end date is declared anywhere in .ai/, so no "
          + "ideal line is drawn: that would invent a commitment."
        : "Remaining work. No projection is drawn because the recent trend "
          + "is flat or rising — a projection would have to point away from "
          + "zero, and a chart that cannot say when is better than one that "
          + "guesses." });
    var series = [{ name: "Remaining", color: tok("--series-1"), area: true,
      points: bd.map(function (r) { return { x: d2n(r.date), y: r.remaining }; }) }];
    if (S.projection.length) {
      series.push({ name: "Trend", color: tok("--series-2"), dash: true,
        points: S.projection.map(function (r) {
          return { x: d2n(r.date), y: r.remaining }; }) });
    }
    lineChart(c2.body, { height: 290, series: series });
    c2.setTable([{ label: "Date" }, { label: "Remaining", num: true }],
      bd.map(function (r) { return [r.date, num(r.remaining)]; }), { sortable: true });

    var c3 = card(g, { title: "Cumulative flow",
      caveat: true,
      note: "RECONSTRUCTED, NOT REPLAYED. Neither framework records status "
          + "transitions, so each task's history is rebuilt from three "
          + "instants: Created, the Execution log's first Date, and the "
          + "commit that closed it. A task that went to blocked and back "
          + "looks here as though it never did. Band widths are still "
          + "readable; the moment a band changed is not." });
    stackedArea(c3.body, { height: 320, rows: clip(S.cfd),
      bands: ["done", "doing", "blocked", "todo"].map(function (b) {
        return { key: b, label: S.band_label[b], color: bandColor(b) };
      }) });
    c3.setTable([{ label: "Date" }, { label: "To do", num: true },
                 { label: "In progress", num: true }, { label: "Blocked", num: true },
                 { label: "Done", num: true }],
      clip(S.cfd).map(function (r) {
        return [r.date, num(r.todo), num(r.doing), num(r.blocked), num(r.done)];
      }), { sortable: true });

    var c4 = card(g, { title: "Work in progress over time",
      note: "The in-progress and blocked bands of the diagram above, on their "
          + "own scale. Little's law: with throughput fixed, cycle time moves "
          + "with this line." });
    var w = clip(S.wip);
    lineChart(c4.body, { height: 200, series: [
      { name: "Items in progress", color: tok("--series-1"), area: true,
        points: w.map(function (r) { return { x: d2n(r.date), y: r.wip }; }) }
    ] });
    c4.setTable([{ label: "Date" }, { label: "In progress", num: true }],
      w.map(function (r) { return [r.date, num(r.wip)]; }), { sortable: true });
  }

  /* ------------------------------------------------------------- sprints */
  function tabSprints(host) {
    var real = S.sprints.filter(function (s) { return s.state !== "adhoc"; });
    var adhoc = S.sprints.filter(function (s) { return s.state === "adhoc"; });
    lede(host, "A sprint's window is its own: the burn-down below runs from "
      + "the sprint's first task to its close, not over the whole project. "
      + "Use the Sprint filter above to pick one.");
    var g = newGrid(host);

    var c0 = card(g, { title: "Sprint timeline",
      note: "Every sprint on one axis, so overlap and gaps between them are "
          + "visible. Bar length is elapsed days, not effort." });
    timeline(c0.body, { items: real.map(function (s) {
      return { label: s.id, start: s.start, end: s.end, days: s.days,
               color: s.state === "open" ? tok("--series-2") : tok("--series-1"),
               detail: s.done + " of " + s.tasks + " delivered" };
    }) });
    c0.setTable([{ label: "Sprint" }, { label: "Title", cls: "wide" },
                 { label: "State" }, { label: "Start" }, { label: "End" },
                 { label: "Days", num: true }, { label: "Tasks", num: true },
                 { label: "Delivered", num: true }],
      S.sprints.map(function (s) {
        return [s.id, s.title, s.state, s.start, s.end, num(s.days),
                num(s.tasks), num(s.done)];
      }), { sortable: true });

    var pick = F.sprint && S.sprints.filter(function (s) {
      return s.id === F.sprint; })[0];
    if (!pick) pick = real.filter(function (s) { return s.burn.length > 1; }).pop()
                   || real[real.length - 1];
    if (pick) {
      var c1 = card(g, { span: "half", title: "Burn-down — " + pick.id,
        note: pick.burn.length > 1
          ? "Remaining work against the straight line from the sprint's "
            + "committed scope to zero at its close. The ideal line is drawn "
            + "here, and only here, because a sprint does have a declared end."
          : "This sprint opened and closed inside a single day, so its "
            + "burn-down is one point. That is the record, not a rendering "
            + "fault." });
      if (pick.burn.length > 1) {
        lineChart(c1.body, { height: 260, series: [
          { name: "Remaining", color: tok("--series-1"), area: true,
            points: pick.burn.map(function (r) {
              return { x: d2n(r.date), y: r.remaining }; }) },
          { name: "Ideal", color: tok("--text-muted"), dash: true,
            points: pick.burn.map(function (r) {
              return { x: d2n(r.date), y: r.ideal }; }) }
        ] });
      } else {
        c1.body.appendChild(h("p", "empty",
          pick.id + " ran for one day and delivered " + pick.done
          + " of " + pick.tasks + " tasks."));
      }
      c1.setTable([{ label: "Date" }, { label: "Remaining", num: true },
                   { label: "Ideal", num: true }],
        pick.burn.map(function (r) {
          return [r.date, num(r.remaining), num(r.ideal)]; }));

      var c2 = card(g, { span: "half", title: "Burn-up — " + pick.id,
        note: "The same sprint as scope against completed, so work added "
            + "mid-sprint is visible rather than absorbed." });
      if (pick.burn.length > 1) {
        lineChart(c2.body, { height: 260, series: [
          { name: "Scope", color: tok("--series-2"),
            points: pick.burn.map(function (r) {
              return { x: d2n(r.date), y: r.scope }; }) },
          { name: "Completed", color: tok("--series-1"), area: true,
            points: pick.burn.map(function (r) {
              return { x: d2n(r.date), y: r.done }; }) }
        ] });
      } else {
        c2.body.appendChild(h("p", "empty", "One-day sprint — see the table."));
      }
      c2.setTable([{ label: "Date" }, { label: "Scope", num: true },
                   { label: "Completed", num: true }],
        pick.burn.map(function (r) { return [r.date, num(r.scope), num(r.done)]; }));
    }

    var c3 = card(g, { span: "half", title: "Delivered per sprint",
      note: "Committed against delivered. Every sprint here delivered what it "
          + "took on; a shortfall would show as a gap." });
    barChart(c3.body, { labels: real.map(function (s) { return s.id; }),
      series: [
        { name: "Committed", color: tok("--series-2"),
          values: real.map(function (s) { return s.points; }) },
        { name: "Delivered", color: tok("--series-1"),
          values: real.map(function (s) { return s.points_done; }) }
      ] });
    c3.setTable([{ label: "Sprint" }, { label: "Committed", num: true },
                 { label: "Delivered", num: true }],
      real.map(function (s) {
        return [s.id, num(s.points), num(s.points_done)]; }), { sortable: true });

    var c4 = card(g, { span: "half", title: "Work run outside a sprint",
      note: "Tasks the index files under a Post-S# heading or under no sprint "
          + "at all. A large share here means the cadence is nominal — worth "
          + "knowing, and invisible on a velocity chart." });
    if (adhoc.length) {
      barChart(c4.body, { labels: adhoc.map(function (s) { return s.id; }),
        values: adhoc.map(function (s) { return s.tasks; }),
        color: tok("--series-2"), valueLabel: "tasks", rotate: true });
      c4.setTable([{ label: "Bucket" }, { label: "Tasks", num: true },
                   { label: "Delivered", num: true }, { label: "First" },
                   { label: "Last" }],
        adhoc.map(function (s) {
          return [s.id, num(s.tasks), num(s.done), s.start, s.end]; }),
        { sortable: true });
    } else { c4.empty("Every task belongs to a sprint."); }
  }

  /* ---------------------------------------------------------------- flow */
  function tabFlow(host) {
    var k = S.kpi;
    lede(host, "Flow metrics read the same way at any estimate scale, which "
      + "is why they matter here: no brief in either framework carries a "
      + "story point, so these are the measurements that need none.");
    tiles(host, [
      { label: "Cycle time (85th pct)",
        value: k.cycle_p85 === null ? "—" : k.cycle_p85 + "d",
        foot: "median " + (k.cycle_p50 === null ? "—" : k.cycle_p50 + "d")
            + " · start → close" },
      { label: "Lead time (85th pct)",
        value: k.lead_p85 === null ? "—" : k.lead_p85 + "d",
        foot: "median " + (k.lead_p50 === null ? "—" : k.lead_p50 + "d")
            + " · created → close" },
      { label: "Throughput", value: num(k.throughput_week),
        foot: "tasks / week, last 4 weeks" },
      { label: "Work in progress", value: num(k.wip),
        foot: k.blocked + " of it blocked" }
    ]);
    var g = newGrid(host);
    var cyc = clip(S.cycle);

    var c1 = card(g, { title: "Cycle time scatter",
      note: "One dot per closed task, placed on the day it closed. The two "
          + "rules are the 50th and 85th percentiles — the honest way to "
          + "answer “how long does a task take”, because an average "
          + "hides the tail that actually hurts.",
      caveat: false });
    scatter(c1.body, { height: 300, color: tok("--series-1"), unit: "days",
      rules: [{ y: k.cycle_p50, label: "50th percentile" },
              { y: k.cycle_p85, label: "85th percentile" }],
      points: cyc.map(function (c) {
        return { x: d2n(c.date), y: c.cycle, id: c.id, label: c.title }; }) });
    c1.setTable([{ label: "Task" }, { label: "Title", cls: "wide" },
                 { label: "Closed" }, { label: "Cycle (days)", num: true },
                 { label: "Lead (days)", num: true }],
      cyc.map(function (c) {
        return [c.id, c.title, c.date, num(c.cycle), num(c.lead)]; }),
      { sortable: true });

    var c2 = card(g, { span: "half", title: "Lead-time distribution",
      note: "How many tasks took how long from brief to close. A long right "
          + "tail is what a mean would have hidden." });
    var lh = S.lead_hist;
    barChart(c2.body, { labels: lh.map(function (r) { return r.days + "d"; }),
      values: lh.map(function (r) { return r.count; }),
      color: tok("--series-1"), valueLabel: "tasks" });
    c2.setTable([{ label: "Lead time (days)", num: true },
                 { label: "Tasks", num: true }],
      lh.map(function (r) { return [num(r.days), num(r.count)]; }),
      { sortable: true });

    var c3 = card(g, { span: "half", title: "Ageing work in progress",
      note: "Open items by age. Anything far to the right of the 85th "
          + "percentile above is older than the work that has been closing." });
    if (S.aging.length) {
      barChart(c3.body, {
        labels: S.aging.map(function (a) { return a.id.replace("TASK-", ""); }),
        values: S.aging.map(function (a) { return a.age; }),
        color: tok("--series-2"), valueLabel: "days open", rotate: true });
      c3.setTable([{ label: "Task" }, { label: "Status" },
                   { label: "Title", cls: "wide" }, { label: "Owner" },
                   { label: "Age (days)", num: true }],
        S.aging.map(function (a) {
          return [a.id, chip(a.status, a.status_raw), a.title, a.owner,
                  num(a.age)]; }), { sortable: true });
    } else { c3.empty("Nothing is open."); }

    var c4 = card(g, { title: "Tasks closed per day",
      note: "The raw signal behind throughput and behind the forecast on the "
          + "Roadmap tab. Zero days are kept — dropping them is how a "
          + "forecast becomes optimistic." });
    var dd = clip(S.daily);
    barChart(c4.body, { height: 200,
      labels: dd.map(function (r) { return shortDate(r.date); }),
      values: dd.map(function (r) { return r.count; }),
      color: tok("--series-1"), valueLabel: "tasks closed" });
    c4.setTable([{ label: "Date" }, { label: "Closed", num: true }],
      dd.map(function (r) { return [r.date, num(r.count)]; }), { sortable: true });
  }

  /* ------------------------------------------------------------- backlog */
  function tabBacklog(host) {
    var bl = M.backlog;
    var openItems = bl.filter(function (b) { return b.status !== "done"; });
    lede(host, "The backlog is what has been observed and deliberately not "
      + "fixed yet. Counts here are read from the rows every time this file "
      + "is generated, so they cannot drift from the table they describe.");
    tiles(host, [
      { label: "Open", value: num(openItems.length),
        foot: "of " + bl.length + " ever raised" },
      { label: "Closed", value: num(bl.length - openItems.length),
        foot: pct(100 * (bl.length - openItems.length) / Math.max(bl.length, 1))
            + " of all items" },
      { label: "High priority open",
        value: num(openItems.filter(function (b) {
          return b.priority === "high"; }).length),
        foot: "priority as written in the row" },
      { label: "Blocked / waiting",
        value: num(openItems.filter(function (b) {
          return b.status === "blocked"; }).length),
        foot: "waiting on something external" }
    ]);
    var g = newGrid(host);

    var c1 = card(g, { span: "half", title: "Open items by priority and value",
      note: "Area is item count; the darker step is the busier cell. Top-right "
          + "is what to pull next." });
    bubbleMatrix(c1.body, {
      xs: ["high", "medium", "low", "unrated"],
      ys: ["high", "medium", "low", "unrated"],
      cells: S.backlog_matrix.map(function (c) {
        return { x: c.priority, y: c.value, count: c.count, ids: c.ids }; })
    });
    c1.setTable([{ label: "Priority" }, { label: "Value" },
                 { label: "Open", num: true }, { label: "Items", cls: "wide" }],
      S.backlog_matrix.map(function (c) {
        return [c.priority, c.value, num(c.count), c.ids.join(", ")]; }),
      { sortable: true });

    var c2 = card(g, { span: "half", title: "Raised and closed by priority",
      note: "One ordinal blue ramp, low to high — the categories are ordered, "
          + "so the colour is allowed to be." });
    barChart(c2.body, { labels: S.backlog_mix.map(function (r) { return r.priority; }),
      series: [
        { name: "Closed", color: tok("--ord-1"),
          values: S.backlog_mix.map(function (r) { return r.closed; }) },
        { name: "Open", color: tok("--ord-3"),
          values: S.backlog_mix.map(function (r) { return r.open; }) }
      ] });
    c2.setTable([{ label: "Priority" }, { label: "Open", num: true },
                 { label: "Closed", num: true }],
      S.backlog_mix.map(function (r) {
        return [r.priority, num(r.open), num(r.closed)]; }), { sortable: true });

    var q = F.q.toLowerCase();
    var rows = bl.filter(function (b) {
      return !q || (b.id + " " + b.title).toLowerCase().indexOf(q) >= 0;
    }).map(function (b) {
      return [b.id, chip(b.status, b.status_raw), b.title, b.priority,
              b.value, b.risk, b.depends, b.note];
    });
    var c3 = card(g, { title: "Every backlog item",
      note: "Sortable and searchable. The Notes column is the row's own "
          + "“ready when” text, truncated." });
    c3.body.appendChild(table(
      [{ label: "ID" }, { label: "Status" }, { label: "Title", cls: "wide" },
       { label: "Priority" }, { label: "Value" }, { label: "Risk" },
       { label: "Depends on" }, { label: "Notes", cls: "wide" }],
      rows, { sortable: true }));
    c3.setTable([{ label: "ID" }, { label: "Title", cls: "wide" },
                 { label: "Status" }],
      bl.map(function (b) { return [b.id, b.title, b.status_raw]; }),
      { sortable: true });
  }

  /* ------------------------------------------------------- roadmap ahead */
  function tabRoadmap(host) {
    var k = S.kpi, fc = S.forecast;
    var future = M.phases.filter(function (p) { return p.state !== "done"; });
    lede(host, "What is still ahead, and when the current pace would reach it. "
      + "Nothing here is a commitment: no target date exists anywhere in "
      + ".ai/, and this tab does not invent one.");
    tiles(host, [
      { label: "Phases complete", value: k.phases_done + " / " + k.phases,
        meter: 100 * k.phases_done / Math.max(k.phases, 1),
        foot: future.length ? plural(future.length, "phase", "phases") + " declared ahead"
                            : "no further phase declared" },
      { label: "Open work", value: num(k.open),
        foot: "task briefs not closed" },
      { label: "50% by", value: fc.p50_date || "—",
        foot: fc.p50 === null || fc.p50 === undefined ? "not forecastable"
                                                      : "in " + plural(fc.p50, "day", "days") },
      { label: "85% by", value: fc.p85_date || "—",
        foot: "the number to quote — 50% is a coin toss" }
    ]);
    var g = newGrid(host);

    var c0 = card(g, { title: "Roadmap phases",
      note: future.length
        ? "Declared phases on one axis. Undated phases cannot be placed and "
          + "appear only in the table."
        : "Every declared phase is complete. Nothing beyond them is written "
          + "down, so the timeline below is the whole declared roadmap — the "
          + "forward view comes from the backlog and the forecast, not from "
          + "here." });
    timeline(c0.body, { left: 150, items: M.phases.map(function (p, i) {
      var prev = M.phases[i - 1];
      return { label: p.id, start: (prev && prev.date) || p.date, end: p.date,
               days: 1, color: p.state === "done" ? tok("--series-1") : tok("--series-2"),
               detail: p.title };
    }) });
    c0.setTable([{ label: "Phase" }, { label: "Title", cls: "wide" },
                 { label: "State" }, { label: "Completed" }],
      M.phases.map(function (p) {
        return [p.id, p.title, p.state === "done" ? "complete" : "open",
                p.date]; }), { sortable: true });

    var c1 = card(g, { span: "half", title: "When the open work finishes",
      note: "A Monte Carlo over " + num(fc.samples) + " runs, sampling the "
          + "project's own daily throughput — including its zero days. It "
          + "needs no estimate and no target date, which is the point. The "
          + "run is seeded, so the same history always gives the same "
          + "forecast." });
    if (fc.histogram && fc.histogram.length) {
      barChart(c1.body, {
        labels: fc.histogram.map(function (r) { return r.days + "d"; }),
        values: fc.histogram.map(function (r) { return r.count; }),
        color: tok("--series-1"), valueLabel: "runs" });
      c1.setTable([{ label: "Days to finish", num: true },
                   { label: "Simulation runs", num: true }],
        fc.histogram.map(function (r) { return [num(r.days), num(r.count)]; }),
        { sortable: true });
    } else {
      c1.empty(fc.remaining ? "No throughput history to sample from."
                            : "No work is open, so there is nothing to forecast.");
    }

    var c2 = card(g, { span: "half", title: "Forecast confidence",
      note: "Quote the 85th percentile, not the 50th: the 50th is the date "
          + "you miss half the time." });
    var conf = [[50, fc.p50, fc.p50_date], [85, fc.p85, fc.p85_date],
                [95, fc.p95, fc.p95_date]];
    if (fc.p50 === null || fc.p50 === undefined) {
      c2.empty("Not forecastable: " + (fc.remaining ? "no throughput history."
                                                    : "nothing is open."));
    } else {
      barChart(c2.body, { labels: conf.map(function (r) { return r[0] + "%"; }),
        values: conf.map(function (r) { return r[1]; }),
        color: tok("--series-1"), valueLabel: "days" });
      c2.setTable([{ label: "Confidence" }, { label: "Days", num: true },
                   { label: "Date" }],
        conf.map(function (r) { return [r[0] + "%", num(r[1]), r[2]]; }));
    }

    var c3 = card(g, { title: "What is next, as written down",
      note: "Open task briefs first, then open backlog items in priority "
          + "order. This is the forward plan the repository actually holds; "
          + "nothing here is generated or guessed." });
    var rank = { high: 0, medium: 1, low: 2, unrated: 3 };
    var next = S.aging.map(function (a) {
      return [a.id, "task brief", chip(a.status, a.status_raw), a.title,
              "—", plural(a.age, "day", "days") + " open"];
    }).concat(M.backlog.filter(function (b) { return b.status !== "done"; })
      .sort(function (a, b) {
        return (rank[a.priority] === undefined ? 9 : rank[a.priority]) -
               (rank[b.priority] === undefined ? 9 : rank[b.priority]);
      }).map(function (b) {
        return [b.id, "backlog", chip(b.status, b.status_raw), b.title,
                b.priority, b.depends];
      }));
    c3.body.appendChild(table(
      [{ label: "ID" }, { label: "Kind" }, { label: "Status" },
       { label: "Title", cls: "wide" }, { label: "Priority" },
       { label: "Note" }], next, { sortable: true }));
    c3.setTable([{ label: "ID" }, { label: "Kind" }, { label: "Title", cls: "wide" }],
      next.map(function (r) { return [r[0], r[1], r[3]]; }), { sortable: true });
  }

  /* --------------------------------------------------------------- tasks */
  function tabTasks(host) {
    var ft = tasksFiltered();
    lede(host, "Every task brief the generator could parse, with what each "
      + "one records. Sort any column; the filter row above scopes this "
      + "table as well as the charts.");
    var g = newGrid(host);
    var c = card(g, { title: "Task briefs — " + plural(ft.length, "row", "rows"),
      note: "Criteria and validations are ticked-box counts read from the "
          + "brief. They say what the brief claims was verified, not whether "
          + "it was." });
    c.body.appendChild(table(
      [{ label: "ID" }, { label: "Status" }, { label: "Title", cls: "wide" },
       { label: "Sprint" }, { label: "Owner" }, { label: "Created" },
       { label: "Closed" }, { label: "Criteria" }, { label: "Validations" },
       { label: "Commits" }],
      ft.map(function (t) {
        return [t.id, chip(t.status, t.status_raw), t.title, t.sprint, t.owner,
                t.created, t.done || "—",
                t.criteria.checked + " / " + t.criteria.total,
                t.validations.checked + " / " + t.validations.total,
                t.commits.length ? t.commits.map(function (x) {
                  return x.slice(0, 7); }).join(", ") : "—"];
      }), { sortable: true }));
    c.setTable([{ label: "ID" }, { label: "Status" }, { label: "Title", cls: "wide" }],
      ft.map(function (t) { return [t.id, t.status_raw, t.title]; }),
      { sortable: true });

    var c2 = card(g, { span: "half", title: "Briefs by owner",
      note: "Owner as written in the brief's Status block." });
    var byO = {};
    ft.forEach(function (t) { byO[t.owner] = (byO[t.owner] || 0) + 1; });
    var ok = Object.keys(byO).sort(function (a, b) { return byO[b] - byO[a]; });
    barChart(c2.body, { labels: ok, values: ok.map(function (o) { return byO[o]; }),
      color: tok("--series-1"), valueLabel: "briefs", rotate: true });
    c2.setTable([{ label: "Owner" }, { label: "Briefs", num: true }],
      ok.map(function (o) { return [o, num(byO[o])]; }), { sortable: true });

    var c3 = card(g, { span: "half", title: "How completion dates were obtained",
      note: "A commit date is an instant no later edit can move. An Updated "
          + "field is a value a human maintains, and is the weaker source — "
          + "worth knowing when reading every date on this dashboard." });
    var src = {};
    M.tasks.forEach(function (t) {
      if (t.status !== "done") return;
      src[t.done_source || "none"] = (src[t.done_source || "none"] || 0) + 1;
    });
    var labels = { commit: "Commit date", updated: "Updated field",
                   none: "No date at all" };
    var sk = Object.keys(src);
    donut(c3.body, { centerLabel: "closed briefs",
      slices: sk.map(function (s, i) {
        return { label: labels[s] || s, value: src[s],
                 color: s === "commit" ? tok("--series-1")
                      : s === "updated" ? tok("--series-2")
                      : tok("--text-muted") }; }) });
    c3.setTable([{ label: "Source" }, { label: "Briefs", num: true }],
      sk.map(function (s) { return [labels[s] || s, num(src[s])]; }));
  }

  /* ----------------------------------------------------------- decisions */
  function tabDecisions(host) {
    lede(host, "Architecture decisions and review checkpoints — the "
      + "“why” layer. A decision’s date is when it was accepted, not when it "
      + "was first proposed.");
    var g = newGrid(host);
    var c1 = card(g, { span: "twothirds", title: "Decisions accepted over time",
      note: "Cumulative. A flat stretch means the project was executing "
          + "rather than deciding; a step means it hit something that needed "
          + "settling." });
    var ac = clip(S.adr_cum);
    lineChart(c1.body, { height: 240, series: [
      { name: "Decisions", color: tok("--series-1"), area: true,
        points: ac.map(function (r) { return { x: d2n(r.date), y: r.count }; }) }
    ] });
    c1.setTable([{ label: "Date" }, { label: "Cumulative ADRs", num: true }],
      ac.map(function (r) { return [r.date, num(r.count)]; }), { sortable: true });

    var c2 = card(g, { span: "third", title: "Decisions by status",
      note: "A superseded decision is kept, never deleted — that is the "
          + "record working." });
    var st = {};
    M.adrs.forEach(function (a) { st[a.status] = (st[a.status] || 0) + 1; });
    var sk = Object.keys(st).sort(function (a, b) { return st[b] - st[a]; });
    var pal = ["--series-1", "--series-2", "--series-3", "--series-4",
               "--series-5"];
    donut(c2.body, { centerLabel: "decisions",
      slices: sk.map(function (s, i) {
        return { label: s, value: st[s], color: tok(pal[i % pal.length]) }; }) });
    c2.setTable([{ label: "Status" }, { label: "Count", num: true }],
      sk.map(function (s) { return [s, num(st[s])]; }));

    var q = F.q.toLowerCase();
    var c3 = card(g, { span: "half", title: "Architecture decision records",
      note: "Each one records a call that was expensive to reverse." });
    c3.body.appendChild(table(
      [{ label: "ID" }, { label: "Title", cls: "wide" }, { label: "Status" },
       { label: "Date" }],
      M.adrs.filter(function (a) {
        return !q || (a.id + " " + a.title).toLowerCase().indexOf(q) >= 0;
      }).map(function (a) {
        return [a.id, a.title, a.status_raw, a.date]; }), { sortable: true }));
    c3.setTable([{ label: "ID" }, { label: "Title", cls: "wide" }],
      M.adrs.map(function (a) { return [a.id, a.title]; }), { sortable: true });

    var c4 = card(g, { span: "half", title: "Review checkpoints",
      note: "A review is a point-in-time snapshot, written once and not "
          + "edited afterwards." });
    c4.body.appendChild(table(
      [{ label: "ID" }, { label: "Title", cls: "wide" }, { label: "Date" }],
      M.reviews.map(function (r) { return [r.id, r.title, r.date]; }),
      { sortable: true }));
    c4.setTable([{ label: "ID" }, { label: "Date" }],
      M.reviews.map(function (r) { return [r.id, r.date]; }));
  }

  /* ------------------------------------------------------------ activity */
  function tabActivity(host) {
    if (!M.project.git) {
      host.appendChild(h("p", "lede",
        "Git history was not available when this file was generated, so this "
        + "tab is empty. Regenerate from inside the repository, or without "
        + "--no-git, to populate it."));
      return;
    }
    lede(host, "What the repository itself records, independent of what any "
      + "brief claims. A commit is the only artifact here nobody can edit "
      + "after the fact.");
    var g = newGrid(host);
    var c1 = card(g, { title: "Commit activity",
      note: "One cell per day, one hue light to dark. Empty days are kept — "
          + "they are part of the pace." });
    heatmap(c1.body, { counts: S.commit_days, start: S.window.start,
                       end: S.window.end });
    c1.setTable([{ label: "Date" }, { label: "Commits", num: true }],
      Object.keys(S.commit_days).sort().map(function (d) {
        return [d, num(S.commit_days[d])]; }), { sortable: true });

    var c2 = card(g, { span: "half", title: "Contributors",
      note: "Commits and lines changed per author, from the log." });
    barChart(c2.body, { labels: M.project.git ? S.authors.map(function (a) {
        return a.author; }) : [],
      values: S.authors.map(function (a) { return a.commits; }),
      color: tok("--series-1"), valueLabel: "commits", rotate: true });
    c2.setTable([{ label: "Author" }, { label: "Commits", num: true },
                 { label: "Lines added", num: true },
                 { label: "Lines removed", num: true }],
      S.authors.map(function (a) {
        return [a.author, num(a.commits), num(a.added), num(a.removed)]; }),
      { sortable: true });

    var c3 = card(g, { span: "half", title: "Commits linked to a task",
      note: "A commit is linked when its subject line names a task id. "
          + "Unlinked commits are not a defect — merges, fixups and "
          + "documentation land without one." });
    var linked = M.commits.filter(function (c) { return c.task; }).length;
    donut(c3.body, { centerLabel: "commits", slices: [
      { label: "Names a task", value: linked, color: tok("--series-1") },
      { label: "No task named", value: M.commits.length - linked,
        color: tok("--band-todo") }
    ] });
    c3.setTable([{ label: "Linked" }, { label: "Commits", num: true }],
      [["Names a task", num(linked)],
       ["No task named", num(M.commits.length - linked)]]);

    var q = F.q.toLowerCase();
    var c4 = card(g, { title: "Commit log",
      note: "Newest first. Lines added and removed come from git's own "
          + "numstat, not from a diff this file re-computed." });
    c4.body.appendChild(table(
      [{ label: "Date" }, { label: "Hash" }, { label: "Task" },
       { label: "Subject", cls: "wide" }, { label: "Files", num: true },
       { label: "+", num: true }, { label: "−", num: true }],
      M.commits.filter(function (c) {
        return inRange(c.date) &&
          (!q || (c.subject + " " + (c.task || "")).toLowerCase().indexOf(q) >= 0);
      }).map(function (c) {
        return [c.date, c.short, c.task || "—", c.subject, num(c.files),
                num(c.added), num(c.removed)]; }), { sortable: true }));
    c4.setTable([{ label: "Date" }, { label: "Hash" }, { label: "Subject", cls: "wide" }],
      M.commits.map(function (c) { return [c.date, c.short, c.subject]; }),
      { sortable: true });
  }

  /* ============================== shell ================================ */
  var panels = document.getElementById("panels");
  var tabsEl = document.getElementById("tabs");
  var active = TABS[0].id;

  function renderActive() {
    allTables.length = 0;
    while (panels.firstChild) panels.removeChild(panels.firstChild);
    var tab = TABS.filter(function (t) { return t.id === active; })[0];
    var panel = h("div", "panel");
    panel.id = "panel-" + tab.id;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", "tab-" + tab.id);
    panels.appendChild(panel);
    if (M.warnings && M.warnings.length && tab.id === "overview") {
      M.warnings.forEach(function (w) {
        var b = h("div", "warnbox");
        var s = h("strong", null, "Data note: "); b.appendChild(s);
        txt(b, w);
        panel.appendChild(b);
      });
    }
    try {
      tab.build(panel);
    } catch (err) {
      var p = h("p", "empty", "This tab failed to render: " + err.message);
      panel.appendChild(p);
      if (window.console) console.error(err);
    }
    if (showAllTables) {
      allTables.forEach(function (t) {
        t.host.hidden = false;
        t.btn.setAttribute("aria-pressed", "true");
        t.btn.textContent = "Chart only";
      });
    }
  }

  function buildTabs() {
    TABS.forEach(function (t) {
      var b = h("button", null, t.label);
      b.type = "button";
      b.id = "tab-" + t.id;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-controls", "panel-" + t.id);
      b.setAttribute("aria-selected", t.id === active ? "true" : "false");
      b.addEventListener("click", function () {
        active = t.id;
        Array.prototype.forEach.call(tabsEl.children, function (c) {
          c.setAttribute("aria-selected", c === b ? "true" : "false");
        });
        writeHash();
        renderActive();
      });
      tabsEl.appendChild(b);
    });
  }

  /* ------------------------------------------------------------- theme */
  /* auto → light → dark → auto. `auto` follows the OS, and an explicit light
     stamp beats OS-dark (the :not() guard in the CSS).

     THE CHOICE IS PERSISTED TWICE, and the second one is the one that
     matters. Chrome and Firefox treat a file:// page as an opaque origin and
     THROW on localStorage — which is precisely how this file is meant to be
     opened, by double-click. So the mode is also written into the URL hash
     beside the tab, which survives a reload from any origin. localStorage is
     still used where it works, so the choice carries across URLs too.
     Measured under jsdom at a file:// URL: localStorage raised a
     DOMException and the hash round-tripped. */
  var THEMES = ["auto", "light", "dark"];
  var themeBtn = document.getElementById("theme-btn");

  function writeHash() {
    var mode = document.documentElement.getAttribute("data-theme") || "auto";
    try {
      location.replace("#" + active + (mode === "auto" ? "" : "&theme=" + mode));
    } catch (e) { location.hash = active; }
  }

  function applyTheme(mode) {
    document.documentElement.setAttribute("data-theme", mode);
    themeBtn.textContent = "Theme: " + mode;
    try { localStorage.setItem("ai-dashboard-theme", mode); } catch (e) {}
    writeHash();
    dropTokens();
    renderActive();
  }
  themeBtn.addEventListener("click", function () {
    var cur = document.documentElement.getAttribute("data-theme") || "auto";
    applyTheme(THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length]);
  });
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    var onMq = function () {
      if ((document.documentElement.getAttribute("data-theme") || "auto") === "auto") {
        dropTokens();
        renderActive();
      }
    };
    if (mq.addEventListener) mq.addEventListener("change", onMq);
    else if (mq.addListener) mq.addListener(onMq);
  }

  /* ----------------------------------------------------------- controls */
  var showAllTables = false;
  var tablesBtn = document.getElementById("tables-btn");
  tablesBtn.addEventListener("click", function () {
    showAllTables = !showAllTables;
    tablesBtn.setAttribute("aria-pressed", showAllTables ? "true" : "false");
    tablesBtn.textContent = showAllTables ? "Hide all tables" : "Show all tables";
    renderActive();
  });
  document.getElementById("print-btn").addEventListener("click", function () {
    window.print();
  });

  var fRange = document.getElementById("f-range");
  var fSprint = document.getElementById("f-sprint");
  var fStatus = document.getElementById("f-status");
  var fSearch = document.getElementById("f-search");
  var fScope = document.getElementById("f-scope");

  S.sprints.forEach(function (s) {
    var o = document.createElement("option");
    o.value = s.id; o.textContent = s.id + " — " + s.tasks + " tasks";
    fSprint.appendChild(o);
  });
  ["done", "doing", "blocked", "todo", "cancelled"].forEach(function (b) {
    if (!M.tasks.some(function (t) { return t.status === b; })) return;
    var o = document.createElement("option");
    o.value = b; o.textContent = S.band_label[b] || b;
    fStatus.appendChild(o);
  });

  function scopeText() {
    var ft = tasksFiltered();
    var bits = [plural(ft.length, "task", "tasks") + " in scope"];
    if (F.range !== "all") bits.push("last " + F.range + " days");
    if (F.sprint) bits.push(F.sprint);
    if (F.status) bits.push(S.band_label[F.status] || F.status);
    if (F.q) bits.push('"' + F.q + '"');
    if (filtersActive()) {
      bits.push("cumulative timelines still show the whole project");
    }
    fScope.textContent = bits.join(" · ");
  }
  function onFilter() {
    F.range = fRange.value; F.sprint = fSprint.value;
    F.status = fStatus.value; F.q = fSearch.value.trim();
    scopeText();
    renderActive();
  }
  [fRange, fSprint, fStatus].forEach(function (el) {
    el.addEventListener("change", onFilter);
  });
  var debounce;
  fSearch.addEventListener("input", function () {
    clearTimeout(debounce);
    debounce = setTimeout(onFilter, 220);
  });
  document.getElementById("f-reset").addEventListener("click", function () {
    fRange.value = "all"; fSprint.value = ""; fStatus.value = "";
    fSearch.value = ""; onFilter();
  });

  /* Re-render on resize: the SVGs are laid out in pixels against the measured
     container, which is what keeps axis labels from colliding at any width. */
  var rs;
  window.addEventListener("resize", function () {
    clearTimeout(rs);
    rs = setTimeout(renderActive, 180);
  });

  /* -------------------------------------------------------------- boot */
  var p = M.project;
  document.getElementById("proj-name").textContent =
    p.name + " — delivery dashboard";
  var sub = document.getElementById("proj-sub");
  sub.textContent = "";
  txt(sub, S.kpi.tasks + " task briefs · " + S.kpi.sprints + " sprints · "
       + S.kpi.adrs + " decisions · " + S.kpi.backlog_total + " backlog items"
       + " · " + p.framework + " layout at " + p.root
       + " · generated " + p.generated);
  document.getElementById("foot").textContent =
    "Generated from " + p.root + " by skills/project-workflow. Every figure is "
    + "read from the artifacts on disk at generation time — this renders the "
    + "governance layer, it does not audit it. Regenerate rather than editing "
    + "this file.";

  var hash = (location.hash || "").replace("#", "");
  var parts = hash.split("&");
  if (TABS.some(function (t) { return t.id === parts[0]; })) active = parts[0];

  /* Hash first, storage second: the hash is what a file:// reload keeps. */
  var saved = null;
  for (var hi = 1; hi < parts.length; hi++) {
    if (parts[hi].indexOf("theme=") === 0) saved = parts[hi].slice(6);
  }
  if (!saved) {
    try { saved = localStorage.getItem("ai-dashboard-theme"); } catch (e) {}
  }
  if (saved && THEMES.indexOf(saved) >= 0) {
    document.documentElement.setAttribute("data-theme", saved);
  }
  themeBtn.textContent =
    "Theme: " + (document.documentElement.getAttribute("data-theme") || "auto");

  buildTabs();
  scopeText();
  renderActive();
}());
