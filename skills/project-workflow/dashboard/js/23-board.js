/* ==========================================================================
   23-board.js — PM.views.board and PM.views.roadmap.

   Two tabs that answer "what is in flight?" and "how did the sprints run?".
   Both are built out of the same task/sprint entities, so they live in one
   file; neither calls the other, and neither calls any other view module
   (SCHEMA.md §5).

   Two constraints shape everything below:

     - The board is about individual briefs, so it renders
       PM.app.applyFilter(data.tasks). The state donut and the lane split are
       pre-aggregated metrics series covering the whole corpus, so they render
       as given and say so — a filtered column next to an unfiltered chart
       with no label is a lie the reader cannot detect.
     - Every task date in this corpus is derived, not recorded, and carries
       its own `*_source` / `*_floored` pair (SCHEMA.md §1.2). Wherever a date
       is shown it is marked when it is a lower bound rather than an
       observation, and the counts under the board are computed from the
       payload, never written down.
   ========================================================================== */

window.PM = window.PM || {};
PM.views = PM.views || {};

(function () {
  "use strict";

  var U = PM.util;
  var el = U.el;

  /* The four columns, in the order work moves through them. Keyed on
     `workflow_state` rather than `state`: `state` only separates done from
     pending, which is a tally, not a board. */
  var COLUMNS = [
    { key: "not_started", label: "Not started" },
    { key: "blocked",     label: "Blocked" },
    { key: "in_progress", label: "In progress" },
    { key: "done",        label: "Done" }
  ];

  /* 105 of 118 briefs are done. Rendering all of them in one column produces a
     page-long scroll that hides the three columns that matter. */
  var DONE_CAP = 20;

  var STATE_CLS = {
    done: "pm-a2", in_progress: "pm-a1", blocked: "pm-a6",
    not_started: "pm-a7",
    /* `unparseable` is a corpus defect, not a column anyone plans into — it
       gets the warn-ish ramp step rather than one of the four board colours. */
    unparseable: "pm-a4"
  };

  var SPRINT_CLS = { closed: "pm-a2", active: "pm-a1", planned: "pm-a7" };

  /* A lane is a capability constraint, not a status. Operator and hardware
     work cannot be executed on this machine at all, which is a real blocker
     for anyone reading the board, so those two read as warn. */
  var LANE_TONES = { code: "neutral", model: "info", operator: "warn", hardware: "warn" };

  var LANE_NOTE =
    "Lanes are capability constraints: code = no model needed; model = needs a " +
    "loaded local model, serialised one at a time; operator = needs a human " +
    "action no agent can take; hardware = needs a device this machine is not.";

  var FILTER_NOTE =
    "This chart shows the whole project; the sprint and lane filters apply to " +
    "task lists only.";

  /* Sources that cannot name a day. `roadmap_sprint` gives a task the window
     of its whole sprint; `file_mtime` is the last resort when git is absent. */
  var WEAK_DATE_SOURCES = {
    roadmap_sprint: "its sprint's date range, not a day",
    file_mtime: "the file's modification time, the weakest source available"
  };

  /* ----------------------------------------------------------------------
     Shared readers. Every one of these tolerates a missing field, because a
     brief with no lane, no dates and no dependencies is a real row in this
     corpus rather than a malformed one.
     ---------------------------------------------------------------------- */

  function stateCls(state, index) {
    return STATE_CLS[state] || ("pm-a" + (((index || 0) % 8) + 1));
  }

  function laneTone(lane) {
    return LANE_TONES[lane] || "neutral";
  }

  function laneName(lane) {
    return lane ? String(lane) : "no lane";
  }

  /* Returns the sentence explaining why a date is approximate, or null when it
     is an observation. Drives U.approxMark and every "N of M" count below. */
  function approxReason(obj, field) {
    if (!obj || obj[field] == null) return null;
    var source = obj[field + "_source"] || "unknown";
    if (obj[field + "_floored"]) {
      return "Lower bound: this date sits on the git baseline, so the work may " +
             "be older than it looks. Resolved from " + source +
             ". See the Data & theme tab.";
    }
    if (WEAK_DATE_SOURCES[source]) {
      return "Approximate: resolved from " + WEAK_DATE_SOURCES[source] +
             ". See the Data & theme tab.";
    }
    return null;
  }

  function dateWithSource(obj, field) {
    if (!obj || obj[field] == null) {
      return "not known (" + ((obj && obj[field + "_source"]) || "unknown") + ")";
    }
    return U.fmt.date(obj[field]) + " from " + (obj[field + "_source"] || "unknown") +
           (obj[field + "_floored"] ? ", floored" : "");
  }

  function countApprox(tasks, field) {
    var n = 0;
    tasks.forEach(function (t) { if (approxReason(t, field)) n++; });
    return n;
  }

  /* The denominator for any "N of M dates are lower bounds" claim. The set
     being counted out of is the dates that exist, not the briefs that might
     have had one: a done brief with a null `closed_at` contributes no closure
     date, so counting it would understate the share that is approximate. */
  function countDated(tasks, field) {
    var n = 0;
    tasks.forEach(function (t) { if (t && t[field] != null) n++; });
    return n;
  }

  function countState(tasks, state) {
    var n = 0;
    tasks.forEach(function (t) { if (t.workflow_state === state) n++; });
    return n;
  }

  function countUnparseable(tasks) {
    var n = 0;
    tasks.forEach(function (t) {
      if (t.state === "unparseable" || t.workflow_state === "unparseable") n++;
    });
    return n;
  }

  /* A brief whose `workflow_state` names none of the four columns — an
     unreadable status, or a state added to the generator and not here — lands
     in no column at all. The card above the board states a total, so without
     this count the four column headings silently fail to add up to it. */
  function countOffBoard(tasks) {
    var n = 0;
    tasks.forEach(function (t) {
      var placed = false;
      COLUMNS.forEach(function (col) {
        if (t && t.workflow_state === col.key) placed = true;
      });
      if (!placed) n++;
    });
    return n;
  }

  /* U.fmt.plural agrees the noun with the count; the verb has to agree too, or
     every one-item case reads "1 sprint have no start date". */
  function have(count) { return Math.abs(count) === 1 ? "has" : "have"; }
  function are(count) { return Math.abs(count) === 1 ? "is" : "are"; }

  /* "14 of 105 closure dates are lower bounds" / "1 of 105 closure dates is a
     lower bound" — the verb and its object both track the leading count, while
     the noun stays plural because it names the set being counted out of. */
  function boundsNote(count, total, noun, tail) {
    return U.fmt.n(count) + " of " + U.fmt.n(total) + " " + noun + " " +
           are(count) + (count === 1 ? " a lower bound" : " lower bounds") + tail;
  }

  function chip(text, cls, title) {
    return el("span", {
      class: "pm-chip" + (cls ? " " + cls : ""),
      title: title || false,
      text: String(text)
    });
  }

  /* Blocker chips carry their meaning in a title, not in the `is-bad` tone
     alone: a chip id on its own does not say why it is listed, and colour is
     never the only channel (SCHEMA.md §5.4). */
  function blockerChip(id) {
    return chip(id, "is-bad", "Unmet dependency: " + id + " is not done yet");
  }

  function chips(ids, cls) {
    if (!ids || !ids.length) return null;
    return el("div", { class: "pm-chips" }, ids.map(function (id) {
      return chip(id, cls);
    }));
  }

  function blockerChips(ids) {
    if (!ids || !ids.length) return null;
    return el("div", { class: "pm-chips" }, ids.map(blockerChip));
  }

  /* Done newest-first, nulls last: a column ordered by "when did this close"
     puts the most recent decision at the top, which is what a reviewer wants. */
  function byClosedDesc(a, b) {
    var ta = U.d.parse(a.closed_at), tb = U.d.parse(b.closed_at);
    if (!ta && !tb) return byId(a, b);
    if (!ta) return 1;
    if (!tb) return -1;
    return tb.getTime() - ta.getTime();
  }

  /* Pending oldest-first: age descending is the order that surfaces a stalled
     item at the top of the column instead of burying it. */
  function byAgeDesc(a, b) {
    var aa = a.age_days == null ? -1 : a.age_days;
    var ab = b.age_days == null ? -1 : b.age_days;
    if (ab !== aa) return ab - aa;
    return byId(a, b);
  }

  function byId(a, b) {
    return String(a.id || "").localeCompare(String(b.id || ""));
  }

  /* ----------------------------------------------------------------------
     A ticket. The tooltip carries the whole brief header, because the card
     itself only has room for three lines and the status line is the single
     most useful thing in the payload.
     ---------------------------------------------------------------------- */

  function ticket(task) {
    var pending = task.workflow_state !== "done";
    var dateField = pending ? "created_at" : "closed_at";
    var reason = approxReason(task, dateField);
    var blockers = task.blocked_by_unmet || [];
    var title = task.title || U.fmt.deCamel(task.name) || String(task.id || "");

    var when;
    if (pending) {
      when = task.age_days == null ? "age not known" : U.fmt.days(task.age_days);
    } else {
      when = task.closed_at == null ? "closed, date not known" : U.fmt.date(task.closed_at);
    }

    var meta = el("div", { class: "pm-ticket-meta" }, [
      U.badge(laneName(task.lane), laneTone(task.lane)),
      task.sprint_id ? chip(task.sprint_id) : null,
      el("span", { class: "pm-ticket-date", text: when }),
      reason ? U.approxMark(reason) : null
    ]);
    blockers.forEach(function (id) {
      meta.appendChild(blockerChip(id));
    });

    var node = el("article", {
      class: "pm-ticket" +
             (task.workflow_state === "blocked" ? " is-blocked" : "") +
             (task.workflow_state === "in_progress" ? " is-progress" : ""),
      "aria-label": task.id + ": " + title + " — " +
                    U.stateLabel(task.workflow_state) + ", " + when
    }, [
      el("code", { class: "pm-ticket-id", text: String(task.id || "—") }),
      el("div", { class: "pm-ticket-title", text: title }),
      meta
    ]);

    PM.svg.bindTip(node, [
      String(task.id || "—") + " — " + title,
      U.stateLabel(task.workflow_state) + " · lane " + laneName(task.lane),
      "Sprint: " + (task.sprint_id || "none") +
        (task.sprint ? " " + U.fmt.deCamel(task.sprint) : ""),
      "Status line: " + U.fmt.truncate(task.status_raw || "not recorded", 180),
      "Created: " + dateWithSource(task, "created_at"),
      "Closed: " + dateWithSource(task, "closed_at"),
      (task.depends_on && task.depends_on.length)
        ? "Depends on: " + task.depends_on.join(", ")
        : "Depends on nothing",
      (task.blocks && task.blocks.length)
        ? "Blocks: " + task.blocks.join(", ")
        : "Blocks nothing",
      blockers.length ? "Unmet: " + blockers.join(", ") : null,
      task.commit_count ? U.fmt.plural(task.commit_count, "commit") : "No commit recorded"
    ]);

    return node;
  }

  function boardNode(tasks) {
    var board = el("div", { class: "pm-board" });

    COLUMNS.forEach(function (col) {
      var items = tasks.filter(function (t) { return t.workflow_state === col.key; });
      items.sort(col.key === "done" ? byClosedDesc : byAgeDesc);
      var shown = col.key === "done" ? items.slice(0, DONE_CAP) : items;

      var column = el("div", { class: "pm-col", dataset: { state: col.key } }, [
        el("div", { class: "pm-col-head" }, [
          col.label,
          el("span", { class: "pm-col-count", text: U.fmt.n(items.length) })
        ])
      ]);

      if (!items.length) {
        column.appendChild(U.empty(
          "No brief sits in " + col.label.toLowerCase() +
          " under the current sprint and lane filters."
        ));
      } else {
        /* `.pm-cards` is the flex stack that gives the tickets their gap; the
           head and the overflow note sit outside it. */
        var stack = el("div", { class: "pm-cards" });
        shown.forEach(function (t) { stack.appendChild(ticket(t)); });
        column.appendChild(stack);
        if (items.length > shown.length) {
          var hiddenHere = items.length - shown.length;
          column.appendChild(U.note(
            U.fmt.plural(hiddenHere, "more closed brief") + " " + are(hiddenHere) +
            " not shown here — this column is capped at the " + DONE_CAP +
            " most recent closures. Every one of them is in the All briefs table below."
          ));
        }
      }

      board.appendChild(column);
    });

    return board;
  }

  /* ----------------------------------------------------------------------
     State donut. There is no donut primitive in PM.svg, so this draws its own
     arcs into a bare PM.svg.raw canvas.
     ---------------------------------------------------------------------- */

  function polar(cx, cy, r, angle) {
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  }

  /* Angles are radians clockwise from 12 o'clock (so -PI/2 is the top). The
     sweep is emitted in quarter-turn segments because one SVG arc command
     spanning a full circle has identical start and end points and renders as
     nothing at all — which is exactly the single-state case. */
  function describeArc(cx, cy, rOuter, rInner, a0, a1) {
    var sweep = a1 - a0;
    if (!isFinite(sweep) || sweep <= 0) return "";
    var steps = Math.max(1, Math.ceil(sweep / (Math.PI / 2)));
    var parts = [];
    var p = polar(cx, cy, rOuter, a0);
    var i;

    parts.push("M" + p.x.toFixed(2) + "," + p.y.toFixed(2));
    for (i = 1; i <= steps; i++) {
      p = polar(cx, cy, rOuter, a0 + (sweep * i) / steps);
      parts.push("A" + rOuter.toFixed(2) + "," + rOuter.toFixed(2) +
                 " 0 0 1 " + p.x.toFixed(2) + "," + p.y.toFixed(2));
    }
    p = polar(cx, cy, rInner, a1);
    parts.push("L" + p.x.toFixed(2) + "," + p.y.toFixed(2));
    for (i = 1; i <= steps; i++) {
      p = polar(cx, cy, rInner, a1 - (sweep * i) / steps);
      parts.push("A" + rInner.toFixed(2) + "," + rInner.toFixed(2) +
                 " 0 0 0 " + p.x.toFixed(2) + "," + p.y.toFixed(2));
    }
    parts.push("Z");
    return parts.join(" ");
  }

  function drawStateDonut(host, states) {
    var rows = (states || []).filter(function (s) {
      return s && s.state != null && (s.count || 0) > 0;
    });

    if (!rows.length) {
      host.appendChild(U.empty(
        "metrics.states is empty or every count is zero — the collector found " +
        "no brief it could classify, so there is no distribution to draw."
      ));
      return;
    }

    var total = U.st.sum(rows.map(function (s) { return s.count || 0; }));
    var r = PM.svg.raw(host, {
      height: 260,
      label: "State distribution of " + U.fmt.n(total) + " briefs across " +
             U.fmt.plural(rows.length, "state")
    });
    var cx = r.width / 2;
    var cy = r.height / 2;
    var rOuter = Math.max(36, Math.min(r.width, r.height) / 2 - 14);
    var rInner = rOuter * 0.62;
    var angle = -Math.PI / 2;

    rows.forEach(function (s, i) {
      var count = s.count || 0;
      var sweep = (count / total) * Math.PI * 2;
      var arc = el("path", {
        /* `pm-bar`, not `pm-area`: 30-charts.css paints areas at 18-26%
           fill-opacity so two stacked bands stay readable, and a donut is
           never layered — at that weight the ring all but disappears. A bar
           is the mark this actually is: one solid, unlayered wedge. */
        class: "pm-bar " + stateCls(s.state, i),
        d: describeArc(cx, cy, rOuter, rInner, angle, angle + sweep)
      });
      PM.svg.bindTip(arc, [
        U.stateLabel(s.state),
        U.fmt.plural(count, "brief"),
        U.fmt.pct((count / total) * 100) + " of " + U.fmt.n(total)
      ]);
      r.g.appendChild(arc);
      angle += sweep;
    });

    /* `currentColor` rather than a token: SVG text defaults to black fill,
       which vanishes in the dark theme, and a module may not name a colour. */
    r.g.appendChild(el("text", {
      class: "pm-donut-total", x: cx, y: cy - 2,
      "text-anchor": "middle", fill: "currentColor", text: U.fmt.n(total)
    }));
    r.g.appendChild(el("text", {
      class: "pm-donut-unit", x: cx, y: cy + 18,
      "text-anchor": "middle", fill: "currentColor",
      text: total === 1 ? "brief" : "briefs"
    }));

    host.appendChild(PM.svg.legend(rows.map(function (s, i) {
      return {
        label: U.stateLabel(s.state),
        cls: stateCls(s.state, i),
        value: U.fmt.n(s.count || 0)
      };
    })));
    host.appendChild(U.note(FILTER_NOTE));
  }

  /* ----------------------------------------------------------------------
     Lane distribution
     ---------------------------------------------------------------------- */

  function drawLanes(host, lanes) {
    var rows = (lanes || []).filter(function (l) { return l && l.lane != null; });

    if (!rows.length) {
      host.appendChild(U.empty(
        "metrics.lanes is empty — no brief in the corpus recorded a lane, so " +
        "there is nothing to split."
      ));
      return;
    }

    var ids = rows.map(function (l) { return String(l.lane); });
    var top = U.st.max(rows.map(function (l) {
      return Math.max((l.done || 0) + (l.pending || 0), l.total || 0);
    })) || 1;

    var c = PM.svg.chart(host, {
      height: 250,
      margin: { t: 12, r: 16, b: 38, l: 46 },
      xType: "band",
      yType: "linear",
      x: { domain: ids },
      y: { domain: [0, top] },
      label: "Briefs per lane, stacked done below pending"
    });
    c.yAxis({ ticks: 5, grid: true });
    c.xAxis({ ticks: ids.length, format: function (v) { return U.fmt.deCamel(v); } });
    c.stackedBars(rows, {
      x: function (l) { return String(l.lane); },
      keys: ["done", "pending"],
      cls: function (key) { return key === "done" ? "pm-a2" : "pm-a4"; },
      label: function (l, key, v) {
        var stacked = (l.done || 0) + (l.pending || 0);
        return [
          U.fmt.deCamel(l.lane) + " lane",
          (key === "done" ? "Done: " : "Pending: ") + U.fmt.n(v),
          "Total: " + U.fmt.plural(l.total == null ? stacked : l.total, "brief")
        ];
      }
    });
    c.legend([{ label: "Done", cls: "pm-a2" }, { label: "Pending", cls: "pm-a4" }]);
    c.done();

    /* A lane whose total exceeds done+pending is holding a brief with an
       unreadable status. The bars cannot show it, so the text must. */
    var hidden = 0;
    rows.forEach(function (l) {
      hidden += Math.max(0, (l.total || 0) - ((l.done || 0) + (l.pending || 0)));
    });
    if (hidden > 0) {
      host.appendChild(U.note(
        "Not in these bars: " + U.fmt.plural(hidden, "brief") + " that " +
        are(hidden) + " neither done nor pending — an unreadable status.", "warn"
      ));
    }

    host.appendChild(U.note(LANE_NOTE));
    host.appendChild(U.note(FILTER_NOTE));
  }

  /* ----------------------------------------------------------------------
     The All briefs table
     ---------------------------------------------------------------------- */

  function dateCell(field) {
    return function (value, row) {
      if (value == null) return "—";
      var reason = approxReason(row, field);
      return U.frag([U.fmt.date(value), reason ? U.approxMark(reason) : null]);
    };
  }

  function taskTable(tasks) {
    var cols = [
      {
        key: "id", label: "ID", width: "8.5rem",
        fmt: function (v) { return el("code", { text: String(v == null ? "—" : v) }); }
      },
      {
        key: "title", label: "Title",
        fmt: function (v, row) {
          var text = v || U.fmt.deCamel(row.name) || "—";
          return el("span", { title: text, text: U.fmt.truncate(text, 56) });
        }
      },
      { key: "sprint_id", label: "Sprint" },
      {
        key: "lane", label: "Lane",
        fmt: function (v) { return U.badge(laneName(v), laneTone(v)); }
      },
      {
        key: "workflow_state", label: "State",
        fmt: function (v) { return U.badge(U.stateLabel(v), U.stateTone(v)); }
      },
      { key: "created_at", label: "Created", fmt: dateCell("created_at") },
      { key: "closed_at", label: "Closed", fmt: dateCell("closed_at") },
      {
        /* One column, two meanings — a closed brief has a cycle time, an open
           one only has an age. Labelling them separately in the cell keeps the
           two from being read as the same number. */
        key: function (row) {
          return row.workflow_state === "done" ? row.cycle_time_days : row.age_days;
        },
        label: "Age / cycle", align: "right",
        fmt: function (v, row) {
          if (v == null) return "—";
          var done = row.workflow_state === "done";
          var reason = done
            ? (approxReason(row, "closed_at") || approxReason(row, "created_at"))
            : approxReason(row, "created_at");
          return U.frag([
            U.fmt.days(v) + (done ? " cycle" : " old"),
            reason ? U.approxMark(reason) : null
          ]);
        }
      },
      {
        key: "commit_count", label: "Commits", align: "right",
        fmt: function (v) { return v == null ? "—" : U.fmt.n(v); }
      },
      {
        key: "blocked_by_unmet", label: "Blocked by",
        fmt: function (v) { return blockerChips(v) || "—"; }
      }
    ];

    return U.table(cols, tasks.slice().sort(byId), {
      cls: "is-compact",
      rowClass: function (row) {
        return row.workflow_state === "blocked" ? "is-blocked"
             : row.workflow_state === "in_progress" ? "is-progress" : null;
      }
    });
  }

  /* ======================================================================
     PM.views.board
     ====================================================================== */

  PM.views.board = function (root, data) {
    U.clear(root);

    var payload = data || {};
    var metrics = payload.metrics || {};
    var allTasks = payload.tasks || [];
    var tasks = (PM.app && PM.app.applyFilter)
      ? PM.app.applyFilter(allTasks)
      : allTasks;
    var deps = metrics.dependencies || {};
    var ready = deps.ready || [];

    /* --- KPI row ------------------------------------------------------- */

    /* The ready frontier is a whole-project list of ids, so it is intersected
       with the filtered set rather than shown unfiltered beside filtered
       columns. `sub` names the project-wide figure whenever they differ. */
    var readySet = {};
    ready.forEach(function (id) { readySet[id] = true; });
    var readyHere = 0;
    tasks.forEach(function (t) { if (readySet[t.id]) readyHere++; });

    var wipHere = countState(tasks, "in_progress");
    var blockedHere = countState(tasks, "blocked");
    var badHere = countUnparseable(tasks);
    var pendingHere = tasks.length - countState(tasks, "done");

    function scopeSub(here, whole, unit) {
      if (here === whole) return unit;
      return unit + " · " + U.fmt.n(whole) + " project-wide";
    }

    root.appendChild(el("div", { class: "pm-kpi-row" }, [
      U.kpi({
        label: "WIP now", value: wipHere,
        sub: scopeSub(wipHere, countState(allTasks, "in_progress"), "briefs in progress"),
        tone: "neutral",
        hint: "Briefs whose status line reads as in progress. The corpus records " +
              "no WIP limit, so this is a count, not a breach."
      }),
      U.kpi({
        label: "Blocked", value: blockedHere,
        sub: scopeSub(blockedHere, countState(allTasks, "blocked"), "waiting on something"),
        tone: blockedHere > 0 ? "warn" : "good",
        hint: "Briefs whose status line reads as blocked, whether by an unmet " +
              "dependency or by a free-text gate."
      }),
      U.kpi({
        label: "Ready to start", value: readyHere,
        sub: scopeSub(readyHere, ready.length, "every dependency met"),
        /* Nothing startable while work remains is the signal worth a colour:
           it means the frontier is gated, not that the project is finished. */
        tone: readyHere > 0 ? "good" : (pendingHere > 0 ? "warn" : "neutral"),
        hint: "From task_queue's own ready frontier — briefs with no unmet " +
              "dependency and a readable status."
      }),
      U.kpi({
        label: "Unreadable status", value: badHere,
        sub: scopeSub(badHere, countUnparseable(allTasks), "briefs the parser could not read"),
        tone: badHere > 0 ? "warn" : "good",
        hint: "A status line the collector could not classify is a corpus " +
              "defect: the brief exists but its state is unknown, never guessed."
      })
    ]));

    /* --- The board and its two distributions --------------------------- */

    var boardSection = U.section(
      "Board",
      "Every brief in the corpus, in the column its own status line puts it in. " +
      "The sprint and lane filters apply to these columns."
    );
    root.appendChild(boardSection);

    var boardCard = U.card(
      "Columns",
      U.fmt.plural(tasks.length, "brief") + " in view" +
        (tasks.length === allTasks.length ? "" : " of " + U.fmt.n(allTasks.length)),
      { span: "full" }
    );
    boardSection.body.appendChild(boardCard);

    if (!tasks.length) {
      boardCard.body.appendChild(U.empty(
        allTasks.length
          ? "No brief matches the current sprint and lane filters."
          : "The payload carries no task briefs, so there is no board to build."
      ));
    } else {
      boardCard.body.appendChild(boardNode(tasks));

      var offBoard = countOffBoard(tasks);
      if (offBoard > 0) {
        boardCard.body.appendChild(U.note(
          "In none of the four columns: " + U.fmt.plural(offBoard, "brief") +
          " whose status line names no board state — " +
          (offBoard === 1 ? "it is" : "they are") +
          " inside the count above but in the All briefs table only.",
          "warn"
        ));
      }

      var datedClosures = countDated(tasks, "closed_at");
      var flooredClosures = countApprox(tasks, "closed_at");
      if (flooredClosures > 0 && datedClosures > 0) {
        boardCard.body.appendChild(U.note(boundsNote(
          flooredClosures, datedClosures, "closure dates",
          ", not observed — see Data & theme."
        )));
      }
      var datedCreations = countDated(tasks, "created_at");
      var flooredCreations = countApprox(tasks, "created_at");
      if (flooredCreations > 0 && datedCreations > 0) {
        boardCard.body.appendChild(U.note(boundsNote(
          flooredCreations, datedCreations, "arrival dates",
          ", so the ages above are minimums — see Data & theme."
        )));
      }
    }

    var donutCard = U.card("State distribution", "Whole project, pre-aggregated");
    boardSection.body.appendChild(donutCard);
    drawStateDonut(donutCard.body, metrics.states);

    var laneCard = U.card("Lane distribution", "Briefs per lane, done below pending");
    boardSection.body.appendChild(laneCard);
    drawLanes(laneCard.body, metrics.lanes);

    /* --- The full list ------------------------------------------------- */

    var tableSection = U.section(
      "All briefs",
      "One row per task brief, sorted by id. Filtered like the board above."
    );
    root.appendChild(tableSection);

    var tableCard = U.card(
      "Tasks",
      U.fmt.plural(tasks.length, "row"),
      { span: "full" }
    );
    tableSection.body.appendChild(tableCard);

    if (!tasks.length) {
      tableCard.body.appendChild(U.empty(
        "No brief matches the current sprint and lane filters, so the table " +
        "has no rows to show."
      ));
    } else {
      tableCard.body.appendChild(taskTable(tasks));
      tableCard.body.appendChild(U.note(
        "≈ marks a date the collector derived rather than read: a lower bound " +
        "against the git baseline, or a whole sprint's window standing in for a day."
      ));
    }

    drawOwners(tableSection.body, metrics.owners || []);
  };

  /* ----------------------------------------------------------------------
     Briefs per recorded owner.

     Absent entirely where a layout records no owner, rather than drawn as one
     bar labelled "unassigned" — which would look like a finding about the
     project instead of a fact about its template.
     ---------------------------------------------------------------------- */

  function drawOwners(host, owners) {
    if (!owners.length) return;

    var card = U.card("Briefs by owner",
                      U.fmt.plural(owners.length, "owner") + " on record");
    host.appendChild(card);

    var rows = owners.slice(0, 12);
    var max = rows[0].tasks;

    var c = PM.svg.chart(card.body, {
      height: 260, xType: "band",
      x: { domain: rows.map(function (o) { return o.owner; }), padding: 0.25 },
      y: { domain: [0, max] },
      label: "Briefs per owner"
    });
    c.yAxis({ ticks: 4, title: "briefs" });
    c.xAxis({ anchor: "end" });
    c.bars(rows, {
      x: function (o) { return o.owner; },
      keys: ["done", "tasks"],
      cls: function (key) { return key === "done" ? "pm-a2" : "pm-a1"; },
      label: function (o, key) {
        return [o.owner, key === "done"
          ? U.fmt.n(o.done) + " done"
          : U.fmt.n(o.tasks) + " total"];
      }
    });
    c.legend([
      { label: "done", cls: "pm-a2" },
      { label: "all briefs", cls: "pm-a1" }
    ]);
    c.done();

    if (owners.length > rows.length) {
      card.body.appendChild(U.note(
        "Showing the " + rows.length + " owners with the most briefs, of " +
        U.fmt.n(owners.length) + "."
      ));
    }
    card.body.appendChild(U.note(
      "The owner field is free text, so a value that names a person and a " +
      "condition (“agent (decision: human)”) is its own owner here rather " +
      "than being folded into a tidier one. Guessing which values mean the " +
      "same thing is how a chart starts disagreeing with the briefs."
    ));
  }

  /* ======================================================================
     Roadmap helpers
     ====================================================================== */

  /* Where a sprint's bar ends. An ongoing sprint runs to today by definition;
     a closed one with no end date falls back to today rather than collapsing
     to zero width, because "we do not know when it ended" is not "it ended the
     day it started". */
  function barEnd(sprint, today) {
    var end = sprint.ongoing ? null : U.d.parse(sprint.end);
    return end || U.d.parse(today) || U.d.parse(sprint.end) || U.d.parse(sprint.start);
  }

  function sprintDates(sprint) {
    if (sprint.roadmap_dates) return String(sprint.roadmap_dates);
    var start = sprint.start ? U.fmt.date(sprint.start) : "start not known";
    var end = sprint.ongoing ? "ongoing"
            : (sprint.end ? U.fmt.date(sprint.end) : "end not known");
    return start + " → " + end;
  }

  /* For a *sprint*, `roadmap_sprint` is the primary record — the roadmap table
     literally holds these dates by hand — so unlike a task date it is not
     marked approximate. Only a floored date (or an mtime fallback) is. */
  function sprintApproxReason(sprint, field) {
    if (!sprint || sprint[field] == null) return null;
    if (sprint[field + "_floored"]) {
      return "Lower bound: this sprint boundary sits on the git baseline, so " +
             "the sprint may have started earlier. See the Data & theme tab.";
    }
    if (sprint[field + "_source"] === "file_mtime") {
      return "Approximate: resolved from a file modification time, the weakest " +
             "source available. See the Data & theme tab.";
    }
    return null;
  }

  function sprintTipLines(sprint, today) {
    var start = U.d.parse(sprint.start);
    var end = barEnd(sprint, today);
    var span = (start && end) ? U.d.diffDays(start, end) : null;
    return [
      sprint.id + (sprint.name ? " — " + U.fmt.deCamel(sprint.name) : ""),
      U.stateLabel(sprint.state) + (sprint.ongoing ? " · ongoing" : ""),
      "Dates: " + sprintDates(sprint) + (span == null ? "" : " (" + U.fmt.days(span) + ")"),
      /* The table's Dates cell carries a ≈ marker; a tooltip cannot, so the
         reason itself is the line. Null when both boundaries are observed. */
      sprintApproxReason(sprint, "start") || sprintApproxReason(sprint, "end"),
      sprint.theme ? "Theme: " + U.fmt.truncate(sprint.theme, 140) : "No theme recorded",
      U.fmt.plural(sprint.task_count || 0, "brief") + " · " +
        U.fmt.n(sprint.done_count || 0) + " done · " +
        U.fmt.n(sprint.pending_count || 0) + " pending" +
        (sprint.unparseable_count ? " · " + U.fmt.n(sprint.unparseable_count) + " unreadable" : ""),
      "Completion: " + (sprint.completion_pct == null
        ? "not computable" : U.fmt.pct(sprint.completion_pct)),
      sprint.in_roadmap ? null : "No row in 30.ROADMAP.md's sprint table",
      sprint.has_briefs ? null : "No task brief on disk for this sprint"
    ];
  }

  function drawTimeline(host, sprints, today) {
    var scheduled = sprints.filter(function (s) { return U.d.parse(s.start); });
    var unscheduled = sprints.filter(function (s) { return !U.d.parse(s.start); });

    if (!scheduled.length) {
      host.appendChild(U.empty(
        "No sprint has a resolvable start date, so there is no window to lay a " +
        "timeline out in."
      ));
      if (unscheduled.length) {
        host.appendChild(U.note(
          U.fmt.plural(unscheduled.length, "sprint") + " " +
          have(unscheduled.length) + " no date at all:"
        ));
        host.appendChild(chips(unscheduled.map(function (s) { return s.id; })));
      }
      return;
    }

    var t0 = null, t1 = null;
    scheduled.forEach(function (s) {
      var a = U.d.parse(s.start).getTime();
      var b = barEnd(s, today);
      b = b ? b.getTime() : a;
      if (t0 == null || a < t0) t0 = a;
      if (t1 == null || b > t1) t1 = b;
    });
    if (t1 <= t0) t1 = t0 + U.DAY_MS;
    var span = t1 - t0;

    scheduled.sort(function (a, b) {
      var d = U.d.parse(a.start).getTime() - U.d.parse(b.start).getTime();
      return d !== 0 ? d : String(a.id).localeCompare(String(b.id));
    });

    var timeline = el("div", {
      class: "pm-timeline",
      role: "group",
      "aria-label": "Sprint timeline from " + U.fmt.date(new Date(t0)) +
                    " to " + U.fmt.date(new Date(t1))
    });

    scheduled.forEach(function (s) {
      var a = U.d.parse(s.start).getTime();
      var e = barEnd(s, today);
      var b = e ? e.getTime() : a;
      /* Percentages are relative to the row's own positioning context, which
         is the CSS's business — this module only supplies the geometry. Width
         is solved before left so the 0.8% floor that keeps a one-day sprint
         visible cannot push the bar past the right edge of its row. */
      var width = Math.min(100, Math.max(0.8, ((b - a) / span) * 100));
      var left = Math.max(0, Math.min(100 - width, ((a - t0) / span) * 100));

      var bar = el("div", {
        class: "pm-tbar" + (s.ongoing ? " is-ongoing" : ""),
        dataset: { state: s.state || "unknown" },
        style: { left: left.toFixed(2) + "%", width: width.toFixed(2) + "%" },
        /* The bar renders no text: at 24 sprints across one window most bars
           are a few pixels wide, and clipped text reads as corruption. */
        "aria-label": s.id + ", " + sprintDates(s) + ", " +
                      U.fmt.n(s.done_count || 0) + " of " +
                      U.fmt.n(s.task_count || 0) + " briefs done"
      });
      PM.svg.bindTip(bar, sprintTipLines(s, today));

      /* `.pm-trow-track` is the positioned box the percentages above are
         measured against — `.pm-trow` itself is a two-column grid whose first
         column is the label, so a bar placed directly in the row would be
         offset by the label's width. */
      timeline.appendChild(el("div", { class: "pm-trow" }, [
        el("span", { class: "pm-trow-label", text: s.id }),
        el("div", { class: "pm-trow-track" }, bar)
      ]));
    });

    host.appendChild(timeline);

    var flooredBounds = 0;
    scheduled.forEach(function (s) {
      if (sprintApproxReason(s, "start") || sprintApproxReason(s, "end")) flooredBounds++;
    });
    if (flooredBounds > 0) {
      host.appendChild(U.note(
        U.fmt.n(flooredBounds) + " of " + U.fmt.n(scheduled.length) +
        " sprint windows " + have(flooredBounds) + " a boundary that is a lower " +
        "bound rather than a recorded date — see Data & theme."
      ));
    }

    /* A sprint with no start is real information — usually a planned roadmap
       row — so it is listed rather than dropped off the left edge. */
    if (unscheduled.length) {
      host.appendChild(U.note(
        U.fmt.plural(unscheduled.length, "sprint") + " " + have(unscheduled.length) +
        " no resolvable start date and cannot be placed on the timeline:"
      ));
      host.appendChild(chips(unscheduled.map(function (s) { return s.id; })));
    }

    host.appendChild(U.note(FILTER_NOTE));
  }

  function drawCompletion(host, sprints, today) {
    var rows = sprints.filter(function (s) {
      return s.completion_pct != null && isFinite(s.completion_pct);
    });

    if (!rows.length) {
      host.appendChild(U.empty(
        "No sprint carries a completion percentage — every sprint in the " +
        "payload has zero briefs to count."
      ));
      return;
    }

    var ids = rows.map(function (s) { return String(s.id); });
    var c = PM.svg.chart(host, {
      height: 260,
      margin: { t: 14, r: 16, b: 40, l: 46 },
      xType: "band",
      yType: "linear",
      x: { domain: ids },
      y: { domain: [0, 100] },
      label: "Completion percentage for each of " + U.fmt.plural(rows.length, "sprint")
    });
    c.yAxis({ ticks: 5, grid: true, format: function (v) { return U.fmt.n(v) + "%"; } });
    c.xAxis({ ticks: ids.length });
    c.bars(rows, {
      x: function (s) { return String(s.id); },
      y: function (s) { return s.completion_pct; },
      cls: function (key, ki, s) { return SPRINT_CLS[s && s.state] || "pm-a7"; },
      /* `today` is threaded in rather than passed as null: an ongoing sprint
         has no end date, so without it barEnd() falls back to the start and
         the tooltip reports every running sprint as zero days long. */
      label: function (s) { return sprintTipLines(s, today); }
    });
    c.hLine(100, { cls: "pm-ref", label: "100% of briefs closed" });
    c.legend([
      { label: "Closed", cls: "pm-a2" },
      { label: "Active", cls: "pm-a1" },
      { label: "Planned", cls: "pm-a7" }
    ]);
    c.done();

    host.appendChild(U.note(
      "Completion counts briefs, not story points: no brief in this corpus " +
      "carries an estimate, so there is nothing else to count."
    ));
    host.appendChild(U.note(FILTER_NOTE));
  }

  function progressCell(value, sprint) {
    if (value == null || !isFinite(value)) return "—";
    var clamped = Math.max(0, Math.min(100, value));
    /* A closed sprint that never reached 100% is the one case worth a colour:
       it means briefs were left behind when the sprint was called done. */
    var tone = clamped >= 100 ? " is-good"
             : (sprint && sprint.state === "closed" ? " is-warn" : "");
    return U.frag([
      el("div", {
        class: "pm-progress",
        role: "img",
        "aria-label": U.fmt.pct(value) + " of this sprint's briefs are closed"
      }, el("span", {
        class: "pm-progress-fill" + tone,
        style: { width: clamped.toFixed(1) + "%" }
      })),
      /* The number is printed beside the bar, not inside it: the bar depends on
         a stylesheet, the number does not. */
      el("span", { class: "pm-progress-value", text: U.fmt.pct(value, 0) })
    ]);
  }

  function sprintTable(sprints) {
    var cols = [
      {
        key: "id", label: "ID", width: "5.5rem",
        fmt: function (v) { return el("code", { text: String(v == null ? "—" : v) }); }
      },
      {
        key: "name", label: "Name",
        fmt: function (v) { return v ? U.fmt.deCamel(v) : "—"; }
      },
      {
        key: "roadmap_dates", label: "Dates",
        fmt: function (v, row) {
          var reason = sprintApproxReason(row, "start") || sprintApproxReason(row, "end");
          return U.frag([sprintDates(row), reason ? U.approxMark(reason) : null]);
        }
      },
      {
        key: "state", label: "State",
        fmt: function (v, row) {
          return U.frag([
            U.badge(U.stateLabel(v), U.stateTone(v)),
            row.ongoing ? U.badge("ongoing", "info") : null,
            /* A sprint with briefs but no roadmap row means the hand-maintained
               history is incomplete. That is a finding, so it is a badge. */
            row.in_roadmap === false ? U.badge("no roadmap row", "warn") : null
          ]);
        }
      },
      { key: "task_count", label: "Tasks", align: "right",
        fmt: function (v) { return U.fmt.n(v == null ? 0 : v); } },
      { key: "done_count", label: "Done", align: "right",
        fmt: function (v) { return U.fmt.n(v == null ? 0 : v); } },
      { key: "pending_count", label: "Pending", align: "right",
        fmt: function (v) { return U.fmt.n(v == null ? 0 : v); } },
      { key: "completion_pct", label: "Completion", width: "11rem",
        fmt: function (v, row) { return progressCell(v, row); } },
      {
        key: "theme", label: "Theme",
        fmt: function (v) {
          if (!v) return "—";
          return el("span", { title: String(v), text: U.fmt.truncate(String(v), 90) });
        }
      }
    ];

    return U.table(cols, sprints, {
      cls: "is-compact",
      rowClass: function (row) {
        return row.state === "active" ? "is-progress"
             : row.in_roadmap === false ? "is-blocked" : null;
      }
    });
  }

  function drawDivergence(host, sprints) {
    var briefsNoRoadmap = sprints.filter(function (s) {
      return s.has_briefs && s.in_roadmap === false;
    });
    var roadmapNoBriefs = sprints.filter(function (s) {
      return s.in_roadmap && s.has_briefs === false;
    });

    if (!briefsNoRoadmap.length && !roadmapNoBriefs.length) {
      host.appendChild(U.empty(
        "Every sprint has both a roadmap row and at least one brief."
      ));
      return;
    }

    if (briefsNoRoadmap.length) {
      host.appendChild(U.note(
        U.fmt.plural(briefsNoRoadmap.length, "sprint") + " " +
        have(briefsNoRoadmap.length) + " briefs on disk but " +
        "no row in 30.ROADMAP.md — work happened that the hand-maintained " +
        "history does not record, so reading the roadmap alone understates it.",
        "warn"
      ));
      host.appendChild(el("div", { class: "pm-chips" },
        briefsNoRoadmap.map(function (s) {
          return chip(
            s.id + " (" + U.fmt.n(s.task_count || 0) + ")",
            "is-bad",
            s.id + " has " + U.fmt.plural(s.task_count || 0, "brief") +
              " on disk and no roadmap row"
          );
        })));
    }

    if (roadmapNoBriefs.length) {
      host.appendChild(U.note(
        U.fmt.plural(roadmapNoBriefs.length, "roadmap row") + " " +
        have(roadmapNoBriefs.length) + " no brief on " +
        "disk — either a sprint still entirely unwritten, or one whose briefs " +
        "were renamed out from under the roadmap table."
      ));
      host.appendChild(chips(roadmapNoBriefs.map(function (s) { return s.id; })));
    }
  }

  /* ======================================================================
     PM.views.roadmap
     ====================================================================== */

  PM.views.roadmap = function (root, data) {
    U.clear(root);

    var payload = data || {};
    var metrics = payload.metrics || {};
    var sprints = (payload.sprints || []).slice();
    var today = (payload.project && payload.project.today) || metrics.as_of || null;

    if (!sprints.length) {
      root.appendChild(U.empty(
        "The payload carries no sprints — neither a task brief nor a roadmap " +
        "row was found, so there is no history to lay out."
      ));
      return;
    }

    /* --- KPI row ------------------------------------------------------- */

    function countSprints(state) {
      var n = 0;
      sprints.forEach(function (s) { if (s.state === state) n++; });
      return n;
    }

    var withBriefs = sprints.filter(function (s) { return s.has_briefs; });
    var sizes = withBriefs.map(function (s) { return s.task_count || 0; });
    var avg = U.st.mean(sizes);

    root.appendChild(el("div", { class: "pm-kpi-row" }, [
      U.kpi({
        label: "Sprints closed", value: countSprints("closed"),
        sub: "of " + U.fmt.n(sprints.length) + " known", tone: "good",
        hint: "A sprint is closed when its roadmap row or its briefs say so."
      }),
      U.kpi({
        label: "Active", value: countSprints("active"),
        sub: "running now", tone: "info",
        hint: "Sprints with an open window; more than one at a time is normal here."
      }),
      U.kpi({
        label: "Planned", value: countSprints("planned"),
        sub: "not started yet", tone: "neutral",
        hint: "A roadmap row with no closed brief yet. A planned sprint with no " +
              "briefs at all is real information, not an error."
      }),
      U.kpi({
        /* n is stated because this is a mean over a subset: sprints with no
           brief on disk contribute no size and are excluded, not counted zero. */
        label: "Average sprint size", value: avg, display: U.fmt.n(avg, 1),
        sub: avg == null
          ? "no sprint has briefs"
          : "mean briefs per sprint (n = " + U.fmt.n(withBriefs.length) + ")",
        tone: "neutral",
        hint: "Mean task_count over sprints that have at least one brief. Tasks, " +
              "not story points — this corpus has no estimates."
      })
    ]));

    /* --- Timeline ------------------------------------------------------ */

    var timelineSection = U.section(
      "Sprint history",
      "Each sprint's window, from the roadmap table where it has a row and from " +
      "its briefs' dates where it does not."
    );
    root.appendChild(timelineSection);

    var timelineCard = U.card(
      "Timeline",
      U.fmt.plural(sprints.length, "sprint") +
        (today ? " · ongoing sprints run to " + U.fmt.date(today) : ""),
      { span: "full" }
    );
    timelineSection.body.appendChild(timelineCard);
    drawTimeline(timelineCard.body, sprints, today);

    var completionCard = U.card("Sprint completion", "Closed briefs as a share of each sprint's scope");
    timelineSection.body.appendChild(completionCard);
    drawCompletion(completionCard.body, sprints, today);

    var divergenceCard = U.card(
      "Roadmap divergence",
      "Where the hand-maintained sprint table and the briefs on disk disagree"
    );
    timelineSection.body.appendChild(divergenceCard);
    drawDivergence(divergenceCard.body, sprints);

    /* --- Detail table --------------------------------------------------- */

    var detailSection = U.section(
      "Sprint detail",
      "One row per sprint, in id order. Dates are the roadmap table's own cell " +
      "where it has one."
    );
    root.appendChild(detailSection);

    var detailCard = U.card("Sprints", U.fmt.plural(sprints.length, "row"), { span: "full" });
    detailSection.body.appendChild(detailCard);
    detailCard.body.appendChild(sprintTable(sprints));
    detailCard.body.appendChild(U.note(
      "Counts are briefs. The payload's primary unit is tasks and no brief " +
      "carries an estimate, so a sprint's size is how many briefs it holds — " +
      "not how much work they were thought to be."
    ));

    /* --- Phases --------------------------------------------------------- */

    drawPhaseSection(root, metrics.phases || {});

    /* --- One sprint, in detail ------------------------------------------ */

    drawSprintBurnSection(root, metrics, sprints);

    /* --- Work outside a sprint ------------------------------------------ */

    drawOutsideSprintSection(root, sprints);
  };

  /* ----------------------------------------------------------------------
     Roadmap phases.

     A phase records only its completion date, so a bar spans from the previous
     phase's completion to its own — which is what sequential phases mean. The
     first has no predecessor and is drawn as a marker rather than given an
     invented start, and an undated phase appears in the table only. Both rules
     are the collector's (SCHEMA.md §1.12); this draws what it is given.
     ---------------------------------------------------------------------- */

  function drawPhaseSection(root, phases) {
    var rows = phases.timeline || [];
    if (!rows.length) return;      /* not every project has phases; not a gap */

    var section = U.section(
      "Roadmap phases",
      "The project's own phase structure, above the sprints that delivered it."
    );
    root.appendChild(section);

    var card = U.card(
      "Phases",
      U.fmt.plural(rows.length, "phase") + " · " +
        U.fmt.n(phases.dated || 0) + " dated",
      { span: "full" }
    );
    section.body.appendChild(card);

    var placeable = rows.filter(function (p) { return p.end && p.start; });
    if (!placeable.length) {
      card.body.appendChild(U.empty(
        "No phase can be placed on a timeline: a bar needs both its own " +
        "completion date and the previous phase's, and fewer than two phases " +
        "carry one."
      ));
    } else {
      drawPhaseBars(card.body, rows, placeable);
    }

    card.body.appendChild(U.table(
      [
        { key: "number", label: "Phase", width: "7ch" },
        { key: "title", label: "Title" },
        {
          key: "state", label: "State", width: "10ch",
          fmt: function (v) {
            return U.badge(v === "done" ? "complete" : "open",
                           v === "done" ? "good" : "warn");
          }
        },
        {
          key: "end", label: "Completed", width: "12ch",
          fmt: function (v) { return v ? U.fmt.date(v) : "—"; }
        },
        {
          key: "days", label: "Span", width: "9ch",
          fmt: function (v) { return v == null ? "—" : U.fmt.days(v); }
        }
      ],
      rows
    ));

    var undated = rows.length - (phases.dated || 0);
    if (undated) {
      card.body.appendChild(U.note(
        U.fmt.plural(undated, "phase") + " carries no completion date and is " +
        "listed above but not plotted. Placing it at a guessed position on the " +
        "one chart people read as a schedule would be an invented fact.",
        "warn"
      ));
    }
    card.body.appendChild(U.note(
      "A phase bar runs from the previous phase's completion to its own, " +
      "because that is what a sequential phase means. The first phase has no " +
      "predecessor, so it is drawn as a marker rather than given a start it " +
      "does not record."
    ));
  }

  function drawPhaseBars(host, rows, placeable) {
    var starts = placeable.map(function (p) { return +U.d.parse(p.start); });
    var ends = placeable.map(function (p) { return +U.d.parse(p.end); });
    var t0 = Math.min.apply(null, starts);
    var t1 = Math.max.apply(null, ends);
    if (!(t1 > t0)) { t1 = t0 + U.DAY_MS; }

    var timeline = el("div", {
      class: "pm-timeline",
      role: "img",
      "aria-label": "Roadmap phase timeline from " + U.fmt.date(new Date(t0)) +
                    " to " + U.fmt.date(new Date(t1))
    });

    /* Only placeable phases get a row. An unplaceable one is in the table
       below with its state and date, and the card's note says how many were
       left out — a row with an empty track would read as "this phase took no
       time" rather than "this phase has no span on record". */
    placeable.forEach(function (phase) {
      var label = "Phase " + phase.number;
      var a = +U.d.parse(phase.start), b = +U.d.parse(phase.end);
      var span = t1 - t0;
      var width = Math.min(100, Math.max(0.8, ((b - a) / span) * 100));
      var left = Math.max(0, Math.min(100 - width, ((a - t0) / span) * 100));

      var bar = el("div", {
        class: "pm-tbar",
        dataset: { state: phase.state === "done" ? "closed" : "active" },
        style: { left: left.toFixed(2) + "%", width: width.toFixed(2) + "%" },
        "aria-label": label + ", " + phase.title + ", " +
                      U.fmt.date(phase.start) + " to " + U.fmt.date(phase.end)
      });
      PM.svg.bindTip(bar, [
        label + " — " + phase.title,
        phase.state === "done" ? "complete" : "open",
        U.fmt.date(phase.start) + " → " + U.fmt.date(phase.end),
        phase.days == null ? "" : U.fmt.days(phase.days)
      ]);

      timeline.appendChild(el("div", { class: "pm-trow" }, [
        el("span", { class: "pm-trow-label", text: label }),
        el("div", { class: "pm-trow-track" }, bar)
      ]));
    });
    host.appendChild(timeline);
  }

  /* ----------------------------------------------------------------------
     One sprint's own burn-down and burn-up.
     ---------------------------------------------------------------------- */

  function drawSprintBurnSection(root, metrics, sprints) {
    var burns = metrics.sprint_burn || {};
    var ids = Object.keys(burns);
    if (!ids.length) return;

    /* Honour the header's sprint filter where it names one, so this card and
       the board agree about which sprint the reader is looking at. Otherwise
       take the most recent sprint with a usable series, which is the one
       anybody opening this tab is asking about. */
    var selected = (PM.app && PM.app.filter && PM.app.filter.sprint) || null;
    if (!selected || !burns[selected]) {
      var ordered = sprints
        .filter(function (s) { return burns[s.id] && burns[s.id].length > 1; })
        .sort(function (a, b) { return String(a.id).localeCompare(String(b.id)); });
      selected = ordered.length ? ordered[ordered.length - 1].id : ids[ids.length - 1];
    }
    var series = burns[selected] || [];
    if (series.length < 2) return;

    var sprint = null;
    sprints.forEach(function (s) { if (s.id === selected) sprint = s; });
    var label = sprint ? (sprint.label || sprint.id) : selected;

    var section = U.section(
      "Inside one sprint",
      "The selected sprint's own burn-down and burn-up. Use the Sprint filter " +
      "in the header to change it."
    );
    root.appendChild(section);

    var maxScope = 0;
    series.forEach(function (p) {
      if (p.scope > maxScope) maxScope = p.scope;
      if (p.ideal > maxScope) maxScope = p.ideal;
    });

    var downCard = U.card("Burn-down — " + label, "Remaining briefs per day");
    section.body.appendChild(downCard);
    var c1 = PM.svg.chart(downCard.body, {
      height: 260, xType: "time",
      x: { domain: [U.d.parse(series[0].date), U.d.parse(series[series.length - 1].date)] },
      y: { domain: [0, maxScope || 1] },
      label: "Burn-down for " + label
    });
    c1.yAxis({ ticks: 4, title: "briefs" });
    c1.xAxis({ ticks: 5, format: U.fmt.date });
    c1.area(series, {
      x: function (p) { return U.d.parse(p.date); },
      y1: function (p) { return p.remaining; },
      cls: "pm-a1", stroke: "pm-s1"
    });
    c1.line(series, {
      x: function (p) { return U.d.parse(p.date); },
      y: function (p) { return p.ideal; },
      cls: "pm-ref", dashed: true
    });
    c1.legend([
      { label: "remaining", cls: "pm-s1" },
      { label: "straight-line reference", cls: "pm-ref" }
    ]);
    c1.done();
    downCard.body.appendChild(U.note(
      "The dashed line is arithmetic, not a commitment: it runs straight from " +
      "this sprint's opening scope to zero across its own window. No sprint in " +
      "this corpus carries a commitment, and nobody agreed to this line. Being " +
      "above it means the straight line was optimistic, which it usually is."
    ));

    var upCard = U.card("Burn-up — " + label, "Scope against closed");
    section.body.appendChild(upCard);
    var c2 = PM.svg.chart(upCard.body, {
      height: 260, xType: "time",
      x: { domain: [U.d.parse(series[0].date), U.d.parse(series[series.length - 1].date)] },
      y: { domain: [0, maxScope || 1] },
      label: "Burn-up for " + label
    });
    c2.yAxis({ ticks: 4, title: "briefs" });
    c2.xAxis({ ticks: 5, format: U.fmt.date });
    c2.line(series, {
      x: function (p) { return U.d.parse(p.date); },
      y: function (p) { return p.scope; },
      cls: "pm-s3"
    });
    c2.area(series, {
      x: function (p) { return U.d.parse(p.date); },
      y1: function (p) { return p.done; },
      cls: "pm-a2", stroke: "pm-s2"
    });
    c2.legend([
      { label: "scope", cls: "pm-s3" },
      { label: "closed", cls: "pm-s2" }
    ]);
    c2.done();
    upCard.body.appendChild(U.note(
      "A scope line that steps upward mid-sprint is discovery being recorded, " +
      "not a failure. The question is whether the gap closes."
    ));
  }

  /* ----------------------------------------------------------------------
     Work that ran outside any sprint.
     ---------------------------------------------------------------------- */

  function drawOutsideSprintSection(root, sprints) {
    /* A bucket is a sprint record with no row in the project's own sprint
       history — `Post-S4`, `unassigned`. Real sprints are left out; the point
       of this card is the work the sprint structure does not account for. */
    var buckets = sprints.filter(function (s) {
      return s && !s.in_roadmap && s.has_briefs;
    });
    if (!buckets.length) return;

    var section = U.section(
      "Work run outside a sprint",
      "Briefs that belong to no sprint in the project's own history."
    );
    root.appendChild(section);

    var total = 0;
    buckets.forEach(function (b) { total += b.task_count || 0; });

    var card = U.card(
      "Outside the sprint structure",
      U.fmt.plural(total, "brief") + " in " + U.fmt.plural(buckets.length, "bucket")
    );
    section.body.appendChild(card);

    var ordered = buckets.slice().sort(function (a, b) {
      return (b.task_count || 0) - (a.task_count || 0);
    });
    var max = ordered[0].task_count || 1;

    var c = PM.svg.chart(card.body, {
      height: 240, xType: "band",
      x: { domain: ordered.map(function (b) { return b.id; }), padding: 0.25 },
      y: { domain: [0, max] },
      label: "Briefs per out-of-sprint bucket"
    });
    c.yAxis({ ticks: 4, title: "briefs" });
    c.xAxis({});
    c.bars(ordered, {
      x: function (b) { return b.id; },
      keys: ["done_count", "pending_count"],
      cls: function (key) { return key === "done_count" ? "pm-a2" : "pm-a1"; },
      label: function (b, key) {
        return [b.id, key.replace("_count", "") + ": " + U.fmt.n(b[key] || 0)];
      }
    });
    c.legend([{ label: "done", cls: "pm-a2" }, { label: "open", cls: "pm-a1" }]);
    c.done();

    card.body.appendChild(U.note(
      "These are not a failure of process. Work between sprints is ordinary, " +
      "and recording it in its own bucket keeps it out of a neighbouring " +
      "sprint's velocity — which would otherwise be credited with briefs it " +
      "never carried."
    ));
  }
})();
