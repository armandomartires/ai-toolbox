/* ==========================================================================
   27-overview.js — PM.views.overview: the landing tab.

   This tab is the one a reader may not scroll past, so it has to be complete
   on its own terms: where the project stands, what is moving right now, when
   the remaining work plausibly lands, and — as prominently as the rest — what
   the corpus does not actually know. A reader who stops here should not be
   able to form a false picture.

   Two consequences of the module contract (SCHEMA.md §5) are visible below:
     - The burn-up and the velocity bars are re-rendered here from the same
       `metrics` series the Burn and Flow tabs read. That duplication is
       sanctioned: no view may call another view, and a 40-line renderer is
       cheaper than a dependency between two files.
     - Charts are built only after their card is in the document, because
       PM.svg.hostWidth() measures the host's clientWidth and silently falls
       back to 720px for a detached node.
   ========================================================================== */

window.PM = window.PM || {};
PM.views = PM.views || {};

(function () {
  "use strict";

  var U = PM.util;
  var el = U.el;

  /* Tab display names, copied from template.html's tab strip. Every count on
     this tab names the tab that owns its detail, so these strings have to
     match what the reader can actually click. */
  var TAB = {
    burn: "Burn charts",
    flow: "Flow & velocity",
    forecast: "Forecast",
    board: "Board",
    roadmap: "Roadmap",
    deps: "Dependencies",
    debt: "Debt & risk",
    data: "Data & theme"
  };

  /* A chip list longer than this stops being scannable and starts being a
     paragraph of ids; the owning tab holds the full list either way. */
  var CHIP_CAP = 12;

  /* Date sources that are approximate by construction, per SCHEMA.md §1.2.
     `git_added`/`git_last` are trusted unless separately marked floored. */
  var WEAK_SOURCE = { roadmap_sprint: 1, file_mtime: 1 };

  var WHOLE_PROJECT_NOTE =
    "This chart shows the whole project; the sprint and lane filters apply to " +
    "task lists only.";

  /* ----------------------------------------------------------------------
     Small local helpers
     ---------------------------------------------------------------------- */

  /* Null-safe numeric read. Every scalar in the payload may be null, and
     `null > 0` is false while `null + 1` is 1 — so nothing below does
     arithmetic on a value that has not been through this. */
  function num(value) {
    return typeof value === "number" && isFinite(value) ? value : null;
  }

  function intOr(value, fallback) {
    var v = num(value);
    return v == null ? fallback : v;
  }

  function dlRow(dl, term, content) {
    dl.appendChild(el("dt", null, term));
    dl.appendChild(el("dd", null, content));
    return dl;
  }

  /* `items` is [{text, mark}] — `mark` is an optional U.approxMark() node. */
  function chipList(items) {
    var shown = items.slice(0, CHIP_CAP);
    if (items.length > shown.length) {
      shown.push({ text: "+" + (items.length - shown.length) + " more" });
    }
    return el("ul", { class: "pm-chips" }, shown.map(function (item) {
      return el("li", { class: "pm-chip" }, [item.text, item.mark || null]);
    }));
  }

  /* `String(null)` would print the word "null" as if it were an id, so a
     missing id says so instead. */
  function idChips(ids) {
    return chipList((ids || []).map(function (id) {
      return { text: id == null ? "id not recorded" : String(id) };
    }));
  }

  /* The sentence U.approxMark() carries. Returns null when the date is a real
     observation, so a caller can tell "no mark needed" from "mark this". */
  function approxReason(floored, source, what) {
    if (floored) {
      return "This " + what + " is a lower bound: git history begins at the " +
             "migration baseline, so the work may be older. See " + TAB.data + ".";
    }
    if (source && WEAK_SOURCE[source]) {
      return source === "roadmap_sprint"
        ? "This " + what + " is the sprint's date range from the roadmap, not a " +
          "per-task observation. See " + TAB.data + "."
        : "This " + what + " is a filesystem timestamp — the weakest source the " +
          "collector accepts. See " + TAB.data + ".";
    }
    return null;
  }

  function countText(count, tabName) {
    return U.fmt.n(count) + " — see " + tabName;
  }

  /* A sprint may carry neither label nor id in a defective corpus, and
     `String(null)` on a chip would print the word "null" as if it were data. */
  function sprintName(sprint) {
    return sprint.label || sprint.id || "unnamed sprint";
  }

  function periodWord(metrics, count) {
    var unit = metrics.series_granularity === "day" ? "day" : "week";
    return count === 1 ? unit : unit + "s";
  }

  /* ----------------------------------------------------------------------
     1. KPI row
     ---------------------------------------------------------------------- */

  function kpiRow(grid, payload, metrics) {
    /* A tile with no label has nothing to say, and U.kpi() reads `spec.tone`
       unguarded — so a null entry in the array must not reach it. */
    var kpis = ((metrics && metrics.kpis) || []).filter(function (spec) {
      return spec && spec.label;
    });

    if (!kpis.length) {
      /* metrics.kpis is the generator's own display order and the generator
         owns which tiles exist — so this branch is a fallback for a payload
         that shipped none, never a place to add a tile. Everything here is
         derived locally from metrics.totals and says so in its hint. */
      var t = (metrics && metrics.totals) || {};
      var hint = "Derived in the front end because the payload carried no " +
                 "metrics.kpis array.";
      kpis = [
        { key: "completion", label: "Scope complete", value: num(t.completion_pct),
          unit: "%", tone: U.toneFor(num(t.completion_pct), { bad: 40, warn: 70 }),
          sub: U.fmt.n(t.done) + " of " + U.fmt.n(t.tasks) + " briefs closed",
          hint: hint },
        { key: "pending", label: "Pending briefs", value: num(t.pending),
          tone: "neutral",
          sub: U.fmt.n(t.in_progress) + " in progress, " + U.fmt.n(t.blocked) + " blocked",
          hint: hint },
        { key: "sprints", label: "Sprints", value: num(t.sprints), tone: "neutral",
          sub: U.fmt.n(t.sprints_active) + " active, " + U.fmt.n(t.sprints_closed) + " closed",
          hint: hint },
        { key: "defects", label: "Corpus defects", value: (payload.defects || []).length,
          tone: (payload.defects || []).length ? "warn" : "good",
          sub: U.fmt.n(t.unparseable) + " briefs with an unreadable status",
          hint: hint }
      ];
    }

    grid.appendChild(el("div", { class: "pm-kpi-row pm-span-full" },
      kpis.map(function (spec) { return U.kpi(spec); })));
  }

  /* ----------------------------------------------------------------------
     2. Burn-up — the small edition. Full height, burn-down and ideal line
     live on the Burn charts tab.
     ---------------------------------------------------------------------- */

  function burnupCard(grid, payload, metrics, today) {
    var series = (metrics && metrics.burnup) || [];
    var card = U.card(
      "Where the project stands",
      "Cumulative scope against cumulative closed briefs, one point per " +
        periodWord(metrics, 1) + ". The " + TAB.burn +
        " tab carries the full-height version, the burn-down and the ideal line.",
      { span: 2 }
    );
    grid.appendChild(card);

    if (!series.length) {
      card.body.appendChild(U.empty(
        "The burn-up series is empty: no brief in the corpus resolved to a " +
        "usable date this run, so there is no scope or closure to accumulate " +
        "over time."
      ));
      return;
    }

    /* A series of dated points whose counts are all null would otherwise draw
       a pair of axes around nothing — the one failure mode §5.4 forbids. */
    var plottable = series.filter(function (p) {
      return p && p.date && (num(p.scope) != null || num(p.done) != null);
    });
    if (plottable.length < 2) {
      card.body.appendChild(U.empty(
        plottable.length
          ? "The burn-up series has only one period with usable counts, which " +
            "is a reading rather than a trend — the " + TAB.burn +
            " tab lists what the generator emitted."
          : "The burn-up series carries " + series.length + " periods, but not " +
            "one of them pairs a date with a usable scope or done count, so " +
            "there is nothing to plot. See " + TAB.data + "."
      ));
      return;
    }

    /* Everything below reads `plottable`, never `series`: a null entry would
       throw on `p.date`, and a dateless period reaches PM.svg's time scale as
       `null`, which it resolves to the unix epoch — a 1970-to-today x domain
       that squashes every real point onto the right edge. */
    var first = plottable[0].date;
    var last = plottable[plottable.length - 1].date;
    /* Extend the domain to today when the last period predates it, so the
       "today" marker lands inside the plot rather than past its right edge. */
    var end = (today && intOr(U.d.diffDays(last, today), 0) > 0) ? today : last;

    var top = Math.max(
      intOr(U.st.max(plottable.map(function (p) { return num(p.scope); })), 0),
      intOr(U.st.max(plottable.map(function (p) { return num(p.done); })), 0)
    );

    var xOf = function (p) { return p.date; };
    var scopeOf = function (p) { return num(p.scope); };
    var doneOf = function (p) { return num(p.done); };

    var c = PM.svg.chart(card.body, {
      height: 220,
      margin: { t: 12, r: 16, b: 30, l: 40 },
      xType: "time",
      yType: "linear",
      x: { domain: [first, end] },
      y: { domain: [0, top || 1], nice: true },
      label: "Burn-up: cumulative scope and cumulative done over " +
             plottable.length + " " + periodWord(metrics, plottable.length) +
             ", " + U.fmt.date(first) + " to " + U.fmt.date(last)
    });
    c.yAxis({ ticks: 4, grid: true });
    c.xAxis({ ticks: 5, format: U.fmt.date });
    c.area(plottable, { x: xOf, y0: 0, y1: scopeOf, cls: "pm-a7" });
    c.area(plottable, { x: xOf, y0: 0, y1: doneOf, cls: "pm-a2" });
    c.line(plottable, { x: xOf, y: doneOf, cls: "pm-s2", width: 2 });
    if (today && intOr(U.d.diffDays(first, today), -1) >= 0) {
      c.vLine(today, { cls: "pm-ref", label: "today" });
    }
    c.hover(plottable, {
      x: xOf,
      y: doneOf,
      label: function (p) {
        return [
          U.fmt.dateLong(p.date),
          "Scope: " + U.fmt.n(p.scope) + " tasks",
          "Done: " + U.fmt.n(p.done) + " tasks",
          "Remaining: " + U.fmt.n(p.remaining) + " tasks"
        ];
      }
    });
    c.legend([
      { label: "Scope", cls: "pm-a7" },
      { label: "Done", cls: "pm-a2" }
    ]);
    c.done();

    card.body.appendChild(U.note(closureQualitySentence(payload)));
    /* A period the renderer skipped is a gap in the line, which reads as a
       flat week rather than as an absence unless it is named. */
    if (plottable.length !== series.length) {
      card.body.appendChild(U.note(
        (series.length - plottable.length) + " of " + series.length + " " +
        periodWord(metrics, series.length) + " are not plotted: they carry no " +
        "date, or no scope and done count. See " + TAB.data + ".", "warn"
      ));
    }
    card.body.appendChild(U.note(WHOLE_PROJECT_NOTE));
  }

  /* The count is computed from the payload every render — a hardcoded figure
     would be a lie the moment the generator ran again. */
  function closureQualitySentence(payload) {
    var closed = (payload.tasks || []).filter(function (t) {
      return t && t.closed_at;
    });
    var approx = closed.filter(function (t) {
      return approxReason(t.closed_at_floored, t.closed_at_source, "date") != null;
    });
    if (!closed.length) {
      return "No brief in the corpus carries a closure date, so the done line " +
             "is empty rather than flat — see " + TAB.data + ".";
    }
    if (!approx.length) {
      return "All " + closed.length + " closure dates behind this chart are " +
             "hand-recorded or git-observed; none is approximate.";
    }
    /* `approxReason` fires on a floored git date *and* on a sprint-granular or
       mtime one, so this sentence cannot call all of them lower bounds. */
    return approx.length + " of " + closed.length + " closure dates are " +
           "approximate — a lower bound, a sprint date range, or a filesystem " +
           "timestamp rather than an observation. See " + TAB.data + ".";
  }

  /* ----------------------------------------------------------------------
     3. Right now — the live state, as a definition list.
     ---------------------------------------------------------------------- */

  function rightNowCard(grid, payload, metrics, tasks, filtered) {
    var card = U.card(
      "Right now",
      "The work in flight today. Each figure names the tab that owns its detail."
    );
    grid.appendChild(card);

    var byState = function (state) {
      return tasks.filter(function (t) { return t && t.workflow_state === state; });
    };
    var inProgress = byState("in_progress");
    var blocked = byState("blocked");

    var deps = (metrics && metrics.dependencies) || {};
    var readyAll = deps.ready || [];
    /* Under an active filter the frontier is intersected with the visible
       tasks, so the chips below cannot name a task the filter hid. */
    var visible = {};
    tasks.forEach(function (t) { if (t && t.id) visible[t.id] = 1; });
    var ready = filtered
      ? readyAll.filter(function (id) { return visible[id]; })
      : readyAll.slice();

    var activeSprints = (payload.sprints || []).filter(function (s) {
      return s && s.state === "active";
    });
    var openAdhoc = (payload.adhoc || []).filter(function (a) {
      return a && a.state === "open";
    });
    var defects = (payload.defects || []).length;
    var unparseable = intOr((metrics.totals || {}).unparseable,
      (payload.tasks || []).filter(function (t) {
        return t && t.state === "unparseable";
      }).length);

    var dl = el("dl", { class: "pm-dl" });

    dlRow(dl, "In progress", [
      el("div", { text: countText(inProgress.length, TAB.board) }),
      inProgress.length ? wipChips(inProgress) : null
    ]);
    dlRow(dl, "Blocked", [
      el("div", { text: countText(blocked.length, TAB.deps) }),
      blocked.length ? idChips(blocked.map(function (t) { return t.id; })) : null
    ]);
    dlRow(dl, "Ready to start", [
      el("div", { text: countText(ready.length, TAB.deps) }),
      ready.length ? idChips(ready) : null
    ]);
    dlRow(dl, "Active sprints", [
      el("div", { text: countText(activeSprints.length, TAB.roadmap) }),
      activeSprints.length ? idChips(activeSprints.map(sprintName)) : null
    ]);
    dlRow(dl, "Open ad-hoc items", [
      el("div", { text: countText(openAdhoc.length, TAB.debt) }),
      openAdhoc.length ? adhocChips(openAdhoc) : null
    ]);
    dlRow(dl, "Corpus defects", el("div", {
      text: U.fmt.n(defects) + " reported, " +
            U.fmt.plural(unparseable, "unreadable status", "unreadable statuses") +
            " — see " + TAB.data
    }));

    card.body.appendChild(dl);

    if (filtered) {
      card.body.appendChild(U.note(
        "These counts reflect the active sprint and lane filter, not the whole " +
        "corpus. The sprint, ad-hoc and defect rows are project-wide.", "warn"
      ));
    }
  }

  /* In-progress chips carry the task's age, which is a read-out of a derived
     start date — so a weak or floored `created_at` is marked here too. */
  function wipChips(list) {
    return chipList(list.map(function (t) {
      var age = num(t.age_days);
      var reason = approxReason(t.created_at_floored, t.created_at_source, "start date");
      return {
        text: t.id + (age == null ? " · age not known" : " · " + age + "d"),
        mark: age != null && reason ? U.approxMark(reason) : null
      };
    }));
  }

  function adhocChips(list) {
    return chipList(list.map(function (a) {
      var age = num(a.age_days);
      var reason = approxReason(a.found_at_floored, a.found_at_source, "found-during date");
      return {
        text: (a.number == null ? "unnumbered item" : "#" + a.number) +
              (age == null ? "" : " · " + age + "d open"),
        mark: age != null && reason ? U.approxMark(reason) : null
      };
    }));
  }

  /* ----------------------------------------------------------------------
     4. Forecast summary
     ---------------------------------------------------------------------- */

  function forecastCard(grid, metrics, today) {
    var f = (metrics && metrics.forecast) || {};
    var card = U.card(
      "Forecast summary",
      "Monte Carlo over historical weekly throughput. The " + TAB.forecast +
        " tab shows the cone, the histogram and the sample it drew from."
    );
    grid.appendChild(card);

    if (!f.usable) {
      card.body.appendChild(U.empty(
        f.note ||
        "The forecast is unusable: the generator found no weekly-throughput " +
        "sample to simulate from, so no completion date can be offered."
      ));
      return;
    }

    var pct = f.percentiles || {};
    var weeks = f.weeks || {};
    var dl = el("dl", { class: "pm-dl" });

    [["p50", "50% by"], ["p85", "85% by"], ["p95", "95% by"]].forEach(function (pair) {
      var key = pair[0];
      var date = pct[key];
      if (!date) {
        dlRow(dl, pair[1], el("div", { text: "not known — the simulation " +
          "produced no " + key + " date" }));
        return;
      }
      var inDays = num(U.d.diffDays(today, date));
      var suffix = inDays == null ? "" :
        (inDays >= 0 ? " — in " + U.fmt.days(inDays) : " — " + U.fmt.days(-inDays) + " ago");
      var wk = num(weeks[key]);
      dlRow(dl, pair[1], el("div", {
        text: U.fmt.dateLong(date) + suffix +
              (wk == null ? "" : " (" + U.fmt.plural(wk, "week") + " of work)")
      }));
    });

    card.body.appendChild(dl);

    /* A percentile without its n is a guess wearing a number, so the method
       line states every count the simulation rested on — and says which of
       those counts the payload did not report rather than printing a zero. */
    card.body.appendChild(U.note(
      "Method: " + (f.method || "monte_carlo_weekly_throughput") + " — " +
      methodClauses(f).join(", ") + "."
    ));
    if (f.note) card.body.appendChild(U.note(f.note));
  }

  /* The sample sizes behind the forecast, each clause omitted — and named as
     missing — rather than defaulted to zero when the payload lacks it. */
  function methodClauses(f) {
    var out = [];
    var trials = num(f.trials);
    var weeks = num(f.sample_weeks);
    var zero = num(f.zero_weeks);
    var remaining = num(f.remaining);

    out.push(trials == null ? "trial count not reported" : U.fmt.n(trials) + " trials");
    out.push(weeks == null
      ? "sample size not reported"
      : "resampling " + U.fmt.plural(weeks, "historical week") +
        (zero == null ? "" : " (" + U.fmt.n(zero) + " with no closures, kept in the sample)"));
    if (remaining != null) {
      out.push("against " + U.fmt.plural(remaining, "remaining task"));
    }
    return out;
  }

  /* ----------------------------------------------------------------------
     5. Velocity and throughput
     ---------------------------------------------------------------------- */

  function velocityCard(grid, payload, metrics) {
    var vel = (metrics && metrics.velocity) || [];
    var thr = (metrics && metrics.throughput) || [];
    var units = payload.units || {};

    var actions = null;
    if (thr.length > 1) {
      actions = [
        el("span", { class: "pm-chip", text: "closed / week" }),
        PM.svg.sparkline(thr.map(function (p) { return num(p && p.count); }), {
          width: 96, height: 22, cls: "pm-s5",
          label: "Weekly throughput across " + thr.length + " weeks, " +
                 U.fmt.n(U.st.sum(thr.map(function (p) { return intOr(p && p.count, 0); }))) +
                 " closures in total"
        })
      ];
    }

    var card = U.card(
      "Velocity and throughput",
      "Tasks closed per sprint, with the rolling average. " +
        (units.points_available === false
          ? "No brief in this corpus carries an estimate, so the unit is closed tasks."
          : "Unit: " + (units.primary || "tasks") + "."),
      { actions: actions }
    );
    grid.appendChild(card);

    if (!vel.length) {
      card.body.appendChild(U.empty(
        "No sprint has closed a task with a resolvable date, so there is no " +
        "velocity to plot. The " + TAB.flow + " tab shows the same gap in full."
      ));
      return;
    }

    /* A row with no sprint id cannot be placed on the band scale at all, and
       one with no closed count has no bar height — both reach the renderer as
       a null and leave a gap a reader would read as a zero. */
    var rows = vel.filter(function (v) {
      return v && v.sprint_id != null && num(v.closed) != null;
    });
    if (!rows.length) {
      card.body.appendChild(U.empty(
        "The velocity series carries " + U.fmt.plural(vel.length, "entry", "entries") +
        " but not one of them pairs a sprint id with a closed count, so bars " +
        "would be an axis around nothing. See " + TAB.data + "."
      ));
      return;
    }

    var labels = rows.map(function (v) { return v.sprint_id; });
    var top = Math.max(
      intOr(U.st.max(rows.map(function (v) { return num(v.closed); })), 0),
      intOr(U.st.max(rows.map(function (v) { return num(v.rolling_avg); })), 0)
    );
    var idOf = function (v) { return v.sprint_id; };

    var c = PM.svg.chart(card.body, {
      height: 200,
      margin: { t: 10, r: 14, b: 28, l: 36 },
      xType: "band",
      yType: "linear",
      x: { domain: labels, padding: 0.3 },
      y: { domain: [0, top || 1], nice: true },
      label: "Tasks closed per sprint across " + rows.length +
             " sprints, with the rolling average"
    });
    c.yAxis({ ticks: 4, grid: true });
    /* Twenty-plus sprint ids will not fit at this width; the band scale's own
       thinning keeps the first, every nth and the last. */
    c.xAxis({ ticks: 6 });
    c.bars(rows, {
      x: idOf,
      y: function (v) { return num(v.closed); },
      cls: "pm-a1",
      label: function (v) {
        return [
          v.label || v.sprint_id,
          U.fmt.plural(intOr(v.closed, 0), "task") + " closed",
          v.rolling_avg == null ? null : "Rolling average: " + U.fmt.n(v.rolling_avg, 1)
        ];
      }
    });
    c.line(rows, {
      x: idOf,
      y: function (v) { return num(v.rolling_avg); },
      cls: "pm-s2",
      width: 2
    });
    c.legend([
      { label: "Closed per sprint", cls: "pm-a1" },
      { label: "Rolling average", cls: "pm-s2" }
    ]);
    c.done();

    var avg = num(metrics.velocity_avg);
    var sd = num(metrics.velocity_stddev);
    card.body.appendChild(U.note(
      (avg == null
        ? "The generator reported no average velocity."
        : "Average " + U.fmt.n(avg, 1) + " tasks per sprint across " +
          U.fmt.plural(vel.length, "sprint") + " with at least one closure" +
          (sd == null ? "." : " (sd " + U.fmt.n(sd, 1) + ").")) +
      (thr.length > 1
        ? " The header sparkline is the same work counted weekly, over " +
          U.fmt.plural(thr.length, "week") + "."
        : "")
    ));
    /* The average above is the generator's, taken over every row it emitted;
       saying so beside a chart that drew fewer bars is the honest reading. */
    if (rows.length !== vel.length) {
      card.body.appendChild(U.note(
        (vel.length - rows.length) + " of " + vel.length + " velocity rows are " +
        "not plotted: they carry no sprint id, or no closed count. See " +
        TAB.data + ".", "warn"
      ));
    }
    card.body.appendChild(U.note(WHOLE_PROJECT_NOTE));
  }

  /* ----------------------------------------------------------------------
     6. Sprint progress
     ---------------------------------------------------------------------- */

  var SPRINT_CAP = 10;

  function sprintProgressCard(grid, payload) {
    var sprints = (payload.sprints || []).filter(function (s) {
      return s && s.has_briefs;
    });
    var card = U.card(
      "Sprint progress",
      "Completion by sprint, most recent first. Only sprints that have briefs " +
        "appear; a planned sprint with none is on the " + TAB.roadmap + " tab.",
      { span: 2 }
    );
    grid.appendChild(card);

    if (!sprints.length) {
      card.body.appendChild(U.empty(
        "No sprint in the corpus has a task brief yet, so there is no " +
        "completion to measure — the " + TAB.roadmap + " tab lists what is planned."
      ));
      return;
    }

    sprints.sort(function (a, b) {
      var x = String(a.id || ""), y = String(b.id || "");
      return x < y ? 1 : (x > y ? -1 : 0);
    });
    var shown = sprints.slice(0, SPRINT_CAP);

    card.body.appendChild(el("div", { class: "pm-timeline" },
      shown.map(sprintRow)));

    if (sprints.length > shown.length) {
      card.body.appendChild(U.note(
        shown.length + " of " + sprints.length + " sprints with briefs shown; " +
        "the remaining " + (sprints.length - shown.length) + " are on the " +
        TAB.roadmap + " tab."
      ));
    }
    card.body.appendChild(U.note(
      "Fill colour is the sprint's state, not its number: green a closed " +
      "sprint with every brief closed, red a closed sprint that left briefs " +
      "open, amber a sprint still in flight, plain a planned one."
    ));
    card.body.appendChild(U.note(WHOLE_PROJECT_NOTE));
  }

  /* PM.util.stateTone() maps `active` to `info`, and `.pm-progress-fill` has
     no is-info variant — so this mapping is local and deliberately about the
     sprint's outcome rather than its label. */
  function sprintFillClass(sprint) {
    var pct = num(sprint.completion_pct);
    if (sprint.state === "closed") {
      return pct != null && pct >= 100 ? " is-good" : " is-bad";
    }
    if (sprint.state === "active") return " is-warn";
    return "";
  }

  function sprintRow(sprint) {
    var pct = num(sprint.completion_pct);
    var width = pct == null ? 0 : Math.max(0, Math.min(100, pct));
    var label = sprintName(sprint);
    var counts = U.fmt.n(sprint.done_count) + "/" + U.fmt.n(sprint.task_count);
    /* A defective corpus can omit the state, and concatenating `undefined`
       into a title reads as though "undefined" were the sprint's state. */
    var state = sprint.state || "state not recorded";

    /* Geometry only — the track is declared `position: relative` in
       20-components.css precisely so a child can be placed inside it, and the
       numeric label needs room the bar must not grow into. No colour here. */
    var bar = el("div", {
      class: "pm-progress",
      style: { position: "absolute", left: "0", right: "7rem", top: "6px" }
    }, el("div", {
      class: "pm-progress-fill" + sprintFillClass(sprint),
      style: { width: width + "%" }
    }));

    var readout = el("span", {
      class: "pm-mono pm-nowrap",
      style: { position: "absolute", right: "0", top: "0" },
      text: (pct == null ? "—" : U.fmt.pct(pct, 0)) + " · " + counts
    });

    return el("div", { class: "pm-trow" }, [
      el("div", { class: "pm-trow-label", title: label + " — " + state, text: label }),
      el("div", {
        class: "pm-trow-track",
        "aria-label": label + ": " + counts + " briefs closed, " + state
      }, [bar, readout])
    ]);
  }

  /* ----------------------------------------------------------------------
     7. Health — derived checks, each stating the evidence it read.

     Checks are an array of {label, tone, sentence} built by the five
     functions below, so adding a sixth is one push() plus one function.
     ---------------------------------------------------------------------- */

  function healthCard(grid, payload, metrics) {
    var checks = [
      scopeStabilityCheck(metrics),
      flowCheck(metrics),
      forecastConfidenceCheck(metrics),
      dataQualityCheck(payload, metrics),
      conformanceCheck(payload, metrics)
    ];

    var card = U.card(
      "Health",
      checks.length + " checks derived from the payload. Each sentence states " +
        "what it read, not just a verdict; every one of them is whole-project " +
        "and ignores the sprint and lane filters."
    );
    grid.appendChild(card);

    var dl = el("dl", { class: "pm-dl" });
    checks.forEach(function (chk) {
      dlRow(dl, U.badge(chk.label, chk.tone), el("div", { text: chk.sentence }));
    });
    card.body.appendChild(dl);
  }

  function scopeStabilityCheck(metrics) {
    var churn = (metrics && metrics.scope_churn) || [];
    if (!churn.length) {
      return { label: "Scope stability", tone: "neutral",
        sentence: "The scope-churn series is empty, so arrivals cannot be " +
                  "compared against departures this run." };
    }
    var recent = churn.slice(Math.max(0, churn.length - 4));
    /* All-null counts would sum to a confident zero and be reported as good
       health derived from no evidence at all. */
    if (!recent.some(function (p) {
      return p && (num(p.added) != null || num(p.closed) != null || num(p.net) != null);
    })) {
      return { label: "Scope stability", tone: "neutral",
        sentence: "The scope-churn series names " +
                  U.fmt.plural(churn.length, "period") + " but carries no " +
                  "arrival or closure count in the last " + recent.length + " " +
                  periodWord(metrics, recent.length) +
                  ", so stability cannot be judged." };
    }
    var added = U.st.sum(recent.map(function (p) { return intOr(p && p.added, 0); }));
    var closed = U.st.sum(recent.map(function (p) { return intOr(p && p.closed, 0); }));
    var net = U.st.sum(recent.map(function (p) { return intOr(p && p.net, 0); }));

    /* Growth is only alarming relative to delivery: +3 against 20 closed is
       noise, +3 against 1 closed is a project going backwards. */
    var tone = net <= 0 ? "good" : (net > closed ? "bad" : "warn");
    var verdict = net <= 0
      ? " Scope is not outrunning delivery."
      : (net > closed
          ? " Scope is growing faster than it is being delivered."
          : " Scope grew, but by less than was delivered.");

    return { label: "Scope stability", tone: tone,
      sentence: "Over the last " + recent.length + " " +
                periodWord(metrics, recent.length) + ", " +
                U.fmt.plural(added, "brief") + " arrived and " +
                U.fmt.n(closed) + " closed, a net " +
                (net > 0 ? "+" : "") + U.fmt.n(net) + "." + verdict };
  }

  function flowCheck(metrics) {
    var ct = (metrics && metrics.cycle_time) || {};
    var p85 = num(ct.p85);
    var n = intOr(ct.n, 0);
    var wip = ((metrics && metrics.aging_wip) || []).filter(function (w) {
      return w && w.workflow_state === "in_progress";
    });

    if (!wip.length) {
      return { label: "Flow", tone: n ? "good" : "neutral",
        sentence: "Nothing is in flight: no pending brief reports an " +
                  "in-progress status" +
                  (p85 == null
                    ? " and the corpus has no cycle-time sample to compare against."
                    : ", so the p85 cycle time of " + U.fmt.days(p85) +
                      " (n = " + n + ") has nothing to flag.") };
    }
    if (p85 == null || !n) {
      return { label: "Flow", tone: "neutral",
        sentence: U.fmt.plural(wip.length, "task") + " in flight, but the " +
                  "corpus has no cycle-time baseline (n = " + n + " closed " +
                  "briefs with a usable cycle time), so there is nothing to " +
                  "judge them against. See " + TAB.board + "." };
    }

    var over = wip.filter(function (w) {
      var age = num(w.age_days);
      return age != null && age > p85;
    });
    var tone = !over.length ? "good" : (over.length * 2 > wip.length ? "bad" : "warn");
    return { label: "Flow", tone: tone,
      sentence: U.fmt.plural(wip.length, "task") + " in flight; " + over.length +
                " already older than the p85 cycle time of " + U.fmt.days(p85) +
                " (n = " + n + " closed briefs)" +
                (over.length
                  ? ": " + over.map(function (w) { return w.id; }).join(", ") + "."
                  : ".") + " See " + TAB.board + "." };
  }

  function forecastConfidenceCheck(metrics) {
    var f = (metrics && metrics.forecast) || {};
    if (!f.usable) {
      return { label: "Forecast confidence", tone: "neutral",
        sentence: (f.note || "The forecast is unusable.") +
                  " With no simulation there is no confidence band to report." };
    }
    var pct = f.percentiles || {};
    var spread = num(U.d.diffDays(pct.p50, pct.p95));
    if (spread == null) {
      return { label: "Forecast confidence", tone: "neutral",
        sentence: "The simulation ran but did not return both a p50 and a p95 " +
                  "date, so its spread cannot be measured." };
    }
    var tone = spread <= 21 ? "good" : (spread <= 56 ? "warn" : "bad");
    var verdict = spread <= 21
      ? " That is a tight band."
      : (spread <= 56
          ? " That is a wide band — treat any single date as indicative."
          : " That is very wide: the p95 date is not a plan, it is an outer bound.");
    var trials = num(f.trials);
    var weeks = num(f.sample_weeks);
    return { label: "Forecast confidence", tone: tone,
      sentence: "The p50 and p95 dates are " + U.fmt.days(spread) + " apart (" +
                U.fmt.dateLong(pct.p50) + " to " + U.fmt.dateLong(pct.p95) +
                "), simulated from " +
                (trials == null ? "an unreported number of trials"
                                : U.fmt.n(trials) + " trials") + " over " +
                (weeks == null ? "an unreported sample"
                               : U.fmt.plural(weeks, "historical week")) + "." +
                verdict };
  }

  function dataQualityCheck(payload, metrics) {
    var t = (metrics && metrics.totals) || {};
    var prov = payload.provenance || {};
    var all = num(t.tasks);
    var dated = num(t.tasks_with_dates);
    var floored = intOr(prov.floored_dates, 0);

    if (!all || dated == null) {
      return { label: "Data quality", tone: "neutral",
        sentence: "The payload did not report how many briefs resolved to a " +
                  "date, so date coverage is unknown. See " + TAB.data + "." };
    }
    var share = (dated / all) * 100;
    return { label: "Data quality", tone: U.toneFor(share, { bad: 80, warn: 95 }),
      sentence: U.fmt.n(dated) + " of " + U.fmt.n(all) + " briefs (" +
                U.fmt.pct(share) + ") resolved to a date, and " +
                U.fmt.n(floored) + " dates across the corpus are lower bounds " +
                "rather than observations. " + TAB.data +
                " names the source of every one." };
  }

  function conformanceCheck(payload, metrics) {
    var t = (metrics && metrics.totals) || {};
    var defects = (payload.defects || []).length;
    var unparseable = intOr(t.unparseable,
      (payload.tasks || []).filter(function (task) {
        return task && task.state === "unparseable";
      }).length);

    if (!defects && !unparseable) {
      return { label: "Corpus conformance", tone: "good",
        sentence: "The collector reported no corpus defects and read a status " +
                  "line from every brief." };
    }
    return { label: "Corpus conformance", tone: unparseable ? "bad" : "warn",
      sentence: U.fmt.plural(defects, "corpus defect") + " reported and " +
                U.fmt.plural(unparseable, "brief") + " with a status the " +
                "collector could not parse. A brief it cannot read is counted " +
                "nowhere else on this tab. See " + TAB.data + "." };
  }

  /* ----------------------------------------------------------------------
     8. Data caveats — last, span full, and not compressed. A reader who
     skips this over-reads every figure above it.
     ---------------------------------------------------------------------- */

  function caveatsCard(grid, payload) {
    var prov = payload.provenance || {};
    var notes = prov.notes || [];
    var units = payload.units || {};

    var card = U.card(
      "Data caveats",
      "Read this before quoting any number above. The " + TAB.data +
        " tab carries the full provenance breakdown.",
      { span: "full" }
    );
    grid.appendChild(card);

    if (notes.length) {
      /* The global reset strips list markers; these are genuinely separate
         caveats rather than one paragraph, so the markers come back locally. */
      card.body.appendChild(el("ul", {
        style: { "list-style": "disc", "padding-left": "1.2rem" }
      }, notes.map(function (sentence) {
        return el("li", null, U.note(String(sentence)));
      })));
    } else {
      card.body.appendChild(U.note(
        "The generator recorded no caveat sentences for this run. That is not " +
        "the same as there being none — see " + TAB.data + " for the date-source " +
        "breakdown it did record."
      ));
    }

    var primary = units.primary || "tasks";
    card.body.appendChild(U.note(
      "Unit: every figure on this dashboard counts " + primary + "."
    ));
    if (units.points_available === false) {
      card.body.appendChild(U.note(
        "This corpus records no estimates. No brief carries an explicit size, " +
        "so nothing here is estimated work: a burn-up of tasks counts a " +
        "one-line brief and a month-long brief as one apiece, and the " +
        "velocity figure is a count, not a capacity.", "warn"
      ));
    } else if (num(units.points_coverage) != null && units.points_coverage < 1) {
      card.body.appendChild(U.note(
        "Points are present on only " + U.fmt.pct(units.points_coverage * 100) +
        " of briefs, so the headline numbers stay in tasks — a partial points " +
        "total would mean nothing.", "warn"
      ));
    }
    if (units.size_proxy_note) {
      card.body.appendChild(U.note(String(units.size_proxy_note)));
    }
  }

  /* ----------------------------------------------------------------------
     The view
     ---------------------------------------------------------------------- */

  PM.views.overview = function (root, data) {
    /* PM.app hands over an emptied panel, but it also re-calls this on theme
       change and on resize — clearing here is what makes a third call
       identical to the first. */
    U.clear(root);

    var payload = data || {};
    var metrics = payload.metrics || {};
    var today = (payload.project && payload.project.today) || metrics.as_of || null;
    var tasks = (PM.app && PM.app.applyFilter)
      ? PM.app.applyFilter(payload.tasks || [])
      : (payload.tasks || []);
    var filter = (PM.app && PM.app.filter) || { sprint: "all", lane: "all" };
    var filtered = (filter.sprint && filter.sprint !== "all") ||
                   (filter.lane && filter.lane !== "all");

    /* SCHEMA.md §1: a consumer reading an unexpected major version says so
       rather than rendering a confident guess over fields it invented. */
    if (payload.schema_version != null && payload.schema_version !== 1) {
      root.appendChild(U.note(
        "This tab implements payload schema version 1, but the data says " +
        "version " + String(payload.schema_version) + ". Fields may be " +
        "missing or renamed; treat everything below as unverified.", "bad"
      ));
    }

    var window_ = metrics.window || {};
    var standing = U.section(
      "Where the project stands",
      "Every figure is derived from " +
        ((payload.project && payload.project.workflow_dir) || "the workflow corpus") +
        " as of " + U.fmt.dateLong(today) +
        (window_.start && window_.end
          ? ", over a window of " + U.fmt.dateLong(window_.start) + " to " +
            U.fmt.dateLong(window_.end) + "."
          : ".")
    );
    /* Appended before the charts are built: PM.svg measures the host, and a
       detached card measures zero. */
    root.appendChild(standing);
    kpiRow(standing.body, payload, metrics);
    burnupCard(standing.body, payload, metrics, today);
    rightNowCard(standing.body, payload, metrics, tasks, filtered);
    forecastCard(standing.body, metrics, today);

    var delivery = U.section(
      "Delivery",
      "Closure rate by sprint and by week, and how far each sprint with briefs got."
    );
    root.appendChild(delivery);
    velocityCard(delivery.body, payload, metrics);
    sprintProgressCard(delivery.body, payload);
    criteriaCard(delivery.body, metrics);

    var honesty = U.section(
      "Health and what is not known",
      "Derived checks, then the caveats that qualify every number on this tab."
    );
    root.appendChild(honesty);
    healthCard(honesty.body, payload, metrics);
    caveatsCard(honesty.body, payload);
  };

  /* ----------------------------------------------------------------------
     Acceptance criteria met, per sprint.

     Rendered only where a project actually writes checkboxes. A corpus that
     records none would otherwise get a chart of zeros, which reads as "nothing
     passed" rather than "this is not recorded here" — the difference between a
     finding and an absence, and the one this dashboard exists to keep straight.
     ---------------------------------------------------------------------- */

  function criteriaCard(host, metrics) {
    var criteria = (metrics && metrics.criteria) || {};
    if (!criteria.recorded) return;

    var rows = (criteria.by_sprint || []).filter(function (r) {
      return r && r.total;
    });
    if (!rows.length) return;

    var card = U.card(
      "Acceptance criteria met",
      U.fmt.n(criteria.checked || 0) + " of " + U.fmt.n(criteria.total || 0) +
        " boxes ticked across " + U.fmt.plural(criteria.tasks_with_criteria || 0, "brief")
    );
    host.appendChild(card);

    var max = 0;
    rows.forEach(function (r) { if (r.total > max) max = r.total; });

    var c = PM.svg.chart(card.body, {
      height: 250, xType: "band",
      x: { domain: rows.map(function (r) { return r.sprint; }), padding: 0.25 },
      y: { domain: [0, max || 1] },
      label: "Acceptance criteria recorded and ticked, per sprint"
    });
    c.yAxis({ ticks: 4, title: "checkboxes" });
    c.xAxis({ anchor: "end" });
    c.bars(rows, {
      x: function (r) { return r.sprint; },
      keys: ["total", "checked"],
      cls: function (key) { return key === "total" ? "pm-a3" : "pm-a2"; },
      label: function (r, key) {
        return [r.sprint, key + ": " + U.fmt.n(r[key] || 0),
                r.total ? U.fmt.pct((r.checked / r.total) * 100) + " ticked" : ""];
      }
    });
    c.legend([
      { label: "recorded", cls: "pm-a3", value: criteria.total },
      { label: "ticked", cls: "pm-a2", value: criteria.checked }
    ]);
    c.done();

    card.body.appendChild(U.note(
      "An unticked box is not a failed check. Briefs are routinely written " +
      "with their criteria unticked and closed on the evidence in the " +
      "execution log instead, so this measures how consistently the checklist " +
      "itself is kept — not whether the work was verified."
    ));
  }
})();
