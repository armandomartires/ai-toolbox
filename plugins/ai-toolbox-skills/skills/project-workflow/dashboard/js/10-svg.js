/* ==========================================================================
   10-svg.js — PM.svg: the chart primitive layer.

   Every chart in this dashboard is hand-rolled SVG. There is no charting
   library, and that is a deliberate constraint, not a limitation worked
   around: the generated HTML has to open from file:// on a machine with no
   network, and a CDN <script> makes the whole dashboard fail closed in
   exactly the situation it is most useful (an offline review of where the
   project stands).

   The contract is in SCHEMA.md §5.3. A chart module calls `PM.svg.chart()`,
   chains marks onto the handle, and calls `.done()`. It never writes an
   attribute this file could own, and it never names a colour — series colours
   come from the `pm-s1..pm-s8` / `pm-a1..pm-a8` classes that
   css/30-charts.css binds to theme tokens.
   ========================================================================== */

window.PM = window.PM || {};

(function () {
  "use strict";

  var U = PM.util;
  var el = U.el;

  var DEFAULT_MARGIN = { t: 14, r: 16, b: 34, l: 48 };
  var MIN_WIDTH = 240;

  /* ----------------------------------------------------------------------
     Scales. Three kinds, one shared shape: a function from datum to pixel,
     carrying `.domain`, `.range` and (for band) `.step` / `.bandwidth`.
     ---------------------------------------------------------------------- */

  function timeScale(domain, range) {
    var a = U.d.parse(domain[0]), b = U.d.parse(domain[1]);
    var t0 = a ? a.getTime() : 0;
    var t1 = b ? b.getTime() : t0 + U.DAY_MS;
    if (t1 === t0) t1 = t0 + U.DAY_MS;              // a single-day window
    var span = t1 - t0;
    var scale = function (value) {
      var d = U.d.parse(value);
      if (!d) return null;
      return range[0] + ((d.getTime() - t0) / span) * (range[1] - range[0]);
    };
    scale.kind = "time";
    scale.domain = [new Date(t0), new Date(t1)];
    scale.range = range;
    scale.invert = function (px) {
      var f = (px - range[0]) / (range[1] - range[0]);
      return new Date(t0 + f * span);
    };
    scale.ticks = function (count) {
      var out = [], steps = Math.max(1, count || 6);
      for (var i = 0; i <= steps; i++) {
        out.push(new Date(t0 + (span * i) / steps));
      }
      return out;
    };
    return scale;
  }

  function linearScale(domain, range) {
    var d0 = domain[0], d1 = domain[1];
    if (d1 === d0) d1 = d0 + 1;
    var scale = function (value) {
      if (value == null || !isFinite(value)) return null;
      return range[0] + ((value - d0) / (d1 - d0)) * (range[1] - range[0]);
    };
    scale.kind = "linear";
    scale.domain = [d0, d1];
    scale.range = range;
    scale.invert = function (px) {
      return d0 + ((px - range[0]) / (range[1] - range[0])) * (d1 - d0);
    };
    scale.ticks = function (count) {
      var steps = Math.max(1, count || 5), out = [];
      for (var i = 0; i <= steps; i++) out.push(d0 + ((d1 - d0) * i) / steps);
      return out;
    };
    return scale;
  }

  function bandScale(domain, range, padding) {
    var pad = padding == null ? 0.2 : padding;
    var count = Math.max(1, domain.length);
    var step = (range[1] - range[0]) / count;
    var bandwidth = Math.max(1, step * (1 - pad));
    var index = {};
    domain.forEach(function (key, i) { index[String(key)] = i; });

    var scale = function (value) {
      var i = index[String(value)];
      if (i == null) return null;
      return range[0] + i * step + (step - bandwidth) / 2;
    };
    scale.kind = "band";
    scale.domain = domain;
    scale.range = range;
    scale.step = step;
    scale.bandwidth = bandwidth;
    scale.center = function (value) {
      var x = scale(value);
      return x == null ? null : x + bandwidth / 2;
    };
    scale.ticks = function (count) {
      if (!count || domain.length <= count) return domain.slice();
      var every = Math.ceil(domain.length / count), out = [];
      for (var i = 0; i < domain.length; i += every) out.push(domain[i]);
      if (out[out.length - 1] !== domain[domain.length - 1]) {
        out.push(domain[domain.length - 1]);
      }
      return out;
    };
    return scale;
  }

  /* Round a linear domain out to a readable top. Without this, a max of 118
     produces axis labels like 23.6, 47.2, 70.8. */
  function niceMax(value) {
    if (value == null || !isFinite(value) || value <= 0) return 1;
    var mag = Math.pow(10, Math.floor(Math.log10(value)));
    var norm = value / mag;
    var step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
    return step * mag;
  }

  function makeScale(type, domain, range, padding) {
    if (type === "time") return timeScale(domain, range);
    if (type === "band") return bandScale(domain, range, padding);
    return linearScale(domain, range);
  }

  /* ----------------------------------------------------------------------
     The shared tooltip. One element for the whole page (`#pm-tooltip`), so
     eleven tabs cannot leave eleven orphaned tooltips behind.
     ---------------------------------------------------------------------- */

  function tipNode() {
    return document.getElementById("pm-tooltip");
  }

  function showTip(lines, clientX, clientY) {
    var tip = tipNode();
    if (!tip) return;
    U.clear(tip);
    var list = Array.isArray(lines) ? lines : [lines];
    list.forEach(function (line, i) {
      if (line == null) return;
      if (line instanceof Node) { tip.appendChild(line); return; }
      tip.appendChild(el("div", {
        class: i === 0 ? "pm-tip-head" : "pm-tip-row",
        text: String(line)
      }));
    });
    tip.hidden = false;

    /* Place it clear of the cursor, flipping before it leaves the viewport. */
    var box = tip.getBoundingClientRect();
    var pad = 12;
    var x = clientX + pad;
    var y = clientY + pad;
    if (x + box.width > window.innerWidth - 8) x = clientX - box.width - pad;
    if (y + box.height > window.innerHeight - 8) y = clientY - box.height - pad;
    tip.style.left = Math.max(8, x) + "px";
    tip.style.top = Math.max(8, y) + "px";
  }

  function hideTip() {
    var tip = tipNode();
    if (tip) { tip.hidden = true; U.clear(tip); }
  }

  /* Attach a tooltip to any node — used by the heatmap, the DAG and the
     Gantt bars, which draw their own geometry rather than using a chart. */
  function bindTip(node, lines) {
    node.addEventListener("mousemove", function (ev) {
      showTip(typeof lines === "function" ? lines() : lines, ev.clientX, ev.clientY);
    });
    node.addEventListener("mouseleave", hideTip);
    /* Keyboard and touch parity: focus shows the same text. */
    if (node.tagName !== "text") {
      node.setAttribute("tabindex", "0");
      node.addEventListener("focus", function () {
        var r = node.getBoundingClientRect();
        showTip(typeof lines === "function" ? lines() : lines, r.left + r.width / 2, r.top);
      });
      node.addEventListener("blur", hideTip);
    }
    return node;
  }

  /* ----------------------------------------------------------------------
     A bare responsive <svg> with a translated plot group, for charts that
     draw their own layout (calendar heatmap, dependency graph, Gantt).
     ---------------------------------------------------------------------- */

  function raw(host, opts) {
    var options = opts || {};
    var width = Math.max(MIN_WIDTH, options.width || hostWidth(host));
    var height = options.height || 240;
    var svg = el("svg", {
      class: "pm-svg" + (options.cls ? " " + options.cls : ""),
      viewBox: "0 0 " + width + " " + height,
      width: "100%",
      height: height,
      preserveAspectRatio: "xMinYMin meet",
      role: "img",
      "aria-label": options.label || ""
    });
    var g = el("g", options.translate
      ? { transform: "translate(" + options.translate[0] + "," + options.translate[1] + ")" }
      : null);
    svg.appendChild(g);
    if (host) host.appendChild(svg);
    return { svg: svg, g: g, width: width, height: height };
  }

  function hostWidth(host) {
    if (!host) return 720;
    var w = host.clientWidth || (host.parentNode && host.parentNode.clientWidth) || 0;
    return w > MIN_WIDTH ? w : 720;
  }

  /* ----------------------------------------------------------------------
     PM.svg.chart — the workhorse.
     ---------------------------------------------------------------------- */

  function chart(host, opts) {
    var options = opts || {};
    var margin = Object.assign({}, DEFAULT_MARGIN, options.margin || {});
    var width = Math.max(MIN_WIDTH, options.width || hostWidth(host));
    var height = options.height || 260;
    var iw = Math.max(20, width - margin.l - margin.r);
    var ih = Math.max(20, height - margin.t - margin.b);

    var svg = el("svg", {
      class: "pm-svg pm-chart" + (options.cls ? " " + options.cls : ""),
      viewBox: "0 0 " + width + " " + height,
      width: "100%",
      height: height,
      preserveAspectRatio: "xMinYMin meet",
      role: "img",
      "aria-label": options.label || options.title || "chart"
    });
    var plot = el("g", { transform: "translate(" + margin.l + "," + margin.t + ")" });
    svg.appendChild(plot);

    var gGrid = el("g", { class: "pm-grid-g" });
    var gMarks = el("g", { class: "pm-marks" });
    var gRef = el("g", { class: "pm-refs" });
    var gAxes = el("g", { class: "pm-axes" });
    var gHover = el("g", { class: "pm-hover" });
    [gGrid, gMarks, gRef, gAxes, gHover].forEach(function (g) { plot.appendChild(g); });

    var xOpts = options.x || {};
    var yOpts = options.y || {};
    var yDomain = yOpts.domain || [0, 1];
    if (yOpts.nice !== false && yOpts.domain) {
      yDomain = [yDomain[0], niceMax(yDomain[1])];
    }

    var sx = makeScale(options.xType || "linear", xOpts.domain || [0, 1],
                       [0, iw], xOpts.padding);
    var sy = makeScale(options.yType || "linear", yDomain, [ih, 0]);

    var handle = {
      svg: svg, plot: plot, marks: gMarks, refs: gRef, width: width, height: height,
      iw: iw, ih: ih, margin: margin, sx: sx, sy: sy
    };

    function px(accessor, scale, datum, index) {
      var value = typeof accessor === "function" ? accessor(datum, index) : accessor;
      if (scale.kind === "band") {
        var c = scale.center(value);
        return c;
      }
      return scale(value);
    }

    /* --- axes ---------------------------------------------------------- */

    handle.xAxis = function (o) {
      var cfg = o || {};
      var ticks = sx.ticks(cfg.ticks || (sx.kind === "band" ? 8 : 6));
      var axis = el("g", { class: "pm-axis pm-axis-x", transform: "translate(0," + ih + ")" });
      axis.appendChild(el("line", { class: "pm-axis-line", x1: 0, y1: 0, x2: iw, y2: 0 }));
      ticks.forEach(function (t) {
        var x = sx.kind === "band" ? sx.center(t) : sx(t);
        if (x == null) return;
        var label = cfg.format ? cfg.format(t) : String(t);
        axis.appendChild(el("line", { class: "pm-tick", x1: x, y1: 0, x2: x, y2: 4 }));
        axis.appendChild(el("text", {
          class: "pm-axis-label", x: x, y: 16,
          "text-anchor": cfg.anchor || "middle", text: label
        }));
        if (cfg.grid) {
          gGrid.appendChild(el("line", { class: "pm-gridline", x1: x, y1: -ih, x2: x, y2: 0 }));
        }
      });
      gAxes.appendChild(axis);
      if (cfg.title) {
        gAxes.appendChild(el("text", {
          class: "pm-axis-title", x: iw / 2, y: ih + margin.b - 2,
          "text-anchor": "middle", text: cfg.title
        }));
      }
      return handle;
    };

    handle.yAxis = function (o) {
      var cfg = o || {};
      var ticks = sy.ticks(cfg.ticks || 5);
      var axis = el("g", { class: "pm-axis pm-axis-y" });
      ticks.forEach(function (t) {
        var y = sy(t);
        if (y == null) return;
        var label = cfg.format ? cfg.format(t) : U.fmt.n(t, cfg.decimals || 0);
        axis.appendChild(el("text", {
          class: "pm-axis-label", x: -8, y: y + 4, "text-anchor": "end", text: label
        }));
        if (cfg.grid !== false) {
          gGrid.appendChild(el("line", { class: "pm-gridline", x1: 0, y1: y, x2: iw, y2: y }));
        }
      });
      gAxes.appendChild(axis);
      if (cfg.title) {
        gAxes.appendChild(el("text", {
          class: "pm-axis-title", transform: "rotate(-90)",
          x: -ih / 2, y: -margin.l + 12, "text-anchor": "middle", text: cfg.title
        }));
      }
      return handle;
    };

    /* --- marks --------------------------------------------------------- */

    function pathFrom(points, xAcc, yAcc, opts2) {
      var cfg = opts2 || {};
      var parts = [], started = false;
      points.forEach(function (p, i) {
        var x = px(xAcc, sx, p, i);
        var y = sy(typeof yAcc === "function" ? yAcc(p, i) : yAcc);
        if (x == null || y == null || !isFinite(x) || !isFinite(y)) { started = false; return; }
        if (!started) { parts.push("M" + x + "," + y); started = true; }
        else if (cfg.step) { parts.push("H" + x); parts.push("V" + y); }
        else { parts.push("L" + x + "," + y); }
      });
      return parts.join(" ");
    }

    handle.line = function (points, o) {
      var cfg = o || {};
      if (!points || !points.length) return handle;
      gMarks.appendChild(el("path", {
        class: "pm-line " + (cfg.cls || "pm-s1") + (cfg.dashed ? " is-dashed" : ""),
        d: pathFrom(points, cfg.x, cfg.y, cfg),
        "stroke-width": cfg.width || 2,
        fill: "none"
      }));
      return handle;
    };

    handle.area = function (points, o) {
      var cfg = o || {};
      if (!points || !points.length) return handle;
      var top = [], bottom = [];
      points.forEach(function (p, i) {
        var x = px(cfg.x, sx, p, i);
        var y1 = sy(typeof cfg.y1 === "function" ? cfg.y1(p, i) : cfg.y1);
        var y0 = sy(typeof cfg.y0 === "function" ? cfg.y0(p, i) : (cfg.y0 == null ? 0 : cfg.y0));
        if (x == null || y1 == null || y0 == null) return;
        top.push(x + "," + y1);
        bottom.unshift(x + "," + y0);
      });
      if (!top.length) return handle;
      gMarks.appendChild(el("path", {
        class: "pm-area " + (cfg.cls || "pm-a1"),
        d: "M" + top.join(" L") + " L" + bottom.join(" L") + " Z"
      }));
      if (cfg.stroke) {
        gMarks.appendChild(el("path", {
          class: "pm-line " + (cfg.stroke === true ? (cfg.cls || "pm-s1") : cfg.stroke),
          d: pathFrom(points, cfg.x, cfg.y1, cfg), "stroke-width": 1.75, fill: "none"
        }));
      }
      return handle;
    };

    /* Stacked areas, bottom-to-top in `keys` order. `value(p, key)` defaults
       to `p[key]`, so a payload shaped `{types: {...}}` supplies its own. */
    handle.stack = function (points, o) {
      var cfg = o || {};
      if (!points || !points.length || !cfg.keys || !cfg.keys.length) return handle;
      var value = cfg.value || function (p, k) { return p[k] || 0; };
      var base = points.map(function () { return 0; });

      cfg.keys.forEach(function (key, ki) {
        var top = [], bottom = [];
        points.forEach(function (p, i) {
          var x = px(cfg.x, sx, p, i);
          var lo = base[i];
          var hi = lo + (value(p, key) || 0);
          base[i] = hi;
          if (x == null) return;
          top.push(x + "," + sy(hi));
          bottom.unshift(x + "," + sy(lo));
        });
        if (!top.length) return;
        gMarks.appendChild(el("path", {
          class: "pm-area " + (typeof cfg.cls === "function" ? cfg.cls(key, ki) : "pm-a" + ((ki % 8) + 1)),
          d: "M" + top.join(" L") + " L" + bottom.join(" L") + " Z",
          "data-key": key
        }));
      });
      return handle;
    };

    /* Bars. With `keys`, renders a grouped set; without, a single series. */
    handle.bars = function (points, o) {
      var cfg = o || {};
      if (!points || !points.length) return handle;
      var zero = sy(0);
      var keys = cfg.keys || [null];
      var value = cfg.value || function (p, k) {
        return k == null ? (typeof cfg.y === "function" ? cfg.y(p) : p[cfg.y]) : p[k];
      };
      var slot = sx.kind === "band" ? sx.bandwidth / keys.length : 8;

      points.forEach(function (p, i) {
        var left = sx.kind === "band" ? sx(cfg.x ? cfg.x(p) : p) : px(cfg.x, sx, p, i) - slot / 2;
        if (left == null) return;
        keys.forEach(function (key, ki) {
          var v = value(p, key);
          if (v == null || !isFinite(v)) return;
          var y = sy(v);
          if (y == null) return;
          var top = Math.min(y, zero), h = Math.max(1, Math.abs(zero - y));
          var rect = el("rect", {
            class: "pm-bar " + (typeof cfg.cls === "function" ? cfg.cls(key, ki, p) : (cfg.cls || "pm-a1")),
            x: left + ki * slot, y: top,
            width: Math.max(1, slot - (cfg.inset == null ? 1 : cfg.inset)),
            height: h,
            rx: cfg.round === false ? 0 : 2
          });
          if (cfg.label) bindTip(rect, cfg.label(p, key));
          gMarks.appendChild(rect);
        });
      });
      return handle;
    };

    /* Stacked bars — the shape the log-type mix and scope-churn charts need. */
    handle.stackedBars = function (points, o) {
      var cfg = o || {};
      if (!points || !points.length || !cfg.keys) return handle;
      var value = cfg.value || function (p, k) { return p[k] || 0; };
      points.forEach(function (p) {
        var left = sx.kind === "band" ? sx(cfg.x(p)) : px(cfg.x, sx, p) - 4;
        if (left == null) return;
        var w = sx.kind === "band" ? sx.bandwidth : 8;
        var acc = 0;
        cfg.keys.forEach(function (key, ki) {
          var v = value(p, key) || 0;
          if (!v) return;
          var y1 = sy(acc + v), y0 = sy(acc);
          acc += v;
          var rect = el("rect", {
            class: "pm-bar " + (typeof cfg.cls === "function" ? cfg.cls(key, ki) : "pm-a" + ((ki % 8) + 1)),
            x: left, y: y1, width: Math.max(1, w), height: Math.max(0.5, y0 - y1),
            "data-key": key
          });
          if (cfg.label) bindTip(rect, cfg.label(p, key, v));
          gMarks.appendChild(rect);
        });
      });
      return handle;
    };

    handle.dots = function (points, o) {
      var cfg = o || {};
      if (!points || !points.length) return handle;
      points.forEach(function (p, i) {
        var x = px(cfg.x, sx, p, i);
        var y = sy(typeof cfg.y === "function" ? cfg.y(p, i) : p[cfg.y]);
        if (x == null || y == null || !isFinite(x) || !isFinite(y)) return;
        var dot = el("circle", {
          class: "pm-dot " + (typeof cfg.cls === "function" ? cfg.cls(p, i) : (cfg.cls || "pm-s1")),
          cx: x, cy: y, r: typeof cfg.r === "function" ? cfg.r(p, i) : (cfg.r || 3)
        });
        if (cfg.label) bindTip(dot, cfg.label(p, i));
        gMarks.appendChild(dot);
      });
      return handle;
    };

    /* --- reference lines ------------------------------------------------ */

    handle.hLine = function (value, o) {
      var cfg = o || {};
      var y = sy(value);
      if (y == null || !isFinite(y)) return handle;
      gRef.appendChild(el("line", {
        class: "pm-refline " + (cfg.cls || "pm-ref"), x1: 0, y1: y, x2: iw, y2: y
      }));
      if (cfg.label) {
        gRef.appendChild(el("text", {
          class: "pm-reflabel", x: iw - 4, y: y - 5, "text-anchor": "end", text: cfg.label
        }));
      }
      return handle;
    };

    handle.vLine = function (value, o) {
      var cfg = o || {};
      var x = sx.kind === "band" ? sx.center(value) : sx(value);
      if (x == null || !isFinite(x)) return handle;
      gRef.appendChild(el("line", {
        class: "pm-refline " + (cfg.cls || "pm-ref"), x1: x, y1: 0, x2: x, y2: ih
      }));
      if (cfg.label) {
        gRef.appendChild(el("text", {
          class: "pm-reflabel", x: x - 4, y: 10, "text-anchor": "end", text: cfg.label
        }));
      }
      return handle;
    };

    /* A shaded x-band, for "forecast region" and "sprint window". */
    handle.xBand = function (from, to, o) {
      var cfg = o || {};
      var x1 = sx.kind === "band" ? sx(from) : sx(from);
      var x2 = sx.kind === "band" ? sx(to) + sx.bandwidth : sx(to);
      if (x1 == null || x2 == null) return handle;
      gGrid.appendChild(el("rect", {
        class: "pm-xband " + (cfg.cls || ""), x: Math.min(x1, x2), y: 0,
        width: Math.abs(x2 - x1), height: ih
      }));
      if (cfg.label) {
        gRef.appendChild(el("text", {
          class: "pm-reflabel", x: Math.min(x1, x2) + 5, y: 12, text: cfg.label
        }));
      }
      return handle;
    };

    /* --- hover --------------------------------------------------------- */

    /* A full-plot overlay that finds the nearest point by x and reports it.
       One overlay beats per-mark listeners: it still works in the gaps
       between points, which is where a reader's cursor actually lands. */
    handle.hover = function (points, o) {
      var cfg = o || {};
      if (!points || !points.length) return handle;
      var focusLine = el("line", { class: "pm-focus-line", x1: 0, y1: 0, x2: 0, y2: ih, opacity: 0 });
      var focusDot = el("circle", { class: "pm-focus-dot", r: 4, opacity: 0 });
      gHover.appendChild(focusLine);
      gHover.appendChild(focusDot);

      var positions = points.map(function (p, i) {
        return { p: p, i: i, x: px(cfg.x, sx, p, i) };
      }).filter(function (q) { return q.x != null && isFinite(q.x); });
      if (!positions.length) return handle;

      var overlay = el("rect", {
        class: "pm-overlay", x: 0, y: 0, width: iw, height: ih, fill: "transparent"
      });

      function locate(ev) {
        var box = handle.svg.getBoundingClientRect();
        var scale = box.width ? width / box.width : 1;
        var mx = (ev.clientX - box.left) * scale - margin.l;
        var best = positions[0];
        for (var i = 1; i < positions.length; i++) {
          if (Math.abs(positions[i].x - mx) < Math.abs(best.x - mx)) best = positions[i];
        }
        return best;
      }

      overlay.addEventListener("mousemove", function (ev) {
        var best = locate(ev);
        focusLine.setAttribute("x1", best.x);
        focusLine.setAttribute("x2", best.x);
        focusLine.setAttribute("opacity", 1);
        if (cfg.y) {
          var y = sy(cfg.y(best.p, best.i));
          if (y != null && isFinite(y)) {
            focusDot.setAttribute("cx", best.x);
            focusDot.setAttribute("cy", y);
            focusDot.setAttribute("opacity", 1);
          }
        }
        showTip(cfg.label(best.p, best.i), ev.clientX, ev.clientY);
      });
      overlay.addEventListener("mouseleave", function () {
        focusLine.setAttribute("opacity", 0);
        focusDot.setAttribute("opacity", 0);
        hideTip();
      });
      gHover.appendChild(overlay);
      return handle;
    };

    /* --- legend (inside the card, below the svg) ------------------------ */

    handle.legend = function (items) {
      handle._legend = items;
      return handle;
    };

    handle.done = function () {
      if (host) {
        host.appendChild(svg);
        if (handle._legend) host.appendChild(legend(handle._legend));
      }
      return svg;
    };

    return handle;
  }

  /* A standalone legend, usable with or without a chart handle. */
  function legend(items) {
    return el("ul", { class: "pm-legend" }, (items || []).map(function (item) {
      return el("li", { class: "pm-legend-item" }, [
        el("span", { class: "pm-legend-swatch " + (item.cls || "pm-a1") }),
        el("span", { class: "pm-legend-label", text: item.label }),
        item.value != null ? el("span", { class: "pm-legend-value", text: String(item.value) }) : null
      ]);
    }));
  }

  /* A compact inline sparkline for KPI tiles and table cells. */
  function sparkline(values, o) {
    var cfg = o || {};
    var w = cfg.width || 80, h = cfg.height || 22;
    var vals = (values || []).filter(function (v) { return v != null && isFinite(v); });
    if (vals.length < 2) return el("span", { class: "pm-spark is-empty" });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    var span = max - min || 1;
    var pts = vals.map(function (v, i) {
      return (i / (vals.length - 1)) * w + "," + (h - 2 - ((v - min) / span) * (h - 4));
    });
    var svg = el("svg", {
      class: "pm-spark", viewBox: "0 0 " + w + " " + h, width: w, height: h,
      role: "img", "aria-label": cfg.label || "trend"
    }, el("polyline", {
      class: "pm-line " + (cfg.cls || "pm-s1"), points: pts.join(" "),
      fill: "none", "stroke-width": 1.5
    }));
    return svg;
  }

  PM.svg = {
    chart: chart,
    raw: raw,
    legend: legend,
    sparkline: sparkline,
    scale: makeScale,
    niceMax: niceMax,
    showTip: showTip,
    hideTip: hideTip,
    bindTip: bindTip,
    hostWidth: hostWidth
  };
})();
