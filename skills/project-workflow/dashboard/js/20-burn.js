/* ==========================================================================
   20-burn.js — PM.views.burn: the burn charts tab.

   Four views of the same two numbers (scope, closed) plus the raw periods
   underneath them. Everything drawn here comes from the pre-aggregated
   `metrics.*` series of SCHEMA.md §2 — this file never re-derives a
   statistic from `tasks[]`, with one deliberate exception: it counts how
   many of the task dates beneath a series are lower bounds rather than
   observations. A burn chart that cannot say that is exactly the
   confidently-wrong artefact SCHEMA.md §0 exists to prevent.

   Every quantity on this tab is counted in `units.primary`, which is "tasks"
   for this corpus: there are no estimates and no sprint commitments, so
   nothing here may be labelled "points" unless the payload says coverage is
   complete.
   ========================================================================== */

window.PM = window.PM || {};
PM.views = PM.views || {};

(function () {
  "use strict";

  var U = PM.util;
  var el = U.el;

  /* A date from either of these sources is granular to a whole sprint, or is
     whatever the filesystem last happened to write — a lower bound, never an
     observation. Same test as `*_floored`. SCHEMA.md §1.2. */
  var WEAK_SOURCES = { roadmap_sprint: 1, file_mtime: 1 };

  /* Bottom-to-top, and fixed by SCHEMA.md §2.3: any other order would stack
     open work underneath closed work and invert how a CFD reads. */
  var CFD_KEYS = ["done", "in_progress", "blocked", "not_started"];
  var CFD_CLS = {
    done: "pm-a2", in_progress: "pm-a1", blocked: "pm-a6", not_started: "pm-a7"
  };
  var CFD_LABEL = {
    done: "Done", in_progress: "In progress", blocked: "Blocked",
    not_started: "Not started"
  };

  /* The forecast cone keeps one class per percentile across both charts, so
     "the dashed violet line" means p50 whether the reader is looking at the
     burn-up or the burn-down. */
  var CONE_KEYS = ["p50", "p85", "p95"];
  var CONE_CLS = { p50: "pm-s3", p85: "pm-s5", p95: "pm-s8" };

  /* The generator aggregates before the front end sees a series, so a chart
     on this tab cannot honour the header filters. Saying so beats silently
     showing whole-project bars next to a filtered list somewhere else. */
  var FILTER_NOTE = "This chart shows the whole project; the sprint and lane " +
    "filters apply to task lists only.";
  var FILTER_NOTE_TABLE = "These periods cover the whole project; the sprint " +
    "and lane filters apply to task lists only.";

  var CHART_H = 320;
  var CHART_H_SMALL = 280;

  /* ----------------------------------------------------------------------
     Small readers. Every one of them assumes the payload may be missing the
     field entirely, because a series the generator could not compute is
     absent or `[]` rather than zero-filled.
     ---------------------------------------------------------------------- */

  function num(value) {
    return (value == null || !isFinite(value)) ? 0 : Number(value);
  }

  function arr(value) {
    return (value && value.length) ? value : [];
  }

  function lastOf(list) {
    return (list && list.length) ? list[list.length - 1] : null;
  }

  function xOfDate(p) { return p.date; }
  function vOf(p) { return p.v; }

  function latestDate(values) {
    var best = null;
    for (var i = 0; i < values.length; i++) {
      var d = U.d.parse(values[i]);
      if (d && (best == null || d.getTime() > best.getTime())) best = d;
    }
    return best;
  }

  /* SCHEMA.md §1.1 allows every date to be `null`, so a series bound may not
     be its first or last point. Taking the extremes over the whole series
     keeps a null-dated period from collapsing a time axis onto 1970. */
  function earliestDate(values) {
    var best = null;
    for (var i = 0; i < values.length; i++) {
      var d = U.d.parse(values[i]);
      if (d && (best == null || d.getTime() < best.getTime())) best = d;
    }
    return best;
  }

  function datesOf(points) {
    return points.map(function (p) { return p.date; });
  }

  function withinDomain(value, from, to) {
    var d = U.d.parse(value), a = U.d.parse(from), b = U.d.parse(to);
    if (!d || !a || !b) return false;
    return d.getTime() >= a.getTime() && d.getTime() <= b.getTime();
  }

  /* PM.svg's own niceMax() takes a max of 118 up to 200, which spends half
     the plot on empty air. This picks a whole-task step instead and returns
     the tick count that lands a label on every step, because the two cannot
     be chosen independently: a fixed five ticks across a top of 6 puts
     gridlines at 1.2, 2.4, 3.6, 4.8 and labels them 1, 2, 4, 5. Fractional
     tasks do not exist, so the step is forced to a whole number and the tick
     count follows it. `min` is floored to the same step so the churn chart's
     negative net keeps whole-task gridlines too. */
  function axisScale(min, max, want) {
    var t = want || 5;
    var hi = (max == null || !isFinite(max)) ? 0 : Number(max);
    var lo = (min == null || !isFinite(min)) ? 0 : Math.min(0, Number(min));
    if (hi <= lo) hi = lo + t;
    var rough = (hi - lo) / t;
    var mag = Math.pow(10, Math.floor(Math.log10(rough)));
    var norm = rough / mag;
    var step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
    step = Math.max(1, Math.ceil(step - 1e-9));
    var top = Math.ceil(hi / step) * step;
    var bottom = Math.floor(lo / step) * step;
    if (top === bottom) top = bottom + step;
    return {
      lo: bottom, hi: top,
      ticks: Math.max(1, Math.round((top - bottom) / step))
    };
  }

  function periodHead(date, gran) {
    var text = U.fmt.dateLong(date);
    return gran === "week" ? "Week of " + text : text;
  }

  function signed(value) {
    if (value == null || !isFinite(value)) return "—";
    return (value > 0 ? "+" : "") + U.fmt.n(value);
  }

  /* ----------------------------------------------------------------------
     Date honesty. Two shapes: a whole-series count for the note under a
     chart, and a per-period count for the ≈ marker in the table.
     ---------------------------------------------------------------------- */

  function dateAudit(tasks, field) {
    var out = { total: 0, approx: 0 };
    for (var i = 0; i < tasks.length; i++) {
      var t = tasks[i] || {};
      if (!t[field]) continue;
      out.total++;
      if (t[field + "_floored"] || WEAK_SOURCES[t[field + "_source"]]) out.approx++;
    }
    return out;
  }

  function approxNote(audit, what) {
    if (!audit.total) return null;
    if (!audit.approx) {
      return U.note("All " + U.fmt.n(audit.total) + " " + what + " behind this " +
        "series are hand-recorded or observed in git — none is a lower bound.");
    }
    return U.note(U.fmt.n(audit.approx) + " of " + U.fmt.n(audit.total) + " " + what +
      " are lower bounds, not observations: a sprint range or the git baseline " +
      "floor places the task in this period at the earliest — see Data & theme.");
  }

  /* Bucket a task's closure date onto the same period key the series uses, so
     a period can be marked approximate. If the generator's period starts ever
     stop being week starts this simply matches nothing, which loses the
     marker rather than inventing a false one. */
  function periodKey(date, gran) {
    return gran === "week" ? U.d.iso(U.d.startOfWeek(date)) : U.d.iso(date);
  }

  function approxByPeriod(tasks, gran) {
    var map = {};
    for (var i = 0; i < tasks.length; i++) {
      var t = tasks[i] || {};
      if (!t.closed_at) continue;
      var key = periodKey(t.closed_at, gran);
      if (!key) continue;
      if (!map[key]) map[key] = { total: 0, approx: 0 };
      map[key].total++;
      if (t.closed_at_floored || WEAK_SOURCES[t.closed_at_source]) map[key].approx++;
    }
    return map;
  }

  function indexChurn(churn) {
    var byStart = {};
    churn.forEach(function (row) {
      var key = U.d.iso(row.start);
      if (key) byStart[key] = row;
    });
    return byStart;
  }

  function netOf(row) {
    if (!row) return null;
    return row.net == null ? num(row.added) - num(row.closed) : num(row.net);
  }

  function remainingOf(point) {
    return point.remaining == null
      ? num(point.scope) - num(point.done)
      : num(point.remaining);
  }

  /* ----------------------------------------------------------------------
     Forecast. `usable` is the generator's own verdict; an empty cone is
     treated as unusable regardless, since there would be nothing to draw.
     ---------------------------------------------------------------------- */

  function readForecast(metrics) {
    var f = (metrics && metrics.forecast) || {};
    var cone = arr(f.cone);
    return {
      usable: !!f.usable && cone.length > 0,
      cone: cone,
      pct: f.percentiles || {},
      weeks: f.weeks || {},
      trials: f.trials,
      samples: f.sample_weeks,
      zeros: f.zero_weeks,
      remaining: f.remaining
    };
  }

  /* The count the cone descends from. SCHEMA.md §2.9's `remaining` is taken
     over every pending brief, including ones no series can place in time, so
     it is not `scope - done` from the burn-up and the two must not be mixed.
     Falling back to the cone's own maximum keeps a cone drawable when the
     generator omitted the field; returning null means there is nothing to
     anchor to and no cone may be drawn. */
  function coneOrigin(fc) {
    if (fc.remaining != null && isFinite(fc.remaining)) return Number(fc.remaining);
    var top = null;
    fc.cone.forEach(function (p) {
      CONE_KEYS.forEach(function (key) {
        var v = p[key];
        if (v == null || !isFinite(v)) return;
        if (top == null || Number(v) > top) top = Number(v);
      });
    });
    return top;
  }

  /* A percentile without its n is a guess wearing a number, so the sample
     size travels with every cone this tab draws. */
  function forecastNote(fc) {
    var head = "Forecast is a Monte Carlo draw over this project's own weekly " +
      "closure counts";
    if (fc.samples != null) {
      head += ", n = " + U.fmt.plural(fc.samples, "week");
      if (fc.zeros != null) {
        head += " (" + U.fmt.n(fc.zeros) + " of them with no closures at all, kept in the sample)";
      }
    } else {
      head += ", over a sample size the payload does not record — read every " +
        "percentile below as unquantified";
    }
    if (fc.trials != null) head += ", " + U.fmt.n(fc.trials) + " trials";
    if (fc.remaining != null && isFinite(fc.remaining)) {
      head += ". It descends from the " + U.fmt.plural(fc.remaining, "brief") +
        " still open across the whole corpus, which includes any that no series " +
        "on this tab can place in time";
    }

    var bits = [];
    CONE_KEYS.forEach(function (key) {
      if (!fc.pct[key]) return;
      var weeks = fc.weeks[key] != null
        ? " (" + U.fmt.plural(fc.weeks[key], "week") + ")" : "";
      bits.push(key + " " + U.fmt.dateLong(fc.pct[key]) + weeks);
    });
    return U.note(head + (bits.length
      ? ". Modelled finish dates, not commitments or deadlines: " +
        bits.join(", ") + "."
      : "."));
  }

  /* Convert one cone percentile into a plottable series. `convert` is what
     makes the same cone work on both charts: identity for a burn-down, and
     closures projected forward from the closed count already drawn for a
     burn-up, since SCHEMA.md §2.9's cone is projected REMAINING and a
     burn-up plots done. */
  function coneLine(fc, key, convert, anchor) {
    var out = anchor ? [anchor] : [];
    fc.cone.forEach(function (p) {
      var r = p[key];
      if (r == null || !isFinite(r)) return;
      out.push({ date: p.date, v: convert(Number(r)), remaining: Number(r), key: key });
    });
    return out;
  }

  /* Returns the percentiles it actually drew. A cone carrying only p50, or
     carrying one point with no anchor to join it to, draws fewer lines than
     CONE_KEYS has entries, and a legend built from CONE_KEYS would then name
     a line that is not on the chart. */
  function drawCone(c, fc, convert, anchorDate, anchorValue) {
    var drawn = [];
    CONE_KEYS.forEach(function (key) {
      var anchor = anchorDate == null
        ? null : { date: anchorDate, v: anchorValue, remaining: null, key: key };
      var pts = coneLine(fc, key, convert, anchor);
      if (pts.length < 2) return;
      c.line(pts, {
        x: xOfDate, y: vOf, cls: CONE_CLS[key], width: 1.5, dashed: true
      });
      drawn.push(key);
    });
    return drawn;
  }

  function coneLegend(fc, what, keys) {
    return keys.map(function (key) {
      return {
        label: what + " " + key + (fc.pct[key] ? " — " + U.fmt.date(fc.pct[key]) : ""),
        cls: CONE_CLS[key]
      };
    });
  }

  /* ----------------------------------------------------------------------
     Panel 1 — four locally derived tiles. metrics.kpis belongs to Overview;
     these answer the burn question specifically.
     ---------------------------------------------------------------------- */

  function kpiRow(ctx) {
    var tail = ctx.churn.slice(Math.max(0, ctx.churn.length - 4));
    var added = 0, closed = 0, net = 0;
    tail.forEach(function (row) {
      added += num(row.added);
      closed += num(row.closed);
      net += num(netOf(row));
    });

    var undated = ctx.totals.tasks_without_dates;
    if (undated == null && ctx.totals.tasks != null) {
      undated = Math.max(0, num(ctx.totals.tasks) - ctx.scopeTotal);
    }
    var scopeSub = ctx.pointsAvailable
      ? "briefs in the burn-up series"
      : "tasks, not points — this corpus carries no estimates";
    if (ctx.totals.tasks != null && undated) {
      scopeSub = U.fmt.n(ctx.totals.tasks) + " briefs in the corpus, " +
        U.fmt.n(undated) + " with no usable date";
    }

    var completion = ctx.scopeTotal ? (ctx.doneNow / ctx.scopeTotal) * 100 : null;

    var openBits = [];
    if (ctx.totals.in_progress != null) openBits.push(U.fmt.n(ctx.totals.in_progress) + " in progress");
    if (ctx.totals.blocked != null) openBits.push(U.fmt.n(ctx.totals.blocked) + " blocked");
    if (ctx.totals.not_started != null) openBits.push(U.fmt.n(ctx.totals.not_started) + " not started");

    var netTile = {
      label: "Net scope change",
      value: net,
      display: signed(net),
      tone: net > 0 ? "warn" : "good",
      sub: U.fmt.n(added) + " arrived, " + U.fmt.n(closed) + " closed over the last " +
           U.fmt.plural(tail.length, ctx.gran),
      hint: "Arrivals minus closures over the last four periods of " +
            "metrics.scope_churn, or fewer if the series is shorter — the " +
            "sub-line states how many. Positive means scope grew."
    };
    if (!tail.length) {
      netTile.display = "—";
      netTile.tone = "neutral";
      netTile.sub = "metrics.scope_churn is empty, so arrivals cannot be netted";
    }

    return el("div", { class: "pm-kpi-row" }, [
      U.kpi({
        label: "Scope (" + ctx.unit + ")",
        value: ctx.scopeTotal,
        tone: "neutral",
        sub: scopeSub,
        hint: "Briefs with a resolved date, as of the last period of the burn-up series."
      }),
      U.kpi({
        label: "Closed",
        value: ctx.doneNow,
        tone: U.toneFor(completion, { bad: 40, warn: 70 }),
        sub: completion == null ? "no scope to divide by"
                                : U.fmt.pct(completion) + " of dated scope",
        hint: "Cumulative closed briefs at the last period of the burn-up series."
      }),
      U.kpi({
        label: "Remaining",
        value: ctx.remainingNow,
        tone: "neutral",
        sub: openBits.length ? openBits.join(" · ")
                             : "dated briefs not yet closed",
        hint: "Neutral on purpose: remaining work is the state of an open project, not a fault."
      }),
      U.kpi(netTile)
    ]);
  }

  /* ----------------------------------------------------------------------
     Panel 2 — burn-up. The hero chart: scope as a backdrop, closed work
     climbing into it, and the forecast cone as projected closures.
     ---------------------------------------------------------------------- */

  function renderBurnup(band, ctx) {
    var card = U.card(
      "Burn-up",
      "Is closing keeping up with arriving scope?",
      { span: 2 }
    );
    band.body.appendChild(card);

    var pts = ctx.burnup;
    var fc = ctx.fc;
    var origin = fc.usable ? coneOrigin(fc) : null;

    var vals = pts.map(function (p) { return num(p.scope); });
    if (origin != null) vals.push(ctx.doneNow + origin);
    var ax = axisScale(0, U.st.max(vals), 5);

    var c = PM.svg.chart(card.body, {
      height: CHART_H,
      xType: "time",
      x: { domain: [ctx.xStart, ctx.xEnd] },
      y: { domain: [ax.lo, ax.hi], nice: false },
      label: "Burn-up: cumulative scope and cumulative closed briefs per " +
             ctx.gran + ", " + U.fmt.date(ctx.xStart) + " to " + U.fmt.date(ctx.xEnd)
    });
    c.yAxis({ ticks: ax.ticks, grid: true, title: ctx.unit });
    c.xAxis({ ticks: 6, format: U.fmt.date });

    /* Forecast furniture first: the band belongs behind every mark. */
    if (origin != null && ctx.today) {
      c.xBand(ctx.today, ctx.xEnd, { cls: "is-forecast", label: "forecast" });
    }

    /* Scope is the backdrop, not a competing signal, so it gets the muted
       grey series; the stroke on top keeps the boundary legible where closed
       work runs close to it. */
    c.area(pts, {
      x: xOfDate, y0: 0, y1: function (p) { return num(p.scope); }, cls: "pm-a7"
    });
    c.area(pts, {
      x: xOfDate, y0: 0, y1: function (p) { return num(p.done); },
      cls: "pm-a2", stroke: "pm-s2"
    });
    c.line(pts, {
      x: xOfDate, y: function (p) { return num(p.scope); }, cls: "pm-s7", width: 1.5
    });

    /* Projected closures, not `scopeTotal - remaining`: the cone's remaining
       is counted over every pending brief while `scopeTotal` counts only
       dated ones, so subtracting one from the other starts the cone below
       the closed line already drawn — a burn-up that appears to un-close
       work. Climbing from (today, doneNow) keeps it attached to the chart. */
    var drawn = [];
    if (origin != null) {
      drawn = drawCone(c, fc, function (remaining) {
        return ctx.doneNow + (origin - remaining);
      }, ctx.today, ctx.doneNow);
    }

    if (withinDomain(ctx.today, ctx.xStart, ctx.xEnd)) {
      c.vLine(ctx.today, { cls: "pm-ref", label: "today" });
    }

    c.hover(pts, {
      x: xOfDate,
      y: function (p) { return num(p.done); },
      label: function (p) {
        var lines = [periodHead(p.date, ctx.gran)];
        lines.push("Scope: " + U.fmt.n(num(p.scope)) + " " + ctx.unit);
        lines.push("Closed: " + U.fmt.n(num(p.done)));
        lines.push("Remaining: " + U.fmt.n(remainingOf(p)));
        var churnRow = ctx.churnByStart[U.d.iso(p.date)];
        if (churnRow) {
          lines.push("This " + ctx.gran + ": " + U.fmt.n(num(churnRow.added)) +
                     " arrived, " + U.fmt.n(num(churnRow.closed)) + " closed, net " +
                     signed(netOf(churnRow)));
        }
        var ap = ctx.approxPeriods[periodKey(p.date, ctx.gran)];
        if (ap && ap.approx) {
          lines.push("≈ " + U.fmt.n(ap.approx) + " of " + U.fmt.n(ap.total) +
                     " closures here rest on a derived date");
        }
        return lines;
      }
    });

    var items = [
      { label: "Scope (dated briefs)", cls: "pm-a7", value: U.fmt.n(ctx.scopeTotal) },
      { label: "Closed", cls: "pm-a2", value: U.fmt.n(ctx.doneNow) }
    ];
    if (drawn.length) items = items.concat(coneLegend(fc, "Projected closed", drawn));
    c.legend(items);
    c.done();

    card.body.appendChild(U.note(
      "The grey band is every brief whose arrival date resolved; the green band " +
      "is the closed ones. The gap between them is the work still open at that " +
      ctx.gran + ", and it closes only when the green line reaches the grey one."
    ));
    var approx = approxNote(ctx.closures, "closure dates");
    if (approx) card.body.appendChild(approx);
    if (ctx.undatedNote) card.body.appendChild(U.note(ctx.undatedNote));
    if (fc.usable) card.body.appendChild(forecastNote(fc));
    card.body.appendChild(U.note(FILTER_NOTE));
  }

  /* ----------------------------------------------------------------------
     Panel 3 — burn-down.
     ---------------------------------------------------------------------- */

  function renderBurndown(band, ctx) {
    var card = U.card(
      "Burn-down",
      "How much is left, against a straight-line reference?",
      { span: 2 }
    );
    band.body.appendChild(card);

    var pts = arr(ctx.metrics.burndown);
    if (!pts.length) {
      card.body.appendChild(U.empty(
        "metrics.burndown is empty, so no remaining-count series exists to draw."
      ));
      return;
    }

    var start = earliestDate(datesOf(pts));
    if (!start) {
      card.body.appendChild(U.empty(
        "metrics.burndown has " + U.fmt.plural(pts.length, "period") + " but no " +
        "period carries a resolvable date, so there is no time axis to draw them on."
      ));
      return;
    }

    var fc = ctx.fc;
    var vals = [];
    var hasIdeal = false;
    pts.forEach(function (p) {
      vals.push(num(p.remaining));
      if (p.ideal != null && isFinite(p.ideal)) { vals.push(Number(p.ideal)); hasIdeal = true; }
    });
    if (fc.usable) {
      fc.cone.forEach(function (p) {
        CONE_KEYS.forEach(function (key) {
          if (p[key] != null && isFinite(p[key])) vals.push(Number(p[key]));
        });
      });
    }
    var ax = axisScale(0, U.st.max(vals), 5);

    var c = PM.svg.chart(card.body, {
      height: CHART_H,
      xType: "time",
      x: { domain: [start, ctx.xEnd] },
      y: { domain: [ax.lo, ax.hi], nice: false },
      label: "Burn-down: remaining briefs per " + ctx.gran +
             " with a straight-line reference"
    });
    c.yAxis({ ticks: ax.ticks, grid: true, title: ctx.unit + " left" });
    c.xAxis({ ticks: 6, format: U.fmt.date });

    if (fc.usable && ctx.today) {
      c.xBand(ctx.today, ctx.xEnd, { cls: "is-forecast", label: "forecast" });
    }

    if (hasIdeal) {
      c.line(pts, {
        x: xOfDate,
        y: function (p) { return p.ideal == null ? null : Number(p.ideal); },
        cls: "pm-ref", width: 1.5, dashed: true
      });
    }
    c.line(pts, {
      x: xOfDate, y: function (p) { return num(p.remaining); }, cls: "pm-s1", width: 2.5
    });

    var drawn = [];
    if (fc.usable) {
      drawn = drawCone(c, fc, function (remaining) { return remaining; },
                       ctx.today, num(lastOf(pts).remaining));
    }

    if (withinDomain(ctx.today, start, ctx.xEnd)) {
      c.vLine(ctx.today, { cls: "pm-ref", label: "today" });
    }

    c.hover(pts, {
      x: xOfDate,
      y: function (p) { return num(p.remaining); },
      label: function (p) {
        var lines = [periodHead(p.date, ctx.gran)];
        lines.push("Remaining: " + U.fmt.n(num(p.remaining)) + " " + ctx.unit);
        if (p.ideal != null && isFinite(p.ideal)) {
          lines.push("Reference line: " + U.fmt.n(Number(p.ideal), 1));
          lines.push("Difference: " + signed(num(p.remaining) - Number(p.ideal)) +
                     " against the reference");
        }
        var churnRow = ctx.churnByStart[U.d.iso(p.date)];
        if (churnRow) {
          lines.push("This " + ctx.gran + ": " + U.fmt.n(num(churnRow.added)) +
                     " arrived, " + U.fmt.n(num(churnRow.closed)) + " closed");
        }
        return lines;
      }
    });

    var items = [{ label: "Remaining", cls: "pm-s1", value: U.fmt.n(ctx.remainingNow) }];
    if (hasIdeal) items.push({ label: "Straight-line reference", cls: "pm-ref" });
    if (drawn.length) items = items.concat(coneLegend(fc, "Projected remaining", drawn));
    c.legend(items);
    c.done();

    card.body.appendChild(U.note(
      "The dashed reference is nothing more than a straight line from the first " +
      "period's remaining count down to a zero-remaining finish. It is arithmetic, " +
      "not a commitment: no sprint in this corpus records a commitment and no brief " +
      "carries an estimate (SCHEMA.md §0), so being above or below it means only " +
      "that closures were slower or faster than an even spread."
    ));
    var approx = approxNote(ctx.closures, "closure dates");
    if (approx) card.body.appendChild(approx);
    if (fc.usable) card.body.appendChild(forecastNote(fc));
    card.body.appendChild(U.note(FILTER_NOTE));
  }

  /* ----------------------------------------------------------------------
     Panel 4 — cumulative flow.
     ---------------------------------------------------------------------- */

  function renderCfd(band, ctx) {
    var card = U.card(
      "Cumulative flow",
      "Where is the open work sitting, period by period?",
      { span: 2 }
    );
    band.body.appendChild(card);

    var pts = arr(ctx.metrics.cfd);
    if (!pts.length) {
      card.body.appendChild(U.empty(
        "metrics.cfd is empty, so there is no per-period state breakdown to stack."
      ));
      return;
    }

    function totalAt(p) {
      var t = 0;
      CFD_KEYS.forEach(function (key) { t += num(p[key]); });
      return t;
    }

    var dates = datesOf(pts);
    var start = earliestDate(dates);
    if (!start) {
      card.body.appendChild(U.empty(
        "metrics.cfd has " + U.fmt.plural(pts.length, "period") + " but no period " +
        "carries a resolvable date, so there is no time axis to stack them on."
      ));
      return;
    }
    var xEnd = latestDate(dates.concat([ctx.today]));

    var ax = axisScale(0, U.st.max(pts.map(totalAt)), 5);

    var c = PM.svg.chart(card.body, {
      height: CHART_H,
      xType: "time",
      x: { domain: [start, xEnd] },
      y: { domain: [ax.lo, ax.hi], nice: false },
      label: "Cumulative flow diagram: briefs by workflow state per " + ctx.gran
    });
    c.yAxis({ ticks: ax.ticks, grid: true, title: ctx.unit });
    c.xAxis({ ticks: 6, format: U.fmt.date });

    c.stack(pts, {
      x: xOfDate,
      keys: CFD_KEYS,
      cls: function (key) { return CFD_CLS[key]; }
    });

    if (withinDomain(ctx.today, start, xEnd)) {
      c.vLine(ctx.today, { cls: "pm-ref", label: "today" });
    }

    c.hover(pts, {
      x: xOfDate,
      y: totalAt,
      label: function (p) {
        var lines = [periodHead(p.date, ctx.gran)];
        CFD_KEYS.forEach(function (key) {
          lines.push(CFD_LABEL[key] + ": " + U.fmt.n(num(p[key])));
        });
        lines.push("Total: " + U.fmt.n(totalAt(p)) + " " + ctx.unit);
        return lines;
      }
    });

    c.legend(CFD_KEYS.map(function (key) {
      return {
        label: CFD_LABEL[key], cls: CFD_CLS[key],
        value: U.fmt.n(num(lastOf(pts)[key]))
      };
    }));
    c.done();

    card.body.appendChild(U.note(
      "Read the thickness of a band, not its edge: thickness is how much work " +
      "sits in that state at that " + ctx.gran + ". A middle band that widens and " +
      "stays wide is a queue — work arriving into a state faster than it leaves. " +
      "The top edge is total scope, so the whole stack rising is scope growth."
    ));
    var approx = approxNote(ctx.closures, "closure dates");
    if (approx) card.body.appendChild(approx);
    card.body.appendChild(U.note(FILTER_NOTE));
  }

  /* ----------------------------------------------------------------------
     Panel 5 — scope churn. Arrivals against closures, with net overlaid as
     dots: a second axis would be a second unit, and these are all tasks.
     ---------------------------------------------------------------------- */

  function renderChurn(band, ctx) {
    var card = U.card(
      "Scope churn",
      "Per period: what arrived, what closed, and which won?"
    );
    band.body.appendChild(card);

    if (!ctx.churn.length) {
      card.body.appendChild(U.empty(
        "metrics.scope_churn is empty, so arrivals and closures cannot be " +
        "compared period by period."
      ));
      return;
    }

    var rows = ctx.churn.map(function (row, i) {
      var key = row.period || U.d.iso(row.start) || ("period " + (i + 1));
      return {
        key: String(key), start: row.start,
        added: num(row.added), closed: num(row.closed), net: num(netOf(row))
      };
    });

    /* Band domains are matched by string, so the axis needs a lookup rather
       than a formatter over the row. `2026-W38` is too wide to repeat ten
       times across a half-width card. */
    var tickText = {};
    rows.forEach(function (r) {
      var m = /^\d{4}-W(\d{1,2})$/.exec(r.key);
      tickText[r.key] = m ? "W" + m[1] : (r.start ? U.fmt.date(r.start) : r.key);
    });

    var vals = [];
    var minNet = 0;
    rows.forEach(function (r) {
      vals.push(r.added); vals.push(r.closed); vals.push(r.net);
      if (r.net < minNet) minNet = r.net;
    });
    var ax = axisScale(minNet, U.st.max(vals), 5);

    var c = PM.svg.chart(card.body, {
      height: CHART_H_SMALL,
      xType: "band",
      x: { domain: rows.map(function (r) { return r.key; }), padding: 0.28 },
      y: { domain: [ax.lo, ax.hi], nice: false },
      label: "Scope churn: " + ctx.unit + " arriving and closing per " + ctx.gran +
             ", with net change"
    });
    c.yAxis({ ticks: ax.ticks, grid: true, title: ctx.unit });
    c.xAxis({ ticks: 12, format: function (v) { return tickText[v] || String(v); } });

    c.bars(rows, {
      x: function (r) { return r.key; },
      keys: ["added", "closed"],
      cls: function (key) { return key === "added" ? "pm-a4" : "pm-a2"; },
      inset: 2,
      label: function (r, key) {
        return [
          r.key + (r.start ? " — " + periodHead(r.start, ctx.gran).toLowerCase() : ""),
          (key === "added" ? "Arrived: " : "Closed: ") + U.fmt.n(r[key]) + " " + ctx.unit,
          "Net: " + signed(r.net)
        ];
      }
    });

    /* Net is the difference of the two bars beside it, so it reads as a dot
       against a zero baseline rather than a third bar competing for the same
       visual weight. */
    c.hLine(0, { cls: "pm-ref", label: "net 0" });
    c.dots(rows, {
      x: function (r) { return r.key; },
      y: function (r) { return r.net; },
      r: 3.5,
      cls: "pm-s3",
      label: function (r) {
        return [
          r.key,
          "Net: " + signed(r.net) + " " + ctx.unit,
          U.fmt.n(r.added) + " arrived, " + U.fmt.n(r.closed) + " closed"
        ];
      }
    });

    c.legend([
      { label: "Arrived", cls: "pm-a4", value: U.fmt.n(ctx.churnAdded) },
      { label: "Closed", cls: "pm-a2", value: U.fmt.n(ctx.churnClosed) },
      { label: "Net change", cls: "pm-s3", value: signed(ctx.churnNet) }
    ]);
    c.done();

    card.body.appendChild(U.note(
      "Over the window, " + U.fmt.n(ctx.churnAdded) + " " + ctx.unit + " arrived and " +
      U.fmt.n(ctx.churnClosed) + " closed — net " + signed(ctx.churnNet) + ". " +
      "An arrival here is a brief whose created date resolved into this period, " +
      "which is when the scope became visible, not necessarily when it was decided."
    ));
    var approx = approxNote(ctx.arrivals, "arrival dates");
    if (approx) card.body.appendChild(approx);
    card.body.appendChild(U.note(FILTER_NOTE));
  }

  /* ----------------------------------------------------------------------
     Panel 6 — the periods themselves. The fallback for a reader who does not
     trust a chart, and the only place the ≈ marker can sit next to a number.
     ---------------------------------------------------------------------- */

  function renderTable(band, ctx) {
    var card = U.card(
      "Last periods, as numbers",
      "The same series without a chart in the way"
    );
    band.body.appendChild(card);

    var tail = ctx.burnup.slice(Math.max(0, ctx.burnup.length - 12));
    var rows = tail.map(function (p) {
      var churnRow = ctx.churnByStart[U.d.iso(p.date)] || null;
      var ap = ctx.approxPeriods[periodKey(p.date, ctx.gran)] || null;
      return {
        date: p.date,
        scope: num(p.scope),
        done: num(p.done),
        remaining: remainingOf(p),
        added: churnRow ? num(churnRow.added) : null,
        closed: churnRow ? num(churnRow.closed) : null,
        net: churnRow ? netOf(churnRow) : null,
        approx: ap
      };
    });

    function count(value) {
      return value == null ? "—" : U.fmt.n(value);
    }

    var cols = [
      {
        key: "date",
        label: ctx.gran === "week" ? "Week of" : "Day",
        fmt: function (v) { return U.fmt.date(v); }
      },
      { key: "scope", label: "Scope", align: "right", fmt: count },
      { key: "done", label: "Done", align: "right", fmt: count },
      { key: "remaining", label: "Left", align: "right", fmt: count },
      { key: "added", label: "Arrived", align: "right", fmt: count },
      {
        key: "closed", label: "Closed", align: "right",
        fmt: function (v, row) {
          if (v == null) return "—";
          if (!row.approx || !row.approx.approx) return U.fmt.n(v);
          /* The count is right; which period it belongs to is a lower bound. */
          return U.frag([
            U.fmt.n(v) + " ",
            U.approxMark(U.fmt.n(row.approx.approx) + " of " +
              U.fmt.n(row.approx.total) + " closures dated into this " + ctx.gran +
              " rest on a sprint range or a git floor, so this period is a lower bound.")
          ]);
        }
      },
      { key: "net", label: "Net", align: "right", fmt: function (v) { return signed(v); } }
    ];

    card.body.appendChild(U.table(cols, rows, { cls: "is-compact" }));
    card.body.appendChild(U.note(
      "Last " + U.fmt.plural(rows.length, ctx.gran) + " of metrics.burnup, joined to " +
      "metrics.scope_churn by period start. Arrived, Closed and Net are blank where " +
      "no churn period matched that date rather than shown as zero — an unknown is " +
      "not a nil."
    ));
    card.body.appendChild(U.note(FILTER_NOTE_TABLE));
  }

  /* ----------------------------------------------------------------------
     The view.
     ---------------------------------------------------------------------- */

  PM.views.burn = function (root, data) {
    /* The contract hands over an emptied panel; clearing anyway costs
       nothing and keeps the function safe to call on its own. */
    U.clear(root);

    var payload = data || {};
    var metrics = payload.metrics || {};
    var project = payload.project || {};
    var burnup = arr(metrics.burnup);

    if (!burnup.length) {
      root.appendChild(U.empty(
        "No task date could be resolved, so no time series can be drawn - see " +
        "the Data & theme tab for why."
      ));
      return;
    }

    var burnupDates = datesOf(burnup);
    var burnupStart = earliestDate(burnupDates);
    if (!burnupStart) {
      root.appendChild(U.empty(
        "metrics.burnup has " + U.fmt.plural(burnup.length, "period") + " but no " +
        "period carries a resolvable date, so there is no time axis to draw them " +
        "on - see the Data & theme tab for why."
      ));
      return;
    }

    /* Tasks are read here for one reason: to count how many of the dates
       under these series are lower bounds. That count is deliberately taken
       over the WHOLE corpus, because every series on this tab is
       whole-project — auditing a filtered subset would describe a chart
       nobody is looking at. The filter is read only to say what it hides. */
    var allTasks = payload.tasks || [];
    var shownTasks = (PM.app && PM.app.applyFilter)
      ? PM.app.applyFilter(payload.tasks || []) : (payload.tasks || []);

    var last = lastOf(burnup);
    var totals = metrics.totals || {};
    var ctx = {
      metrics: metrics,
      totals: totals,
      /* SCHEMA.md §1.3: only a fully covered corpus may be spoken of in
         points, and this one is not — but the payload decides, not this
         file, so the unit word is read rather than written. */
      pointsAvailable: !!(payload.units && payload.units.points_available),
      unit: (payload.units && payload.units.primary === "points") ? "points" : "tasks",
      gran: metrics.series_granularity === "day" ? "day" : "week",
      today: project.today || metrics.as_of || null,
      burnup: burnup,
      churn: arr(metrics.scope_churn),
      fc: readForecast(metrics),
      closures: dateAudit(allTasks, "closed_at"),
      arrivals: dateAudit(allTasks, "created_at"),
      approxPeriods: approxByPeriod(allTasks, metrics.series_granularity === "day" ? "day" : "week"),
      scopeTotal: num(last.scope),
      doneNow: num(last.done),
      remainingNow: remainingOf(last),
      xStart: burnupStart
    };
    ctx.churnByStart = indexChurn(ctx.churn);
    ctx.churnAdded = U.st.sum(ctx.churn.map(function (r) { return num(r.added); }));
    ctx.churnClosed = U.st.sum(ctx.churn.map(function (r) { return num(r.closed); }));
    ctx.churnNet = U.st.sum(ctx.churn.map(function (r) { return num(netOf(r)); }));
    ctx.xEnd = latestDate(burnupDates.concat([
      ctx.today,
      ctx.fc.usable ? ctx.fc.pct.p95 : null,
      ctx.fc.usable ? lastOf(ctx.fc.cone).date : null
    ]));

    var excluded = totals.tasks_without_dates;
    if (excluded == null) {
      excluded = arr((payload.provenance || {}).excluded_from_timeseries).length;
    }
    ctx.undatedNote = excluded
      ? U.fmt.n(excluded) + (excluded === 1 ? " brief is" : " briefs are") +
        " outside every series on this tab, because no date could be resolved for " +
        (excluded === 1 ? "it" : "them") + " at all — the scope line is therefore a " +
        "floor on real scope, not the whole of it."
      : null;

    root.appendChild(kpiRow(ctx));

    if (shownTasks.length !== allTasks.length) {
      root.appendChild(U.note(
        "The sprint and lane filters currently select " + U.fmt.n(shownTasks.length) +
        " of " + U.fmt.n(allTasks.length) + " briefs. Every chart below is still " +
        "whole-project: the generator aggregates these series before the front end " +
        "sees them, so they cannot be filtered without lying about what they cover.",
        "warn"
      ));
    }

    var burnBand = U.section(
      "Burn",
      "Two readings of the same pair of numbers — closed against total scope, " +
      "and what is left."
    );
    root.appendChild(burnBand);
    renderBurnup(burnBand, ctx);
    renderBurndown(burnBand, ctx);

    var flowBand = U.section(
      "Flow",
      "The same scope split by the state its briefs are in."
    );
    root.appendChild(flowBand);
    renderCfd(flowBand, ctx);

    var churnBand = U.section(
      "Churn and periods",
      "What moved the scope line, and the raw periods behind every chart above."
    );
    root.appendChild(churnBand);
    renderChurn(churnBand, ctx);
    renderTable(churnBand, ctx);
  };
})();
