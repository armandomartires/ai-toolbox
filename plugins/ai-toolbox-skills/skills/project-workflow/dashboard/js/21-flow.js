/* ==========================================================================
   21-flow.js — PM.views.flow: the Flow & velocity tab.

   Four questions in the order a delivery review actually asks them: how much
   closes per sprint, how much closes per period, how long a task takes once
   it exists, and what is in flight right now. Every series here is
   pre-aggregated by pm_dashboard.py (SCHEMA.md §2.4–§2.7) and rendered as
   given. What this file derives itself is confined to figures the contract
   asks for from the samples already in view, and each one prints its own n:
   the mean and p85 of the throughput counts, the trailing-period sum, the
   in-progress count, and the cycle/lead-time histogram buckets.

   Three constraints shape the whole file:
     - Velocity is a COUNT OF CLOSED TASKS, never points. `units
       .points_available` is false for this corpus, so a points figure would
       be invented; the points path below switches on by itself if that ever
       becomes true.
     - Every task date is derived (SCHEMA.md §1.2). A sample flagged
       `approximate` is a lower bound, so it is drawn in a lower-emphasis
       class and counted in a note under the chart instead of being quietly
       mixed into the distribution.
     - The metrics series are aggregated before the front end sees them, so
       the header filters cannot apply to them. Every chart built from a
       series says so; only the aging table is filtered.
   ========================================================================== */

window.PM = window.PM || {};
PM.views = PM.views || {};

