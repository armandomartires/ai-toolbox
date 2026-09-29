/* ==========================================================================
   28-backlog.js — PM.views.backlog: work written down but not yet briefed.

   This tab answers "what have we agreed to do that nobody has started?", which
   neither the Board (in-flight briefs) nor Debt & risk (findings) answers.

   The backlog arrives from one of two places and says so: a graded
   `BACKLOG.md` table where a project keeps one, and the ad-hoc list projected
   into the same shape where it does not (SCHEMA.md §1.11). The difference
   matters to every chart here, because an ad-hoc list grades nothing — so an
   all-`unrated` matrix is the expected rendering of that source, not a finding
   about the project, and this tab says which it is looking at rather than
   leaving the reader to infer it from a column of zeros.

   The matrix counts OPEN items only. A closed item's priority records a
   decision already taken; including them would make a well-run backlog and a
   neglected one look identical, since both accumulate closed rows forever.
   ========================================================================== */

window.PM = window.PM || {};

(function () {
  "use strict";

  var U = PM.util;
  var el = U.el;

  PM.views = PM.views || {};

  /* Read order for the graded axes, worst-first on priority so the top-left of
     the matrix is the corner that should be empty. `unrated` sorts last
     because it is an absence, not a level. */
  var GRADE_ORDER = ["high", "medium", "low", "unrated"];

  var SOURCE_NOTES = {
    backlog_table:
      "Read from the project's own backlog table, with its priority, value and " +
      "risk grading as written.",
    adhoc:
      "This project keeps no backlog table, so these are its ad-hoc findings " +
      "shown in the same shape. That list grades nothing, so every item reads " +
      "as unrated here — that is the source, not a gap in the project."
  };

  function gradeRank(grade) {
    var i = GRADE_ORDER.indexOf(grade);
    return i === -1 ? GRADE_ORDER.length : i;
  }

  function sortGrades(grades) {
    return (grades || []).slice().sort(function (a, b) {
      var d = gradeRank(a) - gradeRank(b);
      return d !== 0 ? d : String(a).localeCompare(String(b));
    });
  }

  function stateTone(state) {
    if (state === "done") return "good";
    if (state === "cancelled") return "neutral";
    return "warn";
  }

  function stateLabel(state) {
    if (state === "done") return "closed";
    if (state === "cancelled") return "cancelled";
    return "open";
  }

  /* ----------------------------------------------------------------------
     The priority x value matrix.

     Drawn with PM.svg.raw rather than PM.svg.chart: both axes are categorical,
     and the chart helper's band scale centres marks on one axis only, so a
     bubble grid would sit off-centre vertically. Laying it out here is a dozen
     lines and exact. The calendar heatmap in 25-activity.js is drawn the same
     way for the same reason.
     ---------------------------------------------------------------------- */

  function drawMatrix(host, matrix, grades) {
    var cells = (matrix || []).filter(function (c) { return c && c.count > 0; });
    if (!cells.length) {
      host.appendChild(U.empty(
        "No open backlog item carries a priority and value, so there is no " +
        "matrix to draw."
      ));
      return;
    }

    var priorities = sortGrades(unique(cells, "priority"));
    var values = sortGrades(unique(cells, "value"));

    var padL = 86, padT = 26, padR = 12, padB = 30;
    var cellW = 96, cellH = 62;
    var width = padL + priorities.length * cellW + padR;
    var height = padT + values.length * cellH + padB;

    var svg = PM.svg.raw(host, {
      width: width,
      height: height,
      label: "Open backlog items by priority and value",
      cls: "pm-matrix"
    });
    var g = svg.g;

    var max = 0;
    cells.forEach(function (c) { if (c.count > max) max = c.count; });

    /* Column headers (priority) and row headers (value). */
    priorities.forEach(function (p, i) {
      g.appendChild(el("text", {
        class: "pm-axis-label", x: padL + i * cellW + cellW / 2, y: padT - 10,
        "text-anchor": "middle", text: p
      }));
    });
    values.forEach(function (v, j) {
      g.appendChild(el("text", {
        class: "pm-axis-label", x: padL - 10, y: padT + j * cellH + cellH / 2 + 4,
        "text-anchor": "end", text: v
      }));
      g.appendChild(el("line", {
        class: "pm-gridline",
        x1: padL, y1: padT + (j + 1) * cellH,
        x2: padL + priorities.length * cellW, y2: padT + (j + 1) * cellH
      }));
    });

    g.appendChild(el("text", {
      class: "pm-axis-title", x: padL + (priorities.length * cellW) / 2,
      y: height - 8, "text-anchor": "middle", text: "priority"
    }));

    cells.forEach(function (cell) {
      var i = priorities.indexOf(cell.priority);
      var j = values.indexOf(cell.value);
      if (i < 0 || j < 0) return;
      var cx = padL + i * cellW + cellW / 2;
      var cy = padT + j * cellH + cellH / 2;
      /* Area-proportional, so a bubble twice the count reads as twice the ink
         rather than four times it. */
      var r = 9 + 17 * Math.sqrt(cell.count / max);
      var ids = (cell.ids || []).filter(Boolean);

      var circle = el("circle", {
        class: "pm-dot " + toneFor(cell.priority),
        cx: cx, cy: cy, r: r
      });
      PM.svg.bindTip(circle, [
        cell.value + " value · " + cell.priority + " priority",
        U.fmt.plural(cell.count, "open item"),
        ids.slice(0, 8).join(", ") + (ids.length > 8 ? " …" : "")
      ]);
      g.appendChild(circle);
      g.appendChild(el("text", {
        class: "pm-bubble-label", x: cx, y: cy + 4,
        "text-anchor": "middle", text: String(cell.count)
      }));
    });
  }

  /* High priority is a warning, not a series colour: a matrix where the
     high/high corner is the same hue as low/low hides the only cell anyone
     needs to look at first. */
  function toneFor(priority) {
    if (priority === "high") return "pm-bad";
    if (priority === "medium") return "pm-warn";
    if (priority === "unrated") return "pm-muted";
    return "pm-ok";
  }

  function unique(rows, key) {
    var seen = {}, out = [];
    rows.forEach(function (row) {
      var v = row[key];
      if (v != null && !seen[v]) { seen[v] = true; out.push(v); }
    });
    return out;
  }

  /* ----------------------------------------------------------------------
     Raised and closed, by priority.
     ---------------------------------------------------------------------- */

  function drawMix(host, mix) {
    var rows = (mix || []).filter(function (m) { return m && (m.open || m.closed); });
    if (!rows.length) {
      host.appendChild(U.empty("No backlog items to break down by priority."));
      return;
    }
    var ordered = rows.slice().sort(function (a, b) {
      return gradeRank(a.priority) - gradeRank(b.priority);
    });
    var max = 0;
    ordered.forEach(function (r) {
      if (r.open > max) max = r.open;
      if (r.closed > max) max = r.closed;
    });

    var c = PM.svg.chart(host, {
      height: 240,
      xType: "band",
      x: { domain: ordered.map(function (r) { return r.priority; }), padding: 0.25 },
      y: { domain: [0, max || 1] },
      label: "Backlog items raised and closed, by priority"
    });
    c.yAxis({ ticks: 4, title: "items" });
    c.xAxis({});
    c.bars(ordered, {
      x: function (r) { return r.priority; },
      keys: ["closed", "open"],
      cls: function (key) { return key === "closed" ? "pm-a2" : "pm-a1"; },
      label: function (r, key) {
        return [r.priority + " priority", key + ": " + U.fmt.n(r[key])];
      }
    });
    c.legend([
      { label: "closed", cls: "pm-a2", value: sum(ordered, "closed") },
      { label: "open", cls: "pm-a1", value: sum(ordered, "open") }
    ]);
    c.done();
  }

  function sum(rows, key) {
    var total = 0;
    rows.forEach(function (r) { total += r[key] || 0; });
    return total;
  }

  /* ----------------------------------------------------------------------
     The view
     ---------------------------------------------------------------------- */

  PM.views.backlog = function (root, data) {
    var payload = data || {};
    var metrics = payload.metrics || {};
    var backlog = metrics.backlog || {};
    var rows = payload.backlog || [];
    var totals = backlog.totals || {};
    var tasks = payload.tasks || [];

    if (!rows.length) {
      root.appendChild(U.empty(
        "This project records no backlog: there is no `BACKLOG.md` table and " +
        "no ad-hoc list to project into one. Nothing is missing — there is " +
        "simply nothing written down that is not already a task brief."
      ));
      return;
    }

    var openRows = rows.filter(function (r) { return r.state === "open"; });

    /* --- tiles --------------------------------------------------------- */
    root.appendChild(el("div", { class: "pm-kpi-row" }, [
      U.kpi({
        key: "backlog-open", label: "Open", value: totals.open || 0,
        unit: "items", tone: "neutral",
        sub: U.fmt.plural(totals.total || 0, "item") + " on record",
        hint: "Backlog items not yet closed."
      }),
      U.kpi({
        key: "backlog-closed", label: "Closed", value: totals.closed || 0,
        unit: "items", tone: "good",
        sub: totals.total
          ? U.fmt.pct(100 * (totals.closed || 0) / totals.total) + " of the list"
          : "",
        hint: "Backlog items marked done."
      }),
      U.kpi({
        key: "backlog-high", label: "High priority, open",
        value: totals.high_open || 0, unit: "items",
        tone: (totals.high_open || 0) > 0 ? "warn" : "good",
        hint: "Open items the project itself graded high."
      }),
      U.kpi({
        key: "backlog-graded", label: "Graded", value: totals.graded || 0,
        unit: "of " + (totals.open || 0),
        tone: "neutral",
        sub: "open items carrying a priority",
        hint: "An ungraded item is reported as unrated, never as a middle value."
      })
    ]));

    /* --- composition --------------------------------------------------- */
    var band = U.section(
      "Composition",
      "Open items by priority and value, and the raised/closed split."
    );

    var matrixCard = U.card(
      "Open items by priority and value",
      U.fmt.plural(openRows.length, "open item")
    );
    drawMatrix(matrixCard.body, backlog.matrix, backlog.grades);
    var sourceNote = SOURCE_NOTES[backlog.source];
    if (sourceNote) matrixCard.body.appendChild(U.note(sourceNote));
    matrixCard.body.appendChild(U.note(
      "Closed items are excluded: their grading records a decision already " +
      "taken, and including them would make a worked backlog look like a " +
      "neglected one."
    ));
    band.body.appendChild(matrixCard);

    var mixCard = U.card("Raised and closed by priority", "Whole list");
    drawMix(mixCard.body, backlog.mix);
    band.body.appendChild(mixCard);
    root.appendChild(band);

    /* --- what is next -------------------------------------------------- */
    var next = U.section(
      "What is next, as written down",
      "Open briefs first, then open backlog items by priority. This is the " +
      "project's own stated order, not a recommendation from this tool."
    );
    var nextCard = U.card("Next up", null, { span: "full" });
    nextCard.body.appendChild(nextTable(tasks, openRows));
    next.body.appendChild(nextCard);
    root.appendChild(next);

    /* --- the full list ------------------------------------------------- */
    var all = U.section("Every backlog item", U.fmt.plural(rows.length, "row"));
    var allCard = U.card("Backlog", null, { span: "full" });
    allCard.body.appendChild(U.table(
      [
        { key: "id", label: "ID", width: "8ch" },
        {
          key: "state", label: "Status", width: "10ch",
          fmt: function (v) { return U.badge(stateLabel(v), stateTone(v)); }
        },
        { key: "title", label: "Title" },
        { key: "priority", label: "Priority", width: "10ch" },
        { key: "value", label: "Value", width: "10ch" },
        { key: "risk", label: "Risk", width: "10ch" },
        { key: "dependencies", label: "Depends on", width: "16ch" },
        { key: "note", label: "Notes" }
      ],
      rows.slice().sort(function (a, b) {
        /* Open first, then by priority: the reader is here to find work. */
        var s = (a.state === "open" ? 0 : 1) - (b.state === "open" ? 0 : 1);
        if (s !== 0) return s;
        var p = gradeRank(a.priority) - gradeRank(b.priority);
        if (p !== 0) return p;
        return String(a.id).localeCompare(String(b.id));
      }),
      { scroll: true }
    ));
    allCard.body.appendChild(U.note(
      "`Depends on` is free text exactly as the project wrote it. It is never " +
      "parsed into a dependency edge — these cells say things like “Phase 3” " +
      "and “after the linter lands”, and turning that into a graph would " +
      "manufacture structure the corpus does not have."
    ));
    all.body.appendChild(allCard);
    root.appendChild(all);
  };

  function nextTable(tasks, openRows) {
    var openTasks = (tasks || []).filter(function (t) {
      return t && t.state === "pending";
    });
    var items = [];
    openTasks.forEach(function (t) {
      items.push({
        kind: "brief", id: t.id, title: t.title || t.name,
        grade: t.workflow_state === "blocked" ? "blocked" : "in flight"
      });
    });
    openRows.slice().sort(function (a, b) {
      return gradeRank(a.priority) - gradeRank(b.priority);
    }).forEach(function (b) {
      items.push({
        kind: "backlog", id: b.id, title: b.title, grade: b.priority
      });
    });

    if (!items.length) {
      return U.empty("Nothing is open: every brief is closed and the backlog is clear.");
    }

    return U.table(
      [
        {
          key: "kind", label: "Kind", width: "9ch",
          fmt: function (v) {
            return U.badge(v, v === "brief" ? "neutral" : "warn");
          }
        },
        { key: "id", label: "ID", width: "12ch" },
        { key: "title", label: "Title" },
        { key: "grade", label: "State / priority", width: "14ch" }
      ],
      items,
      { scroll: true }
    );
  }
})();
