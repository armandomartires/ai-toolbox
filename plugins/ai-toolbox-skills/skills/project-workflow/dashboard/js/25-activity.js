/* ==========================================================================
   25-activity.js — tabs `activity` and `decisions`.

   The two views live together because they answer the same question from
   opposite ends: `activity` is "what happened", `decisions` is "what we wrote
   down while it happened". A month of heavy commit volume with no ADR beside
   it is itself the finding, which is why the ADR cadence chart is rendered in
   the same house style as the commit-volume chart rather than buried in prose.

   Everything here reads `metrics.activity` / `metrics.debt` — series the
   generator already aggregated (SCHEMA.md §2). No statistic is re-derived
   from tasks[]; the one exception is the heatmap's intensity quartiles, which
   are a display decision about a series that is given, not a new metric.
   ========================================================================== */

window.PM = window.PM || {};
PM.views = PM.views || {};

(function () {
  "use strict";

  var U = PM.util;
  var el = U.el;

  /* Every chart on these two tabs renders a pre-aggregated series, so the
     header's sprint/lane filter structurally cannot apply to it. Showing
     whole-project bars beside a filtered table without saying so would be a
     lie, so each such card carries this line. */
  var WHOLE_PROJECT =
    "This chart shows the whole project; the sprint and lane filters apply to " +
    "task lists only.";

  function wholeProjectNote() {
    return U.note(WHOLE_PROJECT);
  }

  /* A GitHub-style cell is 12px with a 2px gutter; the step is what the
     layout maths actually uses. */
  var HM_CELL = 12;
  var HM_STEP = 14;
  var HM_LEFT = 34;                    // room for the Mon/Wed/Fri labels
  var HM_TOP = 20;                     // room for the month labels

  /* `*_source` values that mean "we inferred this date", per SCHEMA.md §1.2.
     `git_added` / `git_last` are trustworthy unless separately floored. */
  var WEAK_SOURCES = { roadmap_sprint: 1, file_mtime: 1 };

  function isApprox(source, floored) {
    return floored === true || WEAK_SOURCES[String(source)] === 1;
  }

  function approxReason(source, floored) {
    if (floored === true) {
      return "Lower bound, not an observation: the git history this date came " +
             "from begins at the baseline commit. See Data & theme.";
    }
    if (String(source) === "roadmap_sprint") {
      return "Sprint-granularity date from the roadmap table, not a recorded " +
             "day. See Data & theme.";
    }
    if (String(source) === "file_mtime") {
      return "Filesystem mtime — the weakest source, used only when nothing " +
             "else resolved. See Data & theme.";
    }
    return "This date is derived, not recorded. See Data & theme.";
  }

  /* A date cell that admits what it is: the value, plus the approximate mark
     when the DateRef says the value is not an observation. */
  function dateCell(value, source, floored) {
    if (!value) return "—";
    if (!isApprox(source, floored)) return U.fmt.date(value);
    return [U.fmt.date(value), " ", U.approxMark(approxReason(source, floored))];
  }

  /* Ids and area names as chips, using the `pm-chips`/`pm-chip` pair
     css/20-components.css provides for exactly this (inline id lists). */
  function chips(values) {
    var list = values || [];
    if (!list.length) return "—";
    return el("span", { class: "pm-chips" }, list.map(function (value) {
      return el("span", { class: "pm-chip", text: String(value) });
    }));
  }

  /* Long text truncated for the cell, complete in the title attribute — the
     payload already clipped descriptions to 300 chars (§1.9), so the title is
     the most we have rather than the whole entry. */
  function clipped(text, max) {
    var s = String(text == null ? "" : text);
    if (!s) return "—";
    var short = U.fmt.truncate(s, max);
    return el("span", { title: short === s ? null : s, text: short });
  }

  var LOG_TONES = {
    correction: "bad", maintenance: "info", ingest: "neutral",
    project: "good", system: "neutral"
  };

  /* §1.9: the log's `type` is free text. An unknown type is rendered
     neutrally rather than dropped. */
  function logTone(type) {
    return LOG_TONES[String(type || "").toLowerCase()] || "neutral";
  }

  var ADR_TONES = {
    accepted: "good", superseded: "neutral", proposed: "info",
    rejected: "bad", unknown: "warn"
  };

  /* An absent status renders the same text as the literal `"unknown"` §1.7
     allows, so it must resolve to the same tone rather than to the default. */
  function adrTone(status) {
    return ADR_TONES[String(status || "unknown").toLowerCase()] || "neutral";
  }

  function adrClass(status) {
    var s = String(status || "").toLowerCase();
    if (s === "accepted") return "pm-s2";
    if (s === "superseded") return "pm-s7";
    return "pm-s4";
  }

  /* "2026-W39" -> "W39"; a bare date -> "Sep 21". Axis labels only. */
  function periodLabel(period) {
    var s = String(period == null ? "" : period);
    var m = /^\d{4}-W(\d{1,2})$/.exec(s);
    if (m) return "W" + m[1];
    var parsed = U.d.parse(s);
    return parsed ? U.fmt.date(parsed) : s;
  }

  /* SCHEMA.md §2 allows `series_granularity` to be "day", in which case
     `period` is a date and a "Week of" prefix would be a false claim. The
     period string's own shape decides, so no caller has to pass granularity. */
  function periodTitle(point) {
    var period = String((point && point.period) || "");
    var start = point && point.start;
    if (!start) return period;
    return (/^\d{4}-W\d{1,2}$/.test(period) ? "Week of " : "") + U.fmt.dateLong(start);
  }

  function monthKey(value) {
    var s = String(value == null ? "" : value);
    return /^\d{4}-\d{2}/.test(s) ? s.slice(0, 7) : null;
  }

  /* Inclusive month axis with the gaps filled in. A missing month is the
     interesting case on the ADR timeline — dropping it would hide the gap. */
  function monthRange(fromKey, toKey) {
    var out = [];
    if (!fromKey || !toKey) return out;
    var year = +fromKey.slice(0, 4), month = +fromKey.slice(5, 7);
    var endYear = +toKey.slice(0, 4), endMonth = +toKey.slice(5, 7);
    var guard = 0;
    while ((year < endYear || (year === endYear && month <= endMonth)) && guard++ < 1200) {
      out.push(year + "-" + (month < 10 ? "0" + month : String(month)));
      month++;
      if (month > 12) { month = 1; year++; }
    }
    return out;
  }

  /* How many of the closure dates behind any task-closure series are
     approximate. `isApprox` covers two different weaknesses — a lower bound at
     the git baseline, and sprint or mtime granularity — so the sentence must
     not name only one of them. Counted from the payload, never hardcoded. */
  function closureHonesty(tasks) {
    var total = 0, approx = 0;
    (tasks || []).forEach(function (task) {
      if (!task || !task.closed_at) return;
      total++;
      if (isApprox(task.closed_at_source, task.closed_at_floored)) approx++;
    });
    if (!total) return null;
    if (!approx) {
      return U.note("All " + total + " closure dates behind this chart resolved to a " +
                    "recorded day — none is a lower bound or a sprint-granularity " +
                    "estimate. See Data & theme.");
    }
    return U.note(approx + " of " + total + " closure dates are approximate — a lower " +
                  "bound at the git baseline, or sprint granularity — rather than a " +
                  "recorded day. See Data & theme.");
  }

  /* ----------------------------------------------------------------------
     The activity calendar. Drawn with PM.svg.raw rather than PM.svg.chart:
     it has no scales and no axes, just a week-by-weekday grid.
     ---------------------------------------------------------------------- */

  function drawCalendar(host, win, calendar) {
    var dates = U.d.range(win.start, win.end);
    if (!dates.length) {
      host.appendChild(U.empty("No reporting window was resolved, so there are no " +
                               "days to lay a calendar over."));
      return null;
    }

    /* The series is sparse by design, so the grid is built from the window and
       the entries are joined onto it by iso date. */
    var byDate = {};
    (calendar || []).forEach(function (entry) {
      if (entry && entry.date) byDate[entry.date] = entry;
    });

    var scores = [];
    (calendar || []).forEach(function (entry) {
      if (entry && entry.score > 0) scores.push(entry.score);
    });

    /* Quartiles, not fixed thresholds: a repo averaging 4 commits a day and one
       averaging 400 must both read well. */
    var q1 = U.st.percentile(scores, 25);
    var q2 = U.st.percentile(scores, 50);
    var q3 = U.st.percentile(scores, 75);

    function intensity(score) {
      if (!score || score <= 0) return 0;
      if (q1 == null) return 4;
      if (score <= q1) return 1;
      if (score <= q2) return 2;
      if (score <= q3) return 3;
      return 4;
    }

    var first = U.d.startOfWeek(dates[0]);
    var lastWeek = U.d.startOfWeek(dates[dates.length - 1]);
    var cols = Math.floor(U.d.diffDays(first, lastWeek) / 7) + 1;

    /* The viewBox is at least the host width so the grid maps 1:1 to pixels.
       PM.svg.raw sets width="100%", so a 10-week grid in its own viewBox would
       be stretched until each 12px cell rendered at about 100px. */
    var gridWidth = HM_LEFT + cols * HM_STEP + 4;
    var width = Math.max(gridWidth, PM.svg.hostWidth(host));
    var height = HM_TOP + 7 * HM_STEP + 4;

    var frame = PM.svg.raw(host, {
      width: width, height: height,
      label: "Activity calendar: " + dates.length + " days from " +
             U.fmt.dateLong(win.start) + " to " + U.fmt.dateLong(win.end) +
             ", " + scores.length + " of them with recorded activity."
    });

    /* Mon / Wed / Fri only — seven labels at 14px pitch collide. */
    [0, 2, 4].forEach(function (row) {
      frame.g.appendChild(el("text", {
        class: "pm-hm-label", x: HM_LEFT - 6, y: HM_TOP + row * HM_STEP + 10,
        "text-anchor": "end", text: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][row]
      }));
    });

    var lastMonth = null;
    for (var col = 0; col < cols; col++) {
      var monday = U.d.addDays(first, col * 7);
      if (!monday) continue;
      var month = monday.getUTCMonth();
      if (month !== lastMonth) {
        frame.g.appendChild(el("text", {
          class: "pm-hm-label", x: HM_LEFT + col * HM_STEP, y: HM_TOP - 7,
          text: U.d.MONTHS[month]
        }));
        lastMonth = month;
      }
    }

    dates.forEach(function (date) {
      var iso = U.d.iso(date);
      var offset = U.d.diffDays(first, date);
      var column = Math.floor(offset / 7);
      var dow = date.getUTCDay();
      var row = dow === 0 ? 6 : dow - 1;      // Monday-first, matching U.d.startOfWeek
      var entry = byDate[iso];
      var score = entry ? entry.score : 0;

      var cell = el("rect", {
        class: "pm-hm-cell pm-hm-" + intensity(score),
        x: HM_LEFT + column * HM_STEP, y: HM_TOP + row * HM_STEP,
        width: HM_CELL, height: HM_CELL, rx: 2,
        "data-date": iso
      });

      PM.svg.bindTip(cell, entry && score > 0
        ? [U.fmt.dateLong(iso),
           U.fmt.plural(entry.commits || 0, "commit"),
           U.fmt.plural(entry.log_entries || 0, "log entry", "log entries"),
           U.fmt.plural(entry.tasks_closed || 0, "task") + " closed"]
        : [U.fmt.dateLong(iso), "no recorded activity"]);

      frame.g.appendChild(cell);
    });

    /* The scale is drawn as SVG rects rather than through PM.svg.legend: the
       `pm-hm-*` classes are fill rules for SVG marks, while a legend swatch is
       an HTML span, so all five steps would come out the same grey. */
    var scale = PM.svg.raw(host, {
      width: Math.max(HM_LEFT + 6 * HM_STEP + 40, PM.svg.hostWidth(host)), height: 16,
      label: "Intensity scale, from no recorded activity to the busiest quartile."
    });
    scale.g.appendChild(el("text", { class: "pm-hm-label", x: 0, y: 11, text: "less" }));
    for (var step = 0; step <= 4; step++) {
      scale.g.appendChild(el("rect", {
        class: "pm-hm-cell pm-hm-" + step,
        x: 26 + step * HM_STEP, y: 1, width: HM_CELL, height: HM_CELL, rx: 2
      }));
    }
    scale.g.appendChild(el("text", {
      class: "pm-hm-label", x: 26 + 5 * HM_STEP + 2, y: 11, text: "more"
    }));

    return { days: dates.length, active: scores.length, q1: q1, q2: q2, q3: q3 };
  }

  /* ======================================================================
     PM.views.activity
     ====================================================================== */

  PM.views.activity = function (root, data) {
    /* Idempotent by contract (SCHEMA.md §5.1): PM.app re-calls this on theme
       change and on resize, so clear first and build every node fresh. */
    U.clear(root);

    var payload = data || {};
    var project = payload.project || {};
    var metrics = payload.metrics || {};
    var totals = metrics.totals || {};
    var act = metrics.activity || {};
    var win = metrics.window || {};
    var calendar = act.calendar || [];
    var codeVolume = act.code_volume || [];
    var logTypes = act.log_types || [];
    var byMonth = act.by_month || [];
    var topAreas = act.top_areas || [];
    var log = payload.log || [];
    var commits = payload.commits || [];
    var gitOff = project.git_available === false;

    /* ---- 1. KPI row -------------------------------------------------- */

    var windowDays = win.days != null ? win.days : U.d.range(win.start, win.end).length;
    var activeDays = 0;
    calendar.forEach(function (day) { if (day && day.score > 0) activeDays++; });

    var insertions = totals.insertions;
    var deletions = totals.deletions;
    if (insertions == null || deletions == null) {
      insertions = U.st.sum(commits.map(function (c) { return c && c.insertions; }));
      deletions = U.st.sum(commits.map(function (c) { return c && c.deletions; }));
    }
    var net = insertions - deletions;
    var commitCount = totals.commits != null ? totals.commits : commits.length;
    var logCount = totals.log_entries != null ? totals.log_entries : log.length;
    var activeShare = windowDays ? (activeDays / windowDays) * 100 : null;

    /* A window that did not resolve is zero days long, and "over 0 days" reads
       as a measurement rather than as the absence of one. */
    var windowPhrase = windowDays
      ? "over " + U.fmt.plural(windowDays, "day")
      : "no reporting window resolved";

    root.appendChild(el("div", { class: "pm-kpi-row" }, [
      U.kpi({
        label: "Commits", value: commitCount, tone: "neutral",
        sub: gitOff ? "git history unavailable" : windowPhrase,
        hint: "Commits parsed from git log --numstat."
      }),
      U.kpi({
        label: "Audit-log entries", value: logCount, tone: "neutral",
        sub: project.log_path ? "from " + project.log_path : "from the project audit log",
        hint: "One entry per dated heading in the audit log."
      }),
      U.kpi({
        label: "Net lines changed", value: net, tone: "neutral",
        display: (net >= 0 ? "+" : "−") + U.fmt.compact(Math.abs(net)),
        sub: "+" + U.fmt.compact(insertions) + " added / −" + U.fmt.compact(deletions) + " removed",
        hint: "Insertions minus deletions across every parsed commit."
      }),
      U.kpi({
        label: "Active days", value: activeDays,
        tone: U.toneFor(activeShare, { bad: 20, warn: 45 }),
        sub: windowDays
          ? "of " + U.fmt.plural(windowDays, "day") + " in the window"
          : "no reporting window resolved",
        hint: "A day is active when its combined commit / log-entry / closure score is above zero."
      })
    ]));

    /* ---- 2. Activity calendar ---------------------------------------- */

    var calSection = U.section("Activity calendar",
      "Commits, audit-log entries and task closures per day across the reporting window.");
    root.appendChild(calSection);

    var calCard = U.card("Daily activity",
      win.start && win.end ? U.fmt.dateLong(win.start) + " → " + U.fmt.dateLong(win.end) : null,
      { span: "full" });
    calSection.body.appendChild(calCard);

    if (!calendar.length) {
      calCard.body.appendChild(U.empty("The calendar series is empty: this run found no " +
        "commits, log entries or task closures to place on a day."));
    } else {
      var calStats = drawCalendar(calCard.body, win, calendar);
      if (calStats && calStats.active) {
        calCard.body.appendChild(U.note(
          "Intensity is a quartile rank over the " +
          U.fmt.plural(calStats.active, "day") + " with any recorded activity (25/50/75 = " +
          U.fmt.n(calStats.q1) + "/" + U.fmt.n(calStats.q2) + "/" + U.fmt.n(calStats.q3) +
          " score), so the shading re-fits itself to whatever rate this repo works at."));
      } else if (calStats) {
        calCard.body.appendChild(U.note(
          "Every day in the window carries a zero activity score, so there are no " +
          "quartiles to fit and every cell is drawn at the lowest step."));
      }
      if (calStats) {
        var honesty = closureHonesty(payload.tasks);
        if (honesty) calCard.body.appendChild(honesty);
      }
      calCard.body.appendChild(wholeProjectNote());
    }

    /* ---- 3 & 4. Code volume ------------------------------------------ */

    var volSection = U.section("Code volume",
      "Lines and commits per " + (metrics.series_granularity === "day" ? "day" : "ISO week") + ".");
    root.appendChild(volSection);

    var volCard = U.card("Insertions and deletions", "Deletions are drawn below the zero line.");
    volSection.body.appendChild(volCard);

    if (!codeVolume.length) {
      volCard.body.appendChild(U.empty(gitOff
        ? "No git history was available to this run, so there is no code volume to chart."
        : "The code-volume series is empty: no commit in the window touched a countable file."));
    } else {
      var maxIns = U.st.max(codeVolume.map(function (p) { return p.insertions || 0; })) || 0;
      var maxDel = U.st.max(codeVolume.map(function (p) { return p.deletions || 0; })) || 0;
      var volChart = PM.svg.chart(volCard.body, {
        height: 260, xType: "band", yType: "linear",
        margin: { t: 14, r: 16, b: 34, l: 56 },
        label: "Insertions above the zero line and deletions below it, per period.",
        x: { domain: codeVolume.map(function (p) { return p.period; }) },
        /* The domain straddles zero so c.bars can anchor at sy(0) and grow in
           both directions; only the top is nicened, the floor is the deletion
           peak rounded out the same way. */
        y: { domain: [-PM.svg.niceMax(maxDel), maxIns] }
      });
      volChart.yAxis({ ticks: 6, grid: true, format: U.fmt.compact });
      volChart.xAxis({ ticks: 8, format: periodLabel });
      volChart.bars(codeVolume, {
        x: function (p) { return p.period; },
        y: function (p) { return p.insertions || 0; },
        cls: "pm-a2",
        label: function (p) {
          return [periodTitle(p),
                  "+" + U.fmt.n(p.insertions || 0) + " inserted",
                  "−" + U.fmt.n(p.deletions || 0) + " deleted",
                  U.fmt.plural(p.commits || 0, "commit")];
        }
      });
      volChart.bars(codeVolume, {
        x: function (p) { return p.period; },
        y: function (p) { return -(p.deletions || 0); },
        cls: "pm-a6",
        label: function (p) {
          return [periodTitle(p),
                  "−" + U.fmt.n(p.deletions || 0) + " deleted",
                  "+" + U.fmt.n(p.insertions || 0) + " inserted"];
        }
      });
      volChart.hLine(0, { cls: "pm-ref" });
      volChart.legend([
        { label: "Insertions", cls: "pm-a2" },
        { label: "Deletions", cls: "pm-a6" }
      ]);
      volChart.done();

      var winIns = U.st.sum(codeVolume.map(function (p) { return p.insertions; }));
      var winDel = U.st.sum(codeVolume.map(function (p) { return p.deletions; }));
      var winCommits = U.st.sum(codeVolume.map(function (p) { return p.commits; }));
      volCard.body.appendChild(U.note(
        "Window totals: +" + U.fmt.n(winIns) + " / −" + U.fmt.n(winDel) + " lines across " +
        U.fmt.plural(winCommits, "commit") + " in " +
        U.fmt.plural(codeVolume.length, "period") + "."));
      volCard.body.appendChild(wholeProjectNote());
    }

    var rateCard = U.card("Commits per period", "With the period mean for reference.");
    volSection.body.appendChild(rateCard);

    if (!codeVolume.length) {
      rateCard.body.appendChild(U.empty(gitOff
        ? "No git history was available to this run, so there is no commit rate to chart."
        : "The code-volume series is empty, so there is no commit count per period."));
    } else {
      var commitSeries = codeVolume.map(function (p) { return p.commits || 0; });
      var commitMean = U.st.mean(commitSeries);
      var rateChart = PM.svg.chart(rateCard.body, {
        height: 220, xType: "band", yType: "linear",
        margin: { t: 14, r: 16, b: 34, l: 52 },
        label: "Commits per period, with the mean drawn as a dashed reference line.",
        x: { domain: codeVolume.map(function (p) { return p.period; }) },
        y: { domain: [0, U.st.max(commitSeries) || 1] }
      });
      rateChart.yAxis({ ticks: 5, grid: true });
      rateChart.xAxis({ ticks: 8, format: periodLabel });
      rateChart.bars(codeVolume, {
        x: function (p) { return p.period; },
        y: function (p) { return p.commits || 0; },
        cls: "pm-a1",
        label: function (p) {
          return [periodTitle(p), U.fmt.plural(p.commits || 0, "commit")];
        }
      });
      if (commitMean != null) {
        rateChart.hLine(commitMean, {
          cls: "pm-ref is-dashed",
          label: "mean = " + U.fmt.n(commitMean, 1)
        });
      }
      rateChart.done();
      rateCard.body.appendChild(U.note(
        "Mean over " + U.fmt.plural(codeVolume.length, "period") + "; the mean is not a " +
        "forecast, only the centre of what already happened."));
      rateCard.body.appendChild(wholeProjectNote());
    }

    /* ---- 5, 6 & 7. Audit log shape ----------------------------------- */

    var shapeSection = U.section("Audit log and monthly shape",
      "What kind of work the log records, and how the months compare.");
    root.appendChild(shapeSection);

    var mixCard = U.card("Audit-log type mix", "Entries per month by type.", { span: 2 });
    shapeSection.body.appendChild(mixCard);

    if (!logTypes.length) {
      mixCard.body.appendChild(U.empty("The log-type series is empty: no dated audit-log " +
        "entry carried a type this run could read."));
    } else {
      /* §1.9 says `type` is free text, so the key set is discovered rather
         than assumed. Sorted so a colour stays with a type between runs. The
         ramp is eight steps, so a ninth type reuses a colour and the legend
         order, not the swatch, is what separates the two. */
      var seen = {};
      logTypes.forEach(function (row) {
        var types = (row && row.types) || {};
        Object.keys(types).forEach(function (key) { seen[key] = true; });
      });
      var keys = Object.keys(seen).sort();
      var classFor = {};
      keys.forEach(function (key, i) { classFor[key] = "pm-a" + ((i % 8) + 1); });

      function rowTotal(row) {
        var acc = 0;
        keys.forEach(function (key) { acc += ((row && row.types) || {})[key] || 0; });
        return acc;
      }

      var maxMonth = U.st.max(logTypes.map(rowTotal)) || 1;
      var mixChart = PM.svg.chart(mixCard.body, {
        height: 260, xType: "band", yType: "linear",
        margin: { t: 14, r: 16, b: 34, l: 52 },
        label: "Audit-log entries per month, stacked by entry type.",
        x: { domain: logTypes.map(function (p) { return p.month; }) },
        y: { domain: [0, maxMonth] }
      });
      mixChart.yAxis({ ticks: 5, grid: true });
      mixChart.xAxis({ ticks: 8, format: U.d.monthLabel });
      mixChart.stackedBars(logTypes, {
        x: function (p) { return p.month; },
        keys: keys,
        value: function (p, k) { return (p.types || {})[k] || 0; },
        cls: function (key) { return classFor[key]; },
        label: function (p, key, v) {
          var total = rowTotal(p);
          return [U.d.monthLabel(p.month),
                  key + ": " + U.fmt.n(v),
                  total ? U.fmt.pct((v / total) * 100) + " of that month" : "share unknown",
                  U.fmt.plural(total, "entry", "entries") + " that month"];
        }
      });
      mixChart.legend(keys.map(function (key) {
        var across = 0;
        logTypes.forEach(function (row) { across += ((row && row.types) || {})[key] || 0; });
        return { label: key, cls: classFor[key], value: U.fmt.n(across) };
      }));
      mixChart.done();
      mixCard.body.appendChild(U.note(
        "Types are read from the log as written, not from a fixed list: " +
        keys.join(", ") + "."));
      mixCard.body.appendChild(wholeProjectNote());
    }

    var monthCard = U.card("Monthly activity", "Closures and decisions per month.");
    shapeSection.body.appendChild(monthCard);

    if (!byMonth.length) {
      monthCard.body.appendChild(U.empty("The monthly series is empty: no month in the " +
        "window carried a commit, a log entry or a closure."));
    } else {
      /* Only tasks_closed and decisions are plotted. Commits and log entries
         run an order of magnitude higher in this corpus, so putting them on
         the same y axis would flatten both bar series into the baseline, and a
         second axis would invite the reader to compare two unrelated scales.
         They are in the table under the chart instead, at full precision. */
      var monthMax = U.st.max(byMonth.map(function (p) {
        return Math.max(p.tasks_closed || 0, p.decisions || 0);
      })) || 1;
      var monthChart = PM.svg.chart(monthCard.body, {
        height: 220, xType: "band", yType: "linear",
        margin: { t: 14, r: 16, b: 34, l: 52 },
        label: "Tasks closed and decisions recorded per month, as grouped bars.",
        x: { domain: byMonth.map(function (p) { return p.month; }) },
        y: { domain: [0, monthMax] }
      });
      monthChart.yAxis({ ticks: 5, grid: true });
      monthChart.xAxis({ ticks: 8, format: U.d.monthLabel });
      monthChart.bars(byMonth, {
        x: function (p) { return p.month; },
        keys: ["tasks_closed", "decisions"],
        cls: function (key) { return key === "tasks_closed" ? "pm-a2" : "pm-a3"; },
        label: function (p, key) {
          return [U.d.monthLabel(p.month),
                  (key === "tasks_closed" ? "tasks closed: " : "decisions: ") +
                    U.fmt.n(p[key] || 0)];
        }
      });
      monthChart.legend([
        { label: "Tasks closed", cls: "pm-a2" },
        { label: "Decisions", cls: "pm-a3" }
      ]);
      monthChart.done();
      monthCard.body.appendChild(U.table([
        { key: "month", label: "Month", fmt: function (v) { return U.d.monthLabel(v); } },
        { key: "commits", label: "Commits", align: "right", fmt: function (v) { return U.fmt.n(v || 0); } },
        { key: "log_entries", label: "Log", align: "right", fmt: function (v) { return U.fmt.n(v || 0); } },
        { key: "tasks_closed", label: "Closed", align: "right", fmt: function (v) { return U.fmt.n(v || 0); } },
        { key: "decisions", label: "ADRs", align: "right", fmt: function (v) { return U.fmt.n(v || 0); } }
      ], byMonth));
      var monthHonesty = closureHonesty(payload.tasks);
      if (monthHonesty) monthCard.body.appendChild(monthHonesty);
      monthCard.body.appendChild(wholeProjectNote());
    }

    var areaCard = U.card("Top areas", "Commits per top-level path bucket.");
    shapeSection.body.appendChild(areaCard);

    if (!topAreas.length) {
      areaCard.body.appendChild(U.empty(gitOff
        ? "No git history was available to this run, so no path buckets could be counted."
        : "No commit in the window resolved to a path bucket."));
    } else {
      var areaRows = topAreas.map(function (a, i) {
        return { area: a.area, commits: a.commits || 0, idx: i };
      });
      var areaChart = PM.svg.chart(areaCard.body, {
        height: 220, xType: "band", yType: "linear",
        margin: { t: 14, r: 16, b: 34, l: 52 },
        label: "Commits per top-level path bucket.",
        x: { domain: areaRows.map(function (p) { return p.area; }) },
        y: { domain: [0, U.st.max(areaRows.map(function (p) { return p.commits; })) || 1] }
      });
      areaChart.yAxis({ ticks: 5, grid: true });
      areaChart.xAxis({ ticks: 8 });
      areaChart.bars(areaRows, {
        x: function (p) { return p.area; },
        y: function (p) { return p.commits; },
        cls: function (key, ki, p) { return "pm-a" + ((p.idx % 8) + 1); },
        label: function (p) {
          return [p.area, U.fmt.plural(p.commits, "commit")];
        }
      });
      areaChart.done();
      areaCard.body.appendChild(U.note(
        "Buckets are top-level paths, not components: scripts, tests, workflow, docs, " +
        "agent-config, wiki, other. One commit touching two trees counts in both."));
      areaCard.body.appendChild(wholeProjectNote());
    }

    /* ---- 8 & 9. Recent records --------------------------------------- */

    var recentSection = U.section("Recent activity",
      "The tail of the audit log and of git history, newest first.");
    root.appendChild(recentSection);

    /* The subtitle states what is on screen, not the cap: "Last 30 entries"
       over a five-row table is a claim the table does not support. */
    var logCard = U.card("Recent audit-log entries",
      log.length
        ? "Newest " + Math.min(30, log.length) + " of " +
          U.fmt.plural(log.length, "entry", "entries")
        : null,
      { span: "full" });
    recentSection.body.appendChild(logCard);

    if (!log.length) {
      logCard.body.appendChild(U.empty("No audit log was found at this project's log path, " +
        "so there are no entries to list."));
    } else {
      /* §1.9 hands the log over in file order and the log is append-only, so
         the tail is the newest; reversing gives newest-first without inventing
         an ordering the payload never claimed. */
      var recentLog = log.slice(Math.max(0, log.length - 30)).reverse();
      logCard.body.appendChild(U.table([
        { key: "date", label: "Date", fmt: function (v) { return v ? U.fmt.date(v) : "—"; } },
        { key: "type", label: "Type", fmt: function (v) { return U.badge(String(v || "unknown"), logTone(v)); } },
        /* §1.9's `chars` is a character count, so it must not be run through
           U.fmt.bytes — that would label a length as "4.1 KB" on disk. */
        { key: "chars", label: "Chars", align: "right", fmt: function (v) { return U.fmt.n(v); } },
        { key: "task_ids", label: "Tasks", fmt: function (v) { return chips(v); } },
        { key: "description", label: "Description", fmt: function (v) { return clipped(v, 220); } }
      ], recentLog, { cls: "is-compact" }));
      logCard.body.appendChild(U.note(
        U.fmt.plural(log.length, "entry", "entries") + " in the audit log, showing the " +
        "newest " + recentLog.length + "; the earliest is dated " +
        U.fmt.dateLong(log[0] && log[0].date) + ". Descriptions are the payload's first " +
        "300 characters, so the title text is all this run kept."));
    }

    var commitCard = U.card("Recent commits",
      commits.length
        ? "Newest " + Math.min(30, commits.length) + " of " +
          U.fmt.plural(commits.length, "commit")
        : null,
      { span: "full" });
    recentSection.body.appendChild(commitCard);

    if (!commits.length) {
      commitCard.body.appendChild(U.empty(gitOff
        ? "No git history was available to this run."
        : "Git history was read but contained no commits in the reporting window."));
    } else {
      /* §1.10 delivers commits newest first, so the head is the tail of time. */
      var recentCommits = commits.slice(0, 30);
      commitCard.body.appendChild(U.table([
        { key: "hash", label: "Hash", cls: "pm-mono", fmt: function (v) { return String(v || "—"); } },
        { key: "date", label: "Date", fmt: function (v) { return v ? U.fmt.date(v) : "—"; } },
        { key: "subject", label: "Subject", fmt: function (v) { return clipped(v, 90); } },
        { key: "files", label: "Files", align: "right", fmt: function (v) { return U.fmt.n(v || 0); } },
        {
          key: "insertions", label: "Lines", align: "right",
          fmt: function (v, row) {
            return "+" + U.fmt.n(v || 0) + " / −" + U.fmt.n(row.deletions || 0);
          }
        },
        { key: "areas", label: "Areas", fmt: function (v) { return chips(v); } }
      ], recentCommits, { cls: "is-compact" }));
      commitCard.body.appendChild(U.note(
        U.fmt.plural(commits.length, "commit") + " in the payload; showing the newest " +
        recentCommits.length + "."));
    }

    if (!gitOff && commits.length) {
      drawContributors(recentSection.body, commits);
      drawTaskLinkage(recentSection.body, commits);
    }
  };

  /* ----------------------------------------------------------------------
     Who committed, and how much of the history is traceable to a task.
     ---------------------------------------------------------------------- */

  function drawContributors(host, commits) {
    var by = {};
    commits.forEach(function (c) {
      if (!c) return;
      var who = c.author || "unattributed";
      var slot = by[who] || (by[who] = {
        author: who, commits: 0, insertions: 0, deletions: 0
      });
      slot.commits += 1;
      slot.insertions += c.insertions || 0;
      slot.deletions += c.deletions || 0;
    });
    var rows = Object.keys(by).map(function (k) { return by[k]; })
      .sort(function (a, b) { return b.commits - a.commits; });

    var card = U.card("Contributors", U.fmt.plural(rows.length, "author") +
                      " in the commit history");
    host.appendChild(card);

    if (rows.length === 1) {
      /* A one-author bar chart is a single column, which tells the reader
         nothing they cannot read in one sentence. */
      card.body.appendChild(U.note(
        "Every commit in this history is authored by " + rows[0].author + " (" +
        U.fmt.plural(rows[0].commits, "commit") + ", +" +
        U.fmt.n(rows[0].insertions) + " / −" + U.fmt.n(rows[0].deletions) +
        " lines). There is nothing to compare."
      ));
    } else {
      var max = rows[0].commits;
      var c = PM.svg.chart(card.body, {
        height: 260, xType: "band",
        x: { domain: rows.map(function (r) { return r.author; }), padding: 0.25 },
        y: { domain: [0, max] },
        label: "Commits per author"
      });
      c.yAxis({ ticks: 4, title: "commits" });
      c.xAxis({ anchor: "end" });
      c.bars(rows, {
        x: function (r) { return r.author; },
        y: function (r) { return r.commits; },
        cls: "pm-a1",
        label: function (r) {
          return [r.author, U.fmt.plural(r.commits, "commit"),
                  "+" + U.fmt.n(r.insertions) + " / −" + U.fmt.n(r.deletions)];
        }
      });
      c.done();
    }

    card.body.appendChild(U.table([
      { key: "author", label: "Author" },
      { key: "commits", label: "Commits", align: "right",
        fmt: function (v) { return U.fmt.n(v); } },
      { key: "insertions", label: "Lines", align: "right",
        fmt: function (v, row) {
          return "+" + U.fmt.n(v) + " / −" + U.fmt.n(row.deletions);
        } }
    ], rows, { cls: "is-compact" }));

    card.body.appendChild(U.note(
      "Commit counts are provenance, not productivity. One commit is not one " +
      "unit of work, and this is deliberately not turned into a ranking — " +
      "individual-throughput metrics measure ticket-shaped activity and reward " +
      "exactly the wrong behaviour."
    ));
  }

  function drawTaskLinkage(host, commits) {
    var named = 0;
    commits.forEach(function (c) {
      if (c && c.task_ids && c.task_ids.length) named++;
    });
    var unnamed = commits.length - named;

    var card = U.card("Commits linked to a task",
                      "Whether a commit subject names the work it belongs to");
    host.appendChild(card);

    var rows = [
      { label: "names a task", count: named, cls: "pm-ok" },
      { label: "names none", count: unnamed, cls: "pm-muted" }
    ].filter(function (r) { return r.count > 0; });

    if (!rows.length) {
      card.body.appendChild(U.empty("There are no commits to classify."));
      return;
    }

    var c = PM.svg.chart(card.body, {
      height: 200, xType: "band",
      x: { domain: rows.map(function (r) { return r.label; }), padding: 0.35 },
      y: { domain: [0, Math.max(named, unnamed)] },
      label: "Commits whose subject names a task id"
    });
    c.yAxis({ ticks: 4, title: "commits" });
    c.xAxis({});
    c.bars(rows, {
      x: function (r) { return r.label; },
      y: function (r) { return r.count; },
      cls: function (key, ki, p) { return p.cls; },
      label: function (r) {
        return [r.label, U.fmt.plural(r.count, "commit"),
                U.fmt.pct((r.count / commits.length) * 100) + " of the history"];
      }
    });
    c.done();

    card.body.appendChild(U.note(
      "A commit that names no task is not undisciplined work — merges, " +
      "tooling changes and follow-up fixes legitimately belong to none. What " +
      "this measures is how much of the history can be traced back to a brief " +
      "automatically, which is what every task-linked date on this dashboard " +
      "rests on."
    ));
  }

  /* ======================================================================
     PM.views.decisions
     ====================================================================== */

  PM.views.decisions = function (root, data) {
    U.clear(root);

    var payload = data || {};
    var project = payload.project || {};
    var metrics = payload.metrics || {};
    var totals = metrics.totals || {};
    var debt = metrics.debt || {};
    var decisions = payload.decisions || [];
    var reviews = payload.reviews || [];
    var cadence = debt.adr_cadence || [];
    var today = project.today || metrics.as_of || null;

    /* ---- 1. KPI row -------------------------------------------------- */

    var superseded = 0, recent = 0, undated = 0;
    decisions.forEach(function (adr) {
      if (!adr) return;
      if (adr.superseded_by != null || String(adr.status || "").toLowerCase() === "superseded") {
        superseded++;
      }
      if (!adr.date) {
        undated++;
      } else {
        var age = U.d.diffDays(adr.date, today);
        if (age != null && age >= 0 && age <= 30) recent++;
      }
    });

    var adrCount = totals.decisions != null ? totals.decisions : decisions.length;
    var reviewCount = totals.reviews != null ? totals.reviews : reviews.length;

    root.appendChild(el("div", { class: "pm-kpi-row" }, [
      U.kpi({
        label: "Decision records", value: adrCount, tone: "neutral",
        sub: "ADRs under the workflow decisions folder",
        hint: "One entry per numbered ADR, excluding the template."
      }),
      U.kpi({
        label: "Superseded", value: superseded,
        tone: U.toneFor(superseded, { invert: true, bad: 8, warn: 4 }),
        /* The numerator was counted over `decisions[]`, so the denominator is
           that same array's length rather than `totals.decisions`. */
        sub: decisions.length
          ? U.fmt.pct((superseded / decisions.length) * 100) + " of the " +
            U.fmt.plural(decisions.length, "ADR") + " listed"
          : "no ADRs to compare",
        hint: "An ADR whose status names a successor, or that carries superseded_by."
      }),
      U.kpi({
        label: "Review checkpoints", value: reviewCount, tone: "neutral",
        sub: "sprint-end reviews on record",
        hint: "Files under the workflow reviews folder."
      }),
      /* Without an as-of date there is no 30-day window to count in, and a
         zero here would read as "no decisions lately" rather than "not
         known". The tile says unknown instead. */
      U.kpi({
        label: "ADRs in last 30 days", value: today ? recent : null,
        tone: today ? U.toneFor(recent, { bad: 0, warn: 1 }) : "neutral",
        sub: today
          ? "as of " + U.fmt.dateLong(today)
          : "no as-of date recorded, so this cannot be counted",
        hint: "Counted from each ADR's resolved date, approximate ones included."
      })
    ]));

    /* ---- 2. ADR cadence ---------------------------------------------- */

    var cadenceSection = U.section("Decision cadence",
      "How often a decision got written down, and when it did not.");
    root.appendChild(cadenceSection);

    var cadenceCard = U.card("ADRs per month", "With the monthly mean for reference.");
    cadenceSection.body.appendChild(cadenceCard);

    if (!cadence.length) {
      cadenceCard.body.appendChild(U.empty("The cadence series is empty: no ADR resolved to " +
        "a month, so there is nothing to place on a time axis."));
    } else {
      var counts = cadence.map(function (p) { return p.count || 0; });
      var cadenceMean = U.st.mean(counts);
      var cadenceChart = PM.svg.chart(cadenceCard.body, {
        height: 220, xType: "band", yType: "linear",
        margin: { t: 14, r: 16, b: 34, l: 52 },
        label: "Decision records written per month, with the mean as a dashed line.",
        x: { domain: cadence.map(function (p) { return p.month; }) },
        y: { domain: [0, U.st.max(counts) || 1] }
      });
      cadenceChart.yAxis({ ticks: 5, grid: true });
      cadenceChart.xAxis({ ticks: 8, format: U.d.monthLabel });
      cadenceChart.bars(cadence, {
        x: function (p) { return p.month; },
        y: function (p) { return p.count || 0; },
        cls: "pm-a3",
        label: function (p) {
          return [U.d.monthLabel(p.month), U.fmt.plural(p.count || 0, "decision")];
        }
      });
      if (cadenceMean != null) {
        cadenceChart.hLine(cadenceMean, {
          cls: "pm-ref is-dashed",
          label: "mean = " + U.fmt.n(cadenceMean, 1)
        });
      }
      cadenceChart.done();
      cadenceCard.body.appendChild(U.note(
        "Mean over " + U.fmt.plural(cadence.length, "month") + " on record. Cadence is read " +
        "against the Activity tab: a month of heavy commit volume with no ADR beside it means " +
        "decisions were being made without being recorded, which is the failure this chart " +
        "exists to catch."));
      cadenceCard.body.appendChild(wholeProjectNote());
    }

    /* ---- 3. ADR timeline --------------------------------------------- */

    var timelineCard = U.card("ADR timeline",
      "Decision number against the month it was recorded.", { span: "full" });
    cadenceSection.body.appendChild(timelineCard);

    var plottable = decisions.filter(function (adr) {
      return adr && adr.date && monthKey(adr.date) && adr.number != null;
    });

    if (!plottable.length) {
      timelineCard.body.appendChild(U.empty("No ADR carries both a number and a resolvable " +
        "date, so none can be placed on a timeline."));
    } else {
      /* Counted over `plottable`, not over every dated ADR: an ADR with a date
         but no number is not on this chart, so including it would produce an
         "N of M" whose N can exceed M. */
      var approxPlotted = 0;
      plottable.forEach(function (adr) {
        if (isApprox(adr.date_source, adr.date_floored)) approxPlotted++;
      });
      var notPlotted = decisions.length - plottable.length;

      var months = plottable.map(function (adr) { return monthKey(adr.date); }).sort();
      var axis = monthRange(months[0], months[months.length - 1]);
      var maxNumber = U.st.max(plottable.map(function (adr) { return adr.number; })) || 1;
      /* Six ticks over a multiple-of-six top keeps the ADR numbers on the y
         axis whole; niceMax would round 27 up to 50 and waste half the plot. */
      var yTop = Math.max(6, Math.ceil(maxNumber / 6) * 6);

      var timeChart = PM.svg.chart(timelineCard.body, {
        height: 300, xType: "band", yType: "linear",
        margin: { t: 16, r: 16, b: 34, l: 52 },
        label: "Each decision record plotted by number against the month it was recorded.",
        x: { domain: axis },
        y: { domain: [0, yTop], nice: false }
      });
      timeChart.yAxis({ ticks: 6, grid: true, title: "ADR number" });
      timeChart.xAxis({ ticks: 8, format: U.d.monthLabel });
      timeChart.dots(plottable, {
        x: function (p) { return monthKey(p.date); },
        y: function (p) { return p.number; },
        r: 4,
        cls: function (p) { return adrClass(p.status); },
        label: function (p) {
          return ["ADR " + p.number + " — " + (p.title || p.slug || "untitled"),
                  "status: " + (p.status || "unknown"),
                  "date: " + U.fmt.dateLong(p.date) + " (" + (p.date_source || "unknown") +
                    (isApprox(p.date_source, p.date_floored) ? ", approximate" : "") + ")",
                  U.fmt.bytes(p.size_bytes)];
        }
      });

      var statusCounts = { accepted: 0, superseded: 0, other: 0 };
      plottable.forEach(function (adr) {
        var s = String(adr.status || "").toLowerCase();
        if (s === "accepted") statusCounts.accepted++;
        else if (s === "superseded") statusCounts.superseded++;
        else statusCounts.other++;
      });
      timeChart.legend([
        { label: "Accepted", cls: "pm-s2", value: U.fmt.n(statusCounts.accepted) },
        { label: "Superseded", cls: "pm-s7", value: U.fmt.n(statusCounts.superseded) },
        { label: "Other or unknown", cls: "pm-s4", value: U.fmt.n(statusCounts.other) }
      ].filter(function (item) { return item.value !== "0"; }));
      timeChart.done();

      /* A dot below and to the right of its neighbours is a backfilled ADR —
         worth naming, because the numbering is otherwise read as chronology. */
      timelineCard.body.appendChild(U.note(
        "Numbering normally marches up and to the right; a dot that sits below its " +
        "left-hand neighbours was written after the ADRs that outrank it."));
      if (approxPlotted) {
        timelineCard.body.appendChild(U.note(
          approxPlotted + " of " + plottable.length + " plotted dates are derived rather " +
          "than recorded — see Data & theme."));
      }
      if (notPlotted > 0) {
        timelineCard.body.appendChild(U.note(
          "Not plotted: " + U.fmt.plural(notPlotted, "ADR") + " carrying no number or no " +
          "resolvable date (" + undated + " of them undated). All are listed in the " +
          "table below."));
      }
      timelineCard.body.appendChild(wholeProjectNote());
    }

    /* ---- 4. All decisions -------------------------------------------- */

    var listSection = U.section("The record",
      "Every decision and every review checkpoint this run found.");
    root.appendChild(listSection);

    var allCard = U.card("All decisions",
      U.fmt.plural(decisions.length, "ADR") + ", newest number first.", { span: "full" });
    listSection.body.appendChild(allCard);

    if (!decisions.length) {
      allCard.body.appendChild(U.empty("No decision records were found under the workflow " +
        "decisions folder."));
    } else {
      /* Descending by number: a reader scanning this table is asking "what did
         we decide lately", and the newest number answers first. */
      var ordered = decisions.slice().sort(function (a, b) {
        return (b.number || 0) - (a.number || 0);
      });
      allCard.body.appendChild(U.table([
        {
          key: "number", label: "#", align: "right",
          fmt: function (v) { return v == null ? "—" : U.fmt.n(v); }
        },
        {
          key: "title", label: "Title",
          fmt: function (v, row) { return clipped(v || row.slug, 110); }
        },
        {
          key: "status", label: "Status",
          fmt: function (v) { return U.badge(String(v || "unknown"), adrTone(v)); }
        },
        {
          key: "date", label: "Date",
          fmt: function (v, row) { return dateCell(v, row.date_source, row.date_floored); }
        },
        {
          key: "superseded_by", label: "Superseded by",
          fmt: function (v) { return v == null ? "—" : chips(["ADR " + v]); }
        },
        {
          key: "size_bytes", label: "Size", align: "right",
          fmt: function (v) { return U.fmt.bytes(v); }
        }
      ], ordered, { cls: "is-compact" }));
      allCard.body.appendChild(U.note(
        "A ≈ marks a date that was derived from git or the roadmap rather than recorded in " +
        "the file; hover it for which source produced it."));
    }

    var reviewCard = U.card("Review checkpoints", "Sprint-end reviews on record.");
    listSection.body.appendChild(reviewCard);

    if (!reviews.length) {
      reviewCard.body.appendChild(U.empty("Review checkpoints are written at sprint end and " +
        "none has been recorded yet."));
    } else {
      reviewCard.body.appendChild(U.table([
        { key: "id", label: "Id", cls: "pm-mono", fmt: function (v) { return String(v || "—"); } },
        { key: "title", label: "Title", fmt: function (v, row) { return clipped(v || row.id, 110); } },
        {
          key: "date", label: "Date",
          fmt: function (v, row) { return dateCell(v, row.date_source, row.date_floored); }
        },
        {
          key: "size_bytes", label: "Size", align: "right",
          fmt: function (v) { return U.fmt.bytes(v); }
        }
      ], reviews));
    }

    drawStatusMix(listSection.body, decisions);
  };

  /* ----------------------------------------------------------------------
     Decisions by status.

     A bar rather than a donut, deliberately. The same breakdown was a donut in
     the tool this replaces, and the information is identical either way — but
     a donut needs its own arc geometry, this file would be the third copy of
     it, and `README.md`'s rule that views never call each other means a shared
     one cannot be imported. A categorical count is a bar's native shape; the
     ring was the decoration, not the finding.
     ---------------------------------------------------------------------- */

  function drawStatusMix(host, decisions) {
    var card = U.card("Decisions by status",
                      "Every ADR on record, by the status it declares.");
    host.appendChild(card);

    var counts = {};
    (decisions || []).forEach(function (d) {
      var status = (d && d.status) || "unknown";
      counts[status] = (counts[status] || 0) + 1;
    });
    var rows = Object.keys(counts).map(function (status) {
      return { status: status, count: counts[status] };
    }).sort(function (a, b) { return b.count - a.count; });

    if (!rows.length) {
      card.body.appendChild(U.empty("No decision records were found."));
      return;
    }

    var max = rows[0].count;
    var c = PM.svg.chart(card.body, {
      height: 240, xType: "band",
      x: { domain: rows.map(function (r) { return r.status; }), padding: 0.3 },
      y: { domain: [0, max] },
      label: "Decisions by declared status"
    });
    c.yAxis({ ticks: 4, title: "ADRs" });
    c.xAxis({});
    c.bars(rows, {
      x: function (r) { return r.status; },
      y: function (r) { return r.count; },
      cls: function (key, ki, p) { return statusCls(p.status); },
      label: function (r) {
        return [r.status, U.fmt.plural(r.count, "decision")];
      }
    });
    c.done();

    if (counts.unknown) {
      card.body.appendChild(U.note(
        U.fmt.plural(counts.unknown, "decision") + " declares no status this " +
        "reader recognises. That is a gap in the record rather than a neutral " +
        "state, so it is counted under its own label and not folded into " +
        "“proposed”.",
        "warn"
      ));
    }
  }

  /* `superseded` and `rejected` are outcomes, not failures, so neither takes
     the bad tone; `unknown` is the only one that signals something missing. */
  function statusCls(status) {
    if (status === "accepted") return "pm-ok";
    if (status === "superseded" || status === "deprecated") return "pm-a3";
    if (status === "rejected") return "pm-a4";
    if (status === "proposed") return "pm-warn";
    return "pm-muted";
  }
})();