(function () {
  "use strict";

  var U = PM.util;
  var el = U.el;

  /* Lane -> series class. The four lanes are the closed set in SCHEMA.md
     §1.4, but a lane outside it still draws — in the last slot — rather than
     vanishing from a chart that claims to show every closed task. */
  var LANE_CLS = {
    code: "pm-s1", model: "pm-s3", operator: "pm-s4", hardware: "pm-s5"
  };
  var LANE_ORDER = ["code", "model", "operator", "hardware"];
  var LANE_OTHER_CLS = "pm-s8";

  /* percentile_band -> fill class, plus a plain-English reading of it
     (SCHEMA.md §2.7). `unknown` means there was no historical distribution to
     compare the item against, which is not the same thing as "young". */
  var BAND_CLS = {
    p50: "pm-a2", p85: "pm-a4", p95: "pm-a6", over_p95: "pm-bad",
    unknown: "pm-a7"
  };
  var BAND_LABEL = {
    p50: "within p50",
    p85: "past p50, within p85",
    p95: "past p85, within p95",
    over_p95: "older than p95",
    unknown: "no baseline"
  };
  var BAND_TONE = {
    p50: "good", p85: "neutral", p95: "warn", over_p95: "bad",
    unknown: "neutral"
  };
  var BAND_ORDER = ["p50", "p85", "p95", "over_p95", "unknown"];

  /* Duration buckets. Cycle times here cluster at 0–6 days with a tail to
     ~31, so the buckets are fine where the data is and coarse where it is
     sparse; an even split over 0–31 would be one tall bar and seven empty
     ones. `Infinity` is the open top, compared with <=. */
  var BUCKETS = [
    { label: "0 d", lo: 0, hi: 0 },
    { label: "1 d", lo: 1, hi: 1 },
    { label: "2 d", lo: 2, hi: 2 },
    { label: "3 d", lo: 3, hi: 3 },
    { label: "4–5 d", lo: 4, hi: 5 },
    { label: "6–10 d", lo: 6, hi: 10 },
    { label: "11–20 d", lo: 11, hi: 20 },
    { label: "21+ d", lo: 21, hi: Infinity }
  ];
  var LONG_TAIL_FROM = 11;          // the first bucket the contract calls tail

  /* One sentence, used verbatim under every chart built from a pre-aggregated
     series. Showing an unfiltered chart beside a filtered table without
     saying so would be a lie by adjacency. */
  var WHOLE_PROJECT =
    "This chart shows the whole project; the sprint and lane filters apply " +
    "to task lists only.";

  var NO_CYCLE_TIME =
    "Cycle time is not computable for this corpus: no task has both a " +
    "created and a closed date, so no duration can be measured.";

  /* ----------------------------------------------------------------------
     Small local helpers. Nothing here duplicates PM.util — these are reads
     against the payload's own shape, which only this tab knows.
     ---------------------------------------------------------------------- */

  function isNum(value) {
    return value != null && typeof value !== "boolean" && isFinite(value);
  }

  function laneCls(lane) {
    return LANE_CLS[lane] || LANE_OTHER_CLS;
  }

  /* "week" | "day" from the payload, or the neutral word "period" when the
     generator did not say. Guessing "week" would put a unit in a sentence
     the data never claimed. */
  function granularity(m) {
    var g = m && m.series_granularity;
    return (g === "day" || g === "week") ? g : "period";
  }

  /* Task lookup for tooltips. Keys are prefixed so a task id can never
     collide with an Object.prototype member. */
  function indexTasks(tasks) {
    var out = {};
    (tasks || []).forEach(function (t) {
      if (t && t.id) out["k" + t.id] = t;
    });
    return out;
  }

  function countWhere(list, test) {
    var hits = 0;
    (list || []).forEach(function (item) { if (test(item)) hits++; });
    return hits;
  }

  /* Just the noun, agreed with a count. U.fmt.plural bundles the number in,
     which double-prints it in the many sentences here that already carry an
     explicit `n=`. */
  function unit(count, word) {
    return Math.abs(count) === 1 ? word : word + "s";
  }

  function filtersNote() {
    return U.note(WHOLE_PROJECT);
  }

  /* The honesty line the contract requires under any chart plotting derived
     dates. The count is always computed, never asserted. */
  function approxNote(approx, total, noun, extra) {
    if (!total) return null;
    /* A false `approximate` means only "not flagged as a lower bound"; it is
       not evidence of a hand-recorded source. SCHEMA.md §1.2 also resolves
       dates from git and from mtime, and those go unflagged without ever
       being testimony. */
    if (!approx) {
      return U.note(total === 1
        ? ("The one " + noun + " in this chart is not flagged as a derived " +
           "lower bound. It is still a resolved date rather than a recorded " +
           "one — see Data & theme for which source produced it.")
        : ("No " + noun + " in this chart is flagged as a derived lower " +
           "bound. All " + total + " are still resolved dates rather than " +
           "recorded ones — see Data & theme for which source produced " +
           "each."));
    }
    /* The noun agrees with the total, the verb with the count: "1 of 105
       closure dates is a lower bound". */
    var head = approx + " of " + total + " " + unit(total, noun);
    head += approx === 1 ? " is a lower bound, not an observation"
                         : " are lower bounds, not observations";
    return U.note(head + (extra ? ", " + extra : "") + " — see Data & theme.");
  }

  /* ----------------------------------------------------------------------
     Panel 1 — headline tiles.
     ---------------------------------------------------------------------- */

  function kpiRow(m, units, allTasks) {
    var vel = m.velocity || [];
    var tp = m.throughput || [];
    var ct = m.cycle_time || {};
    var gran = granularity(m);
    var pointsOn = !!(units && units.points_available);

    var tiles = [];

    tiles.push(U.kpi({
      label: "Velocity",
      value: isNum(m.velocity_avg) ? m.velocity_avg : null,
      decimals: 1,
      sub: "tasks per sprint, n=" + vel.length,
      hint: "Mean closures per sprint over every sprint with at least one " +
            "closure. Standard deviation " +
            (isNum(m.velocity_stddev) ? U.fmt.n(m.velocity_stddev, 1)
                                      : "not computable") +
            (pointsOn ? "." : ". Counted in tasks: the corpus carries no " +
                              "estimates.")
    }));

    var recent = tp.slice(-4);
    var recentSum = U.st.sum(recent.map(function (r) { return r.count || 0; }));
    tiles.push(U.kpi({
      /* The label names how many periods there actually are: a window with
         two weeks in it must not advertise a four-week figure, and an empty
         series must not advertise a window at all. */
      label: recent.length
        ? ("Throughput, last " + recent.length + " " +
           unit(recent.length, gran))
        : "Throughput",
      value: recent.length ? recentSum : null,
      sub: recent.length
        ? ("tasks closed, " + (recent[0].period || "?") + "–" +
           (recent[recent.length - 1].period || "?"))
        : "no throughput series in the payload",
      hint: "Closed tasks summed over the trailing " + gran +
            "s of the window, quiet " + gran + "s included."
    }));

    var ctN = isNum(ct.n) ? ct.n : (ct.samples || []).length;
    var haveCt = !!ct.usable && isNum(ct.p50) && isNum(ct.p85);
    tiles.push(U.kpi({
      label: "Cycle time p50 / p85",
      display: haveCt ? (U.fmt.n(ct.p50) + " / " + U.fmt.n(ct.p85) + " d")
                      : "—",
      sub: haveCt ? ("days brief→closure, n=" + U.fmt.n(ctN))
                  : "not computable; see Data & theme",
      hint: haveCt
        ? ("Half of all closed tasks finished within " + U.fmt.days(ct.p50) +
           ", 85% within " + U.fmt.days(ct.p85) + ", 95% within " +
           (isNum(ct.p95) ? U.fmt.days(ct.p95) : "an unknown span") +
           ". Nearest-rank percentiles over n=" + U.fmt.n(ctN) + ".")
        : NO_CYCLE_TIME
    }));

    /* WIP is counted from the unfiltered task list on purpose: it sits beside
       three whole-project metrics, and a tile that silently changed meaning
       with the header filter would not be comparable with them. */
    var wip = countWhere(allTasks, function (t) {
      return t && t.workflow_state === "in_progress";
    });
    tiles.push(U.kpi({
      label: "Work in progress",
      value: wip,
      sub: "tasks in progress, whole project",
      hint: "Counted from workflow_state. The corpus declares no WIP limit, " +
            "so there is no target to read this against."
    }));

    return el("div", { class: "pm-kpi-row" }, tiles);
  }

  /* ----------------------------------------------------------------------
     Panel 2 — velocity by sprint.
     ---------------------------------------------------------------------- */

  function velocityCard(host, m, units) {
    var rows = m.velocity || [];
    var pointsOn = !!(units && units.points_available);
    var card = U.card(
      "Velocity by sprint",
      pointsOn ? "closed tasks and points per sprint, with a rolling average"
               : "closed tasks per sprint, with a rolling average",
      { span: 2 }
    );
    /* Mounted before the chart is built so PM.svg can measure a real width
       instead of falling back to its default. Every card below does the same. */
    host.appendChild(card);

    if (!rows.length) {
      card.body.appendChild(U.empty(
        "No sprint has a closed task yet, so there is no velocity to plot."
      ));
      return;
    }

    var ids = rows.map(function (r) { return r.sprint_id; });
    var tops = [];
    rows.forEach(function (r) {
      if (isNum(r.closed)) tops.push(r.closed);
      if (isNum(r.rolling_avg)) tops.push(r.rolling_avg);
      if (pointsOn && isNum(r.points)) tops.push(r.points);
    });
    if (isNum(m.velocity_avg)) tops.push(m.velocity_avg);

    function tip(r) {
      var lines = [r.label || r.sprint_id];
      lines.push("Closed: " + U.fmt.plural(r.closed || 0, "task"));
      if (pointsOn) {
        lines.push("Points: " + (isNum(r.points) ? U.fmt.n(r.points)
                                                 : "not estimated"));
      }
      lines.push("Rolling average: " +
                 (isNum(r.rolling_avg) ? U.fmt.n(r.rolling_avg, 1) + " tasks"
                                       : "—"));
      return lines;
    }

    var c = PM.svg.chart(card.body, {
      height: 300,
      xType: "band",
      yType: "linear",
      x: { domain: ids },
      y: { domain: [0, U.st.max(tops) || 1] },
      label: "Closed tasks per sprint over " + rows.length + " sprints, " +
             "with a rolling average and the project mean"
    });
    c.yAxis({ ticks: 5, grid: true, title: "tasks closed" });
    c.xAxis({ ticks: Math.min(ids.length, 12) });

    if (pointsOn) {
      c.bars(rows, {
        x: function (r) { return r.sprint_id; },
        keys: ["closed", "points"],
        cls: function (key) { return key === "points" ? "pm-a2" : "pm-a1"; },
        label: function (r) { return tip(r); }
      });
    } else {
      c.bars(rows, {
        x: function (r) { return r.sprint_id; },
        y: function (r) { return r.closed; },
        cls: "pm-a1",
        label: function (r) { return tip(r); }
      });
    }

    c.line(rows, {
      x: function (r) { return r.sprint_id; },
      y: function (r) { return r.rolling_avg; },
      cls: "pm-s4", width: 2, dashed: true
    });

    if (isNum(m.velocity_avg)) {
      c.hLine(m.velocity_avg, { label: "avg " + U.fmt.n(m.velocity_avg, 1) });
    }

    var legend = [{ label: "Closed tasks", cls: "pm-a1" }];
    if (pointsOn) legend.push({ label: "Points", cls: "pm-a2" });
    legend.push({ label: "Rolling average", cls: "pm-s4" });
    if (isNum(m.velocity_avg)) {
      legend.push({ label: "Project average", cls: "pm-ref" });
    }
    c.legend(legend);
    c.done();

    card.body.appendChild(U.note(pointsOn
      ? "Both series are drawn because units.points_available is true; the " +
        "task count stays the primary unit, and points cover only part of " +
        "the corpus unless points_coverage is 1.0."
      : "Velocity here counts CLOSED TASKS, not story points: " +
        "units.points_available is false — no brief in this corpus carries " +
        "an estimate, so any points figure would be invented."));
    card.body.appendChild(U.note(
      "Mean " + (isNum(m.velocity_avg) ? U.fmt.n(m.velocity_avg, 1) : "—") +
      " tasks per sprint, standard deviation " +
      (isNum(m.velocity_stddev) ? U.fmt.n(m.velocity_stddev, 1) : "—") +
      ", over n=" + rows.length + " " + unit(rows.length, "sprint") +
      " with at least one closure."));
    card.body.appendChild(filtersNote());
  }

  /* ----------------------------------------------------------------------
     Panel 3 — throughput per period.
     ---------------------------------------------------------------------- */

  function shortPeriod(period) {
    var m = /W(\d+)\s*$/.exec(String(period || ""));
    return m ? "W" + m[1] : String(period == null ? "" : period);
  }

  function throughputCard(host, m) {
    var rows = m.throughput || [];
    var gran = granularity(m);
    var card = U.card(
      gran === "week" ? "Weekly throughput" : "Throughput per " + gran,
      "tasks closed per " + gran + ", with the mean and the p85 of the counts",
      { span: 2 }
    );
    host.appendChild(card);

    if (!rows.length) {
      card.body.appendChild(U.empty(
        "The payload carries no throughput series, so there is nothing to " +
        "plot per " + gran + " — see Data & theme for why the window is empty."
      ));
      return;
    }

    var counts = rows.map(function (r) { return r.count || 0; });
    var meanValue = U.st.mean(counts);
    var p85 = U.st.percentile(counts, 85);

    var c = PM.svg.chart(card.body, {
      height: 280,
      xType: "band",
      yType: "linear",
      x: { domain: rows.map(function (r) { return r.period; }) },
      y: { domain: [0, U.st.max(counts) || 1] },
      label: "Tasks closed in each of " + rows.length + " " + gran + "s"
    });
    c.yAxis({ ticks: 5, grid: true, title: "tasks closed" });
    c.xAxis({ ticks: Math.min(rows.length, 14), format: shortPeriod });

    c.bars(rows, {
      x: function (r) { return r.period; },
      y: function (r) { return r.count; },
      cls: "pm-a2",
      label: function (r) {
        return [
          r.period,
          "Closed: " + U.fmt.plural(r.count || 0, "task"),
          (gran === "week" ? "Week beginning " : "Beginning ") +
            U.fmt.dateLong(r.start)
        ];
      }
    });

    /* The mean is drawn as a constant line rather than an hLine so it can
       carry the dashed style; hLine owns the reference style instead. */
    if (isNum(meanValue)) {
      c.line(rows, {
        x: function (r) { return r.period; },
        y: function () { return meanValue; },
        cls: "pm-s4", width: 1.5, dashed: true
      });
    }
    if (isNum(p85)) {
      c.hLine(p85, { label: "p85 = " + U.fmt.n(p85) });
    }

    var legend = [{ label: "Tasks closed", cls: "pm-a2" }];
    if (isNum(meanValue)) {
      legend.push({
        label: "Mean", cls: "pm-s4",
        value: U.fmt.n(meanValue, 1)
      });
    }
    if (isNum(p85)) {
      legend.push({ label: "p85 of the counts", cls: "pm-ref",
                    value: U.fmt.n(p85) });
    }
    c.legend(legend);
    c.done();

    var zeros = countWhere(counts, function (v) { return !v; });
    card.body.appendChild(U.note(zeros
      ? (zeros + " of " + rows.length + " " + unit(rows.length, gran) +
         " closed nothing — kept in the sample on purpose: dropping the " +
         "quiet " + gran + "s would raise the mean and every forecast drawn " +
         "from this series, and flatter the project for having been idle.")
      : ("Every " + gran + " in the window closed at least one task, so " +
         "there are no zero-throughput " + gran + "s to keep or drop.")));
    card.body.appendChild(U.note(
      "Mean and p85 are computed over n=" + rows.length + " " +
      unit(rows.length, gran) + " in the window " +
      (rows[0].period || "?") + "–" + (rows[rows.length - 1].period || "?") +
      ". The p85 uses nearest rank, so it names a count some " + gran +
      " actually achieved."));
    card.body.appendChild(filtersNote());
  }

  /* ----------------------------------------------------------------------
     Panel 4 — cycle-time control chart. The one chart on this tab that
     answers "is this normal?" rather than "how much".
     ---------------------------------------------------------------------- */

  function cycleScatterCard(host, m, byId) {
    var ct = m.cycle_time || {};
    var card = U.card(
      "Cycle time control chart",
      "one dot per closed task, placed on its closure date",
      { span: 2 }
    );
    host.appendChild(card);

    if (!ct.usable) {
      card.body.appendChild(U.empty(NO_CYCLE_TIME));
      return;
    }
    var samples = ct.samples || [];
    if (!samples.length) {
      card.body.appendChild(U.empty(
        "Cycle time is marked usable but carries no samples, so there is " +
        "nothing to plot."
      ));
      return;
    }

    var plot = samples.filter(function (s) {
      return U.d.parse(s.closed_at) && isNum(s.days);
    });
    if (!plot.length) {
      card.body.appendChild(U.empty(
        "All " + samples.length + " cycle-time samples are missing either a " +
        "closure date or a duration, so none can be placed on a time axis."
      ));
      return;
    }

    var times = plot.map(function (s) {
      return U.d.parse(s.closed_at).getTime();
    });
    var dayValues = plot.map(function (s) { return s.days; });

    /* The percentile lines are part of the y domain, not decoration. They come
       from the generator's whole sample, which includes samples dropped above
       for want of a closure date, so a p95 can sit above the tallest plotted
       dot — and a reference line above the domain is drawn outside the plot
       box rather than clipped. */
    var tops = dayValues.slice();
    [ct.p50, ct.p85, ct.p95].forEach(function (v) {
      if (isNum(v)) tops.push(v);
    });

    var c = PM.svg.chart(card.body, {
      height: 340,
      xType: "time",
      yType: "linear",
      /* Two days of padding either side so the first and last dots are not
         half-clipped by the plot edge. */
      x: {
        domain: [
          U.d.addDays(new Date(Math.min.apply(null, times)), -2),
          U.d.addDays(new Date(Math.max.apply(null, times)), 2)
        ]
      },
      y: { domain: [0, U.st.max(tops) || 1] },
      label: "Cycle time in days for " + plot.length + " closed tasks " +
             "against closure date, with p50, p85 and p95 reference lines"
    });
    c.yAxis({ ticks: 5, grid: true, title: "days" });
    c.xAxis({ ticks: 6, format: U.fmt.date });

    c.dots(plot, {
      x: function (s) { return s.closed_at; },
      y: function (s) { return s.days; },
      r: 3,
      /* An approximate date outranks the lane in the class: a reader needs to
         see "do not trust this x position" before "which lane it was". */
      cls: function (s) { return s.approximate ? "pm-s7" : laneCls(s.lane); },
      label: function (s) {
        var task = byId["k" + s.id];
        return [
          s.id,
          task && task.title ? task.title : U.fmt.deCamel(s.id),
          "Lane: " + (s.lane || "unassigned"),
          "Closed: " + U.fmt.dateLong(s.closed_at) +
            (s.approximate ? " (approximate date)" : ""),
          "Cycle time: " + U.fmt.days(s.days),
          s.sprint_id ? "Sprint: " + s.sprint_id : null
        ];
      }
    });

    /* Drawn in the refs group, which sits above the marks whatever order
       these are called in. */
    if (isNum(ct.p50)) {
      c.hLine(ct.p50, { cls: "pm-muted",
                        label: "p50 = " + U.fmt.n(ct.p50) + " d" });
    }
    if (isNum(ct.p85)) {
      c.hLine(ct.p85, { cls: "pm-ref",
                        label: "p85 = " + U.fmt.n(ct.p85) + " d" });
    }
    if (isNum(ct.p95)) {
      c.hLine(ct.p95, { cls: "pm-bad",
                        label: "p95 = " + U.fmt.n(ct.p95) + " d" });
    }

    var legend = LANE_ORDER.map(function (lane) {
      return {
        label: U.fmt.deCamel(lane), cls: LANE_CLS[lane],
        value: countWhere(plot, function (s) {
          return s.lane === lane && !s.approximate;
        })
      };
    });
    var otherLanes = countWhere(plot, function (s) {
      return !s.approximate && LANE_ORDER.indexOf(s.lane) < 0;
    });
    if (otherLanes) {
      legend.push({ label: "other lane", cls: LANE_OTHER_CLS,
                    value: otherLanes });
    }
    legend.push({
      label: "approximate date", cls: "pm-s7",
      value: countWhere(plot, function (s) { return !!s.approximate; })
    });
    c.legend(legend);
    c.done();

    var ctN = isNum(ct.n) ? ct.n : samples.length;
    var over95 = isNum(ct.p95)
      ? countWhere(plot, function (s) { return s.days > ct.p95; })
      : null;
    card.body.appendChild(U.note(
      "Read this as a control chart, not a trend: the three lines are the " +
      "historical distribution of this corpus, not targets. " +
      (over95 == null
        ? "No p95 was computed, so there is no outlier boundary to read."
        : (over95 === 0
            ? "No task sits above p95, so nothing here is an outlier by that " +
              "test."
            : ((over95 === 1
                 ? "1 task sits above p95 — that one is worth a retrospective"
                 : U.fmt.n(over95) + " tasks sit above p95 — those are the " +
                   "ones worth a retrospective") +
               "; a point below p50 finished faster than half the " +
               "corpus."))) +
      " Percentiles are the generator's, over n=" + U.fmt.n(ctN) +
      " closed tasks."));
    card.body.appendChild(approxNote(
      countWhere(plot, function (s) { return !!s.approximate; }),
      plot.length, "closure date"));
    if (plot.length < samples.length) {
      var dropped = samples.length - plot.length;
      card.body.appendChild(U.note(
        dropped + " of " + samples.length + " " +
        unit(samples.length, "sample") +
        (dropped === 1 ? " has" : " have") + " no usable closure date or " +
        "duration and cannot be plotted here, though " +
        (dropped === 1 ? "it remains" : "they remain") +
        " in the generator's percentiles."));
    }
    card.body.appendChild(filtersNote());
  }

  /* ----------------------------------------------------------------------
     Panels 5 and 6 — duration histograms. One bucketiser, two callers; the
     shape is identical and only the series and the caveat differ.
     ---------------------------------------------------------------------- */

  function bucketise(samples) {
    var rows = BUCKETS.map(function (b) {
      return { label: b.label, lo: b.lo, count: 0 };
    });
    var used = 0, skipped = 0;
    (samples || []).forEach(function (s) {
      var d = s && s.days;
      if (!isNum(d)) { skipped++; return; }
      var hit = -1;
      for (var i = 0; i < BUCKETS.length; i++) {
        if (d >= BUCKETS[i].lo && d <= BUCKETS[i].hi) { hit = i; break; }
      }
      /* A negative duration means closed-before-created, which is a corpus
         defect rather than a bucket; it is counted out loud, not folded into
         the first bar. */
      if (hit < 0) { skipped++; return; }
      rows[hit].count++;
      used++;
    });
    return { rows: rows, used: used, skipped: skipped };
  }

  function drawHistogram(host, hist, cls, label) {
    var counts = hist.rows.map(function (r) { return r.count; });
    var c = PM.svg.chart(host, {
      height: 260,
      xType: "band",
      yType: "linear",
      x: { domain: hist.rows.map(function (r) { return r.label; }) },
      y: { domain: [0, U.st.max(counts) || 1] },
      label: label
    });
    c.yAxis({ ticks: 5, grid: true, title: "tasks" });
    c.xAxis({ ticks: hist.rows.length });
    c.bars(hist.rows, {
      x: function (r) { return r.label; },
      y: function (r) { return r.count; },
      cls: cls,
      label: function (r) {
        return [
          r.label,
          U.fmt.plural(r.count, "task"),
          hist.used
            ? U.fmt.pct((100 * r.count) / hist.used) + " of n=" + hist.used
            : "no sample"
        ];
      }
    });
    c.done();
  }

  /* `avg` is the generator's own mean over `n` samples; the tail share is
     over the durations that actually landed in a bucket. The two can differ
     when a sample carries no duration, so each figure prints its own n
     rather than borrowing the other's. */
  function tailNote(hist, samples, avg, what, n) {
    var tail = 0;
    hist.rows.forEach(function (r) {
      if (r.lo >= LONG_TAIL_FROM) tail += r.count;
    });
    var mean = avg, meanN = isNum(n) ? n : (samples || []).length;
    if (!isNum(mean)) {
      var bucketed = [];
      (samples || []).forEach(function (s) {
        if (isNum(s.days) && s.days >= 0) bucketed.push(s.days);
      });
      mean = U.st.mean(bucketed);
      meanN = bucketed.length;
    }
    return U.note(
      "Mean " + (isNum(mean) ? U.fmt.n(mean, 1) : "—") + " days over n=" +
      meanN + " " + unit(meanN, what) + "; " + tail + " of the " + hist.used +
      " bucketed here (" +
      (hist.used ? U.fmt.pct((100 * tail) / hist.used) : "—") +
      ") took more than " + (LONG_TAIL_FROM - 1) + " days. That long tail, " +
      "not the mean, is what makes a delivery date uncertain."
    );
  }

  function cycleHistogramCard(host, m) {
    var ct = m.cycle_time || {};
    var card = U.card("Cycle time distribution",
                      "how many closed tasks took how long");
    host.appendChild(card);

    if (!ct.usable) {
      card.body.appendChild(U.empty(NO_CYCLE_TIME));
      return;
    }
    var samples = ct.samples || [];
    var hist = bucketise(samples);
    if (!hist.used) {
      card.body.appendChild(U.empty(
        "None of the " + samples.length + " cycle-time samples carries a " +
        "usable duration, so there is nothing to bucket."
      ));
      return;
    }

    drawHistogram(card.body, hist, "pm-a3",
                  "Cycle time in days, bucketed, over " + hist.used +
                  " closed tasks");
    card.body.appendChild(tailNote(hist, samples, ct.avg, "closed task",
                                   isNum(ct.n) ? ct.n : samples.length));
    if (hist.skipped) {
      card.body.appendChild(U.note(
        hist.skipped + " " + unit(hist.skipped, "sample") + " fell outside " +
        "every bucket — a missing or negative duration, which means a " +
        "closure date before the created date — and " +
        (hist.skipped === 1 ? "is" : "are") + " left out rather than " +
        "rounded into the first bar."));
    }
    card.body.appendChild(approxNote(
      countWhere(samples, function (s) { return !!s.approximate; }),
      samples.length, "closure date",
      "which makes the durations bucketed here lower bounds too"));
    card.body.appendChild(filtersNote());
  }

  /* Two sample sets are "the same" when they cover the same ids with the same
     durations. Comparing counts alone would call two different distributions
     equal whenever they happened to be the same size. */
  function sameSamples(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    var seen = {};
    for (var i = 0; i < b.length; i++) seen["k" + b[i].id] = b[i].days;
    for (var j = 0; j < a.length; j++) {
      if (seen["k" + a[j].id] !== a[j].days) return false;
    }
    return true;
  }

  function leadTimeCard(host, m) {
    var lt = m.lead_time || {};
    var ct = m.cycle_time || {};
    var card = U.card("Lead time distribution",
                      "first evidence of the work → closure");
    host.appendChild(card);

    if (!lt.usable) {
      card.body.appendChild(U.empty(
        "Lead time is not usable in this payload: no task has both a " +
        "first-evidence date and a closed date, so the generator could not " +
        "measure one."
      ));
      return;
    }
    var samples = lt.samples || [];
    if (!samples.length) {
      card.body.appendChild(U.empty(
        "Lead time is marked usable but carries no samples, so there is " +
        "nothing to bucket."
      ));
      return;
    }
    if (sameSamples(samples, ct.samples || [])) {
      card.body.appendChild(U.empty(
        "Lead time is identical to cycle time for all " + samples.length +
        " samples — in this corpus the brief's arrival is the first evidence " +
        "of the work — so a second histogram would only repeat the one " +
        "beside it."
      ));
      return;
    }

    var hist = bucketise(samples);
    if (!hist.used) {
      card.body.appendChild(U.empty(
        "None of the " + samples.length + " lead-time samples carries a " +
        "usable duration, so there is nothing to bucket."
      ));
      return;
    }

    drawHistogram(card.body, hist, "pm-a5",
                  "Lead time in days, bucketed, over " + hist.used + " tasks");
    card.body.appendChild(U.note(
      "Lead time starts at the first evidence the work existed — an earlier " +
      "commit or log entry — while cycle time starts when the brief itself " +
      "arrived, so lead time is the longer of the two wherever the work " +
      "began before it was written down."));
    card.body.appendChild(tailNote(hist, samples, lt.avg, "task",
                                   isNum(lt.n) ? lt.n : samples.length));
    card.body.appendChild(approxNote(
      countWhere(samples, function (s) { return !!s.approximate; }),
      samples.length, "closure date",
      "which makes the durations bucketed here lower bounds too"));
    card.body.appendChild(filtersNote());
  }

  /* ----------------------------------------------------------------------
     Panel 7 — aging work in progress. The chart is whole-project because the
     reference lines come from a whole-project distribution; the table under
     it is the filtered, task-level view.
     ---------------------------------------------------------------------- */

  function agingCard(host, m, filteredTasks, allTasks) {
    var aging = m.aging_wip || [];
    var ct = m.cycle_time || {};
    var card = U.card(
      "Aging work in progress",
      "every pending task by age, against the historical cycle-time " +
      "distribution",
      { span: 2 }
    );
    host.appendChild(card);

    if (!aging.length) {
      card.body.appendChild(U.empty(
        "No task is pending, so nothing is aging in progress."
      ));
      return;
    }

    var ages = aging.map(function (r) { return r.age_days; });
    var tops = ages.filter(isNum);
    /* `age_days` is null wherever the start date never resolved. With no
       numeric age the reference lines would still fix a domain, so the chart
       would draw a full axis and not one bar — the blank box SCHEMA.md §5.4
       forbids. The table below still carries the rows. */
    if (!tops.length) {
      card.body.appendChild(U.empty(
        "None of the " + aging.length + " pending " +
        unit(aging.length, "task") + " has a usable age: no start date " +
        "resolved, so there is nothing to place on an age axis."
      ));
      card.body.appendChild(agingTable(aging, filteredTasks, allTasks));
      return;
    }
    [ct.p50, ct.p85, ct.p95].forEach(function (v) {
      if (isNum(v)) tops.push(v);
    });

    var c = PM.svg.chart(card.body, {
      height: 300,
      xType: "band",
      yType: "linear",
      x: { domain: aging.map(function (r) { return r.id; }) },
      y: { domain: [0, U.st.max(tops) || 1] },
      label: "Age in days of " + aging.length + " pending tasks, against the " +
             "historical cycle-time percentiles"
    });
    c.yAxis({ ticks: 5, grid: true, title: "days in flight" });
    c.xAxis({ ticks: Math.min(aging.length, 10) });

    c.bars(aging, {
      x: function (r) { return r.id; },
      y: function (r) { return r.age_days; },
      cls: function (key, ki, r) {
        return BAND_CLS[(r && r.percentile_band) || "unknown"] ||
               BAND_CLS.unknown;
      },
      label: function (r) {
        return [
          r.id,
          r.title || U.fmt.deCamel(r.id),
          U.stateLabel(r.workflow_state) + " · " + (r.lane || "unassigned"),
          "Age: " + U.fmt.days(r.age_days) +
            (r.approximate ? " (start date approximate)" : ""),
          "Versus history: " +
            (BAND_LABEL[r.percentile_band] || BAND_LABEL.unknown),
          (r.blocked_by_unmet && r.blocked_by_unmet.length)
            ? "Blocked by: " + r.blocked_by_unmet.join(", ")
            : null
        ];
      }
    });

    /* These three lines are the entire point of the chart — without them a
       bar height is a number with nothing to be long relative to. */
    var haveRefs = false;
    if (isNum(ct.p50)) {
      haveRefs = true;
      c.hLine(ct.p50, { cls: "pm-muted",
                        label: "cycle p50 = " + U.fmt.n(ct.p50) + " d" });
    }
    if (isNum(ct.p85)) {
      haveRefs = true;
      c.hLine(ct.p85, { cls: "pm-ref",
                        label: "cycle p85 = " + U.fmt.n(ct.p85) + " d" });
    }
    if (isNum(ct.p95)) {
      haveRefs = true;
      c.hLine(ct.p95, { cls: "pm-bad",
                        label: "cycle p95 = " + U.fmt.n(ct.p95) + " d" });
    }

    var legend = [];
    BAND_ORDER.forEach(function (band) {
      var hits = countWhere(aging, function (r) {
        return ((r && r.percentile_band) || "unknown") === band;
      });
      if (hits) {
        legend.push({ label: BAND_LABEL[band], cls: BAND_CLS[band],
                      value: hits });
      }
    });
    if (haveRefs) {
      legend.push({ label: "historical cycle-time percentiles",
                    cls: "pm-ref" });
    }
    c.legend(legend);
    c.done();

    card.body.appendChild(U.note(
      "The chart above shows every in-flight task; the sprint and lane " +
      "filters apply to the table below it only."));
    if (haveRefs) {
      var ctN = isNum(ct.n) ? ct.n : (ct.samples || []).length;
      card.body.appendChild(U.note(
        "A bar taller than a reference line has already outlived that share " +
        "of everything this project has finished — the percentiles are the " +
        "generator's, over n=" + U.fmt.n(ctN) + " closed tasks."));
    } else {
      card.body.appendChild(U.note(
        "The cycle-time reference lines are absent because cycle time is " +
        "not computable for this corpus, so these ages have no historical " +
        "distribution to be compared against."));
    }

    var approx = countWhere(aging, function (r) { return !!r.approximate; });
    if (approx) {
      card.body.appendChild(U.note(
        approx + " of " + aging.length + " " + unit(aging.length, "age") +
        (approx === 1
          ? " is measured from a derived start date and is therefore a lower " +
            "bound"
          : " are measured from a derived start date and are therefore lower " +
            "bounds") + ", marked ≈ in the table."));
    }

    card.body.appendChild(agingTable(aging, filteredTasks, allTasks));
  }

  function agingTable(aging, filteredTasks, allTasks) {
    if (!allTasks.length) {
      return U.empty(
        "The payload carries no task list, so the aging entries cannot be " +
        "matched against the sprint and lane filters."
      );
    }

    var allowed = {};
    filteredTasks.forEach(function (t) {
      if (t && t.id) allowed["k" + t.id] = true;
    });
    var rows = aging.filter(function (r) { return allowed["k" + r.id]; });
    if (!rows.length) {
      return U.empty(
        "No in-flight task matches the current sprint and lane filter; " +
        aging.length + " are in flight across the whole project."
      );
    }

    var cols = [
      {
        key: "id", label: "Task", width: "10ch",
        fmt: function (v) {
          return el("code", { class: "pm-mono", text: String(v) });
        }
      },
      {
        key: "title", label: "Title",
        fmt: function (v, r) {
          return U.fmt.truncate(v || U.fmt.deCamel(r.id), 64);
        }
      },
      {
        key: "workflow_state", label: "State",
        fmt: function (v) {
          return U.badge(U.stateLabel(v), U.stateTone(v));
        }
      },
      {
        key: "lane", label: "Lane",
        fmt: function (v) { return v || "unassigned"; }
      },
      {
        key: "age_days", label: "Age", align: "right",
        fmt: function (v, r) {
          return U.frag([
            U.fmt.days(v),
            r.approximate ? " " : null,
            r.approximate
              ? U.approxMark("Age is measured from a derived start date " +
                             "(floored or sprint-granularity), so it is a " +
                             "lower bound. See Data & theme.")
              : null
          ]);
        }
      },
      {
        key: "percentile_band", label: "Versus history",
        fmt: function (v) {
          var band = v || "unknown";
          return U.badge(BAND_LABEL[band] || BAND_LABEL.unknown,
                         BAND_TONE[band] || "neutral");
        }
      },
      {
        key: "blocked_by_unmet", label: "Blocked by",
        fmt: function (v) {
          if (!v || !v.length) return "—";
          return el("span", { class: "pm-chips" }, v.map(function (dep) {
            return el("span", { class: "pm-chip", text: dep });
          }));
        }
      }
    ];

    return U.table(cols, rows);
  }

  /* ----------------------------------------------------------------------
     The view. Sections are appended to `root` before their cards are built,
     so PM.svg measures a laid-out host rather than a detached one.
     ---------------------------------------------------------------------- */

  PM.views.flow = function (root, data) {
    U.clear(root);

    var payload = data || {};
    var m = payload.metrics || {};
    var units = payload.units || {};
    var allTasks = payload.tasks || [];
    var tasks = (PM.app && PM.app.applyFilter)
      ? PM.app.applyFilter(allTasks)
      : allTasks;
    var byId = indexTasks(allTasks);
    var gran = granularity(m);

    root.appendChild(kpiRow(m, units, allTasks));

    var flow = U.section(
      "Velocity and throughput",
      "How much closes, per sprint and per " + gran + ". Both series are " +
      "aggregated by the generator before this page sees them."
    );
    root.appendChild(flow);
    velocityCard(flow.body, m, units);
    throughputCard(flow.body, m);

    var duration = U.section(
      "How long work takes",
      "The distribution, not an average: a mean cycle time hides the tail " +
      "that actually decides a date."
    );
    root.appendChild(duration);
    cycleScatterCard(duration.body, m, byId);
    cycleHistogramCard(duration.body, m);
    leadTimeCard(duration.body, m);

    var wip = U.section(
      "Aging work in progress",
      "What is in flight now, and how its age compares with what finishing " +
      "has historically taken."
    );
    root.appendChild(wip);
    agingCard(wip.body, m, tasks, allTasks);
  };
})();
