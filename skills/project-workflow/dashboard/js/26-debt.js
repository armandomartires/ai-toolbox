/* ==========================================================================
   26-debt.js — PM.views.debt: the Debt & risk tab.

   This is the tab a reader opens to find out what is wrong, so the cards are
   ordered by how much a finding invalidates everything else rather than by how
   much room it needs. Corpus defects lead: a defect means this dashboard's own
   input could not be read cleanly, which puts every other number on the page
   in question. Then the derived risk register, then the ad-hoc backlog, then
   the two populations the time series silently drop — tasks with no resolvable
   date, and pending work already past the historical p85.

   Nothing here is softened, and a zero is still reported as a finding rather
   than hidden by omitting the card.
   ========================================================================== */

window.PM = window.PM || {};

(function () {
  "use strict";

  var U = PM.util;
  var el = U.el;

  PM.views = PM.views || {};

  /* Sources that are approximate by construction (SCHEMA.md §1.2): a roadmap
     sprint range is sprint-granular, and an mtime is whatever the filesystem
     last happened to write. A floored date is a lower bound whatever produced
     it, so it is checked first. */
  var WEAK_SOURCE_REASONS = {
    roadmap_sprint: "Sprint-granularity date from the roadmap table, not an observation of this item.",
    file_mtime: "Filesystem mtime — the weakest source, used only where git had nothing."
  };

  var FLOORED_REASON =
    "A lower bound, not an observation: this date sits on the git baseline, so the work may be older.";

  var SEVERITY_RANK = { high: 0, medium: 1, low: 2 };
  var SEVERITY_TONE = { high: "bad", medium: "warn", low: "neutral" };

  /* One clause per kind, so a reader meets an unfamiliar kind and the page
     explains it rather than the SCHEMA. Only the kinds actually present are
     printed — a definition list of eight when two occur reads as boilerplate. */
  var KIND_DEFS = {
    prose_gate: "a blocker written in English that nothing can resolve automatically",
    unmet_dependency: "a declared dependency that is not closed",
    cycle: "a dependency loop, so the work can never start",
    stale_wip: "in flight longer than the historical p85",
    unparseable_status: "a brief whose status matches neither vocabulary, so the queue cannot classify it",
    open_adhoc: "a verified finding filed and not yet fixed",
    undated_task: "no date could be resolved, so it is missing from every time series",
    no_lane: "pending with no execution lane, so no agent picks it up"
  };

  /* Resolution-time buckets. Fixed rather than derived: the point of the
     histogram is to compare runs of this dashboard, and a bucket edge that
     moved with the data would make two runs incomparable. */
  var AGE_BUCKETS = [
    { key: "0–1 d", min: 0, max: 1 },
    { key: "2–7 d", min: 2, max: 7 },
    { key: "8–30 d", min: 8, max: 30 },
    { key: "31–90 d", min: 31, max: 90 },
    { key: "91+ d", min: 91, max: Infinity }
  ];

  var FILTER_NOTE =
    "This chart shows the whole project; the sprint and lane filters apply to task lists only.";

  /* ----------------------------------------------------------------------
     Small shared readers. Every one of them assumes the payload may be
     missing the field entirely.
     ---------------------------------------------------------------------- */

  function approxReason(source, floored) {
    if (floored) return FLOORED_REASON;
    return WEAK_SOURCE_REASONS[source] || null;
  }

  function isApprox(source, floored) {
    return approxReason(source, floored) != null;
  }

  function dateCell(value, source, floored, formatter) {
    var reason = approxReason(source, floored);
    var text = (formatter || U.fmt.date)(value);
    return el("span", null, [text, reason ? U.approxMark(reason) : null]);
  }

  function chipList(values) {
    var list = (values || []).filter(function (v) { return v != null && v !== ""; });
    if (!list.length) return "—";
    return el("div", { class: "pm-chips" }, list.map(function (v) {
      return el("span", { class: "pm-chip", text: String(v) });
    }));
  }

  function indexById(items) {
    var index = {};
    (items || []).forEach(function (item) {
      if (item && item.id) index[item.id] = item;
    });
    return index;
  }

  function finiteValues(items, key) {
    return (items || []).map(function (item) { return item ? item[key] : null; })
      .filter(function (v) { return v != null && isFinite(v); });
  }

  /* Every approximation caption on this page is a count computed from the
     payload, and "1 of 5 dates are lower bounds" is as wrong as "2 of 5 date
     is". Rather than branch on the number in five places, a caption is built
     as a label and a fraction with no verb to agree with. */
  function countNote(label, count, total, tail) {
    return U.note(
      label + ": " + U.fmt.n(count) + " of " + U.fmt.n(total) + (tail ? " — " + tail : "."),
      "warn"
    );
  }

  function bucketFor(value) {
    for (var i = 0; i < AGE_BUCKETS.length; i++) {
      if (value >= AGE_BUCKETS[i].min && value <= AGE_BUCKETS[i].max) return AGE_BUCKETS[i];
    }
    return null;                       // only reachable for a negative age
  }

  /* SCHEMA.md §5.4 accepts either an sr-only fallback table or a summarising
     aria-label. Both charts here are short series whose numbers are the whole
     point, so both get the table as well as the label. */
  function srTable(caption, cols, rows) {
    return el("div", { class: "pm-sr-only" }, [
      el("p", { text: caption }),
      U.table(cols, rows, { scroll: false })
    ]);
  }

  /* ======================================================================
     The view
     ====================================================================== */

  PM.views.debt = function (root, data) {
    var payload = data || {};
    var metrics = payload.metrics || {};
    var debt = metrics.debt || {};
    var totals = metrics.totals || {};
    var project = payload.project || {};
    var adhoc = payload.adhoc || [];
    var allTasks = payload.tasks || [];
    var defects = payload.defects || [];
    var risks = debt.risks || [];

    var tasks = (PM.app && PM.app.applyFilter)
      ? PM.app.applyFilter(allTasks)
      : allTasks;

    /* The risk register is pre-aggregated over the whole corpus, so its id
       lookup has to see every task — including ones the active filter hides.
       Filtering the lookup would blank a title rather than hide a row. */
    var taskById = indexById(allTasks);

    var openItems = (debt.open_items && debt.open_items.length)
      ? debt.open_items.filter(function (item) { return item != null; })
      : adhoc.filter(function (item) { return item && item.state === "open"; });
    var resolvedItems = adhoc.filter(function (item) {
      return item && item.state === "resolved";
    });

    /* The tiles count the same arrays the tables below render: a tile that
       disagreed with the table under it would be worse than no tile at all.
       metrics.totals is the fallback only where the array is absent entirely. */
    var openCount = (adhoc.length || openItems.length)
      ? openItems.length : (totals.adhoc_open || 0);
    var resolvedCount = adhoc.length
      ? resolvedItems.length : (totals.adhoc_resolved || 0);

    var oldestOpen = U.st.max(finiteValues(openItems, "age_days"));
    var highRisks = risks.filter(function (risk) {
      return risk && String(risk.severity).toLowerCase() === "high";
    });

    /* ------------------------------------------------------------------
       1. Headline tiles
       ------------------------------------------------------------------ */
    root.appendChild(el("div", { class: "pm-kpi-row" }, [
      U.kpi({
        label: "Open ad-hoc items",
        value: openCount,
        tone: openCount > 0 ? "warn" : "good",
        sub: openCount > 0
          ? "Verified findings filed and not yet fixed"
          : "Every filed finding has been resolved",
        hint: "Items under ## Open in the ad-hoc task file."
      }),
      U.kpi({
        label: "Resolved ad-hoc items",
        value: resolvedCount,
        tone: "neutral",
        sub: "Closed out over the life of the corpus",
        hint: "Items under ## Resolved in the ad-hoc task file."
      }),
      U.kpi({
        label: "High-severity risks",
        value: highRisks.length,
        tone: highRisks.length > 0 ? "bad" : "good",
        sub: U.fmt.plural(risks.length, "derived risk") + " in total",
        hint: "Entries in metrics.debt.risks with severity high."
      }),
      U.kpi({
        label: "Oldest open item",
        value: oldestOpen,
        display: U.fmt.days(oldestOpen),
        tone: U.toneFor(oldestOpen, { invert: true, bad: 60, warn: 30 }),
        sub: oldestOpen == null
          ? "No open item carries a resolvable found date"
          : "Measured from the item's own found date",
        hint: "Over 30 days warns; over 60 days is bad."
      })
    ]));

    /* ------------------------------------------------------------------
       2-3. Defects, then the derived register
       ------------------------------------------------------------------ */
    var bandA = U.section(
      "Corpus defects and derived risk",
      "A defect means the corpus this dashboard reads could not be parsed cleanly, " +
      "so it outranks every other finding on the page."
    );
    root.appendChild(bandA);

    renderDefects(bandA.body, defects);
    renderRisks(bandA.body, risks, taskById);

    /* ------------------------------------------------------------------
       4-6. The ad-hoc backlog
       ------------------------------------------------------------------ */
    var bandB = U.section(
      "Ad-hoc debt",
      "The ad-hoc file holds findings observed and verified in this repo — not a " +
      "wish list. An item leaves it either by being fixed in place or by being " +
      "promoted to a task brief."
    );
    root.appendChild(bandB);

    renderOpenAdhoc(bandB.body, openItems, resolvedItems);
    renderTrend(bandB.body, debt.adhoc_trend || [], project, metrics, adhoc);
    renderResolutionTime(bandB.body, resolvedItems);

    /* ------------------------------------------------------------------
       7-8. What the time series drop, and what has stalled
       ------------------------------------------------------------------ */
    var bandC = U.section(
      "Excluded and stalled work",
      "Two populations worth naming explicitly: tasks no chart on this dashboard " +
      "can plot, and pending tasks already older than the corpus's own p85."
    );
    root.appendChild(bandC);

    renderUndated(bandC.body, tasks);
    renderStaleWip(bandC.body, tasks, metrics.cycle_time || {});
  };

  /* ======================================================================
     2. Corpus defects
     ====================================================================== */

  function renderDefects(host, defects) {
    var card = U.card(
      "Corpus defects",
      defects.length
        ? U.fmt.plural(defects.length, "defect") + " reported by the task queue and the collector"
        : "Nothing reported by the task queue or the collector",
      { span: "full" }
    );
    host.appendChild(card);

    if (!defects.length) {
      card.body.appendChild(U.note("The task corpus reports no conformance defects.", "good"));
      return;
    }

    /* A single-column table rather than an <ol>: the stylesheet resets list
       markers away, so an ordered list would render unnumbered anyway. */
    card.body.appendChild(U.table(
      [{ key: function (row) { return row; }, label: "Defect" }],
      defects
    ));
    card.body.appendChild(U.note(
      "Each line is something the queue or the collector could not classify. Until " +
      "these are fixed, any figure on this dashboard derived from the affected " +
      "briefs is suspect."
    ));
  }

  /* ======================================================================
     3. Risk register
     ====================================================================== */

  function renderRisks(host, risks, taskById) {
    var card = U.card(
      "Risk register",
      risks.length
        ? U.fmt.plural(risks.length, "risk") + ", grouped high to low"
        : "Nothing derived from the corpus",
      { span: "full" }
    );
    host.appendChild(card);

    if (!risks.length) {
      card.body.appendChild(U.empty("No open risks were derived from the corpus."));
      return;
    }

    var kindCounts = {};
    var kindOrder = [];
    risks.forEach(function (risk) {
      var kind = String((risk && risk.kind) || "unknown");
      if (kindCounts[kind] == null) { kindCounts[kind] = 0; kindOrder.push(kind); }
      kindCounts[kind] += 1;
    });
    kindOrder.sort(function (a, b) {
      if (kindCounts[a] !== kindCounts[b]) return kindCounts[b] - kindCounts[a];
      return a < b ? -1 : (a > b ? 1 : 0);
    });

    card.body.appendChild(el("div", { class: "pm-chips" }, kindOrder.map(function (kind) {
      return el("span", {
        class: "pm-chip",
        text: U.fmt.deCamel(kind) + " · " + U.fmt.n(kindCounts[kind])
      });
    })));

    var ranked = risks.slice().sort(function (a, b) {
      var ra = severityRank(a), rb = severityRank(b);
      if (ra !== rb) return ra - rb;
      var ka = String((a && a.kind) || ""), kb = String((b && b.kind) || "");
      if (ka !== kb) return ka < kb ? -1 : 1;
      var la = labelOf(a), lb = labelOf(b);
      return la < lb ? -1 : (la > lb ? 1 : 0);
    });

    card.body.appendChild(U.table([
      {
        key: "severity", label: "Severity", width: "8rem",
        fmt: function (value) {
          var key = String(value || "").toLowerCase();
          /* A severity outside the schema's low|medium|high is a generator
             bug, so it is warned rather than toned neutral — an ungraded risk
             must not read as the calmest row on the page. */
          return U.badge(key || "unrated", SEVERITY_TONE[key] || "warn");
        }
      },
      {
        key: "kind", label: "Kind", width: "12rem",
        fmt: function (value) {
          return U.badge(U.fmt.deCamel(value || "unknown"), "neutral");
        }
      },
      {
        key: function (row) { return row; }, label: "Item",
        fmt: function (row) {
          var task = row && row.id ? taskById[row.id] : null;
          return el("div", null, [
            el("code", { class: "pm-mono", text: labelOf(row) || "—" }),
            /* Only a risk whose id happens to be a task id can carry a title;
               a cycle or a lane risk names something else entirely. */
            task && task.title ? el("div", { text: task.title }) : null
          ]);
        }
      },
      {
        key: "detail", label: "Detail",
        fmt: function (value) {
          var text = String(value == null ? "" : value);
          if (!text) return "—";
          return el("span", { title: text, text: U.fmt.truncate(text, 200) });
        }
      }
    ], ranked, { cls: "is-compact" }));

    var defined = [], undocumented = [];
    kindOrder.forEach(function (kind) {
      if (KIND_DEFS[kind]) defined.push(kind + " = " + KIND_DEFS[kind]);
      else undocumented.push(kind);
    });
    if (defined.length) card.body.appendChild(U.note(defined.join("; ") + "."));
    if (undocumented.length) {
      card.body.appendChild(U.note(
        "Shown as the generator emitted them, with no definition in the schema: " +
        undocumented.join(", ") + ".",
        "warn"
      ));
    }

    card.body.appendChild(U.note(
      "This register covers the whole project; the sprint and lane filters apply to " +
      "task lists only. Detail text is truncated at 200 characters — hover a cell " +
      "for the full string."
    ));
  }

  function severityRank(risk) {
    var rank = SEVERITY_RANK[String((risk && risk.severity) || "").toLowerCase()];
    /* An unrated severity sorts last but is never dropped: a finding the
       generator could not grade is still a finding. */
    return rank == null ? 3 : rank;
  }

  function labelOf(risk) {
    if (!risk) return "";
    return String(risk.label != null && risk.label !== "" ? risk.label : (risk.id || ""));
  }

  /* ======================================================================
     4. Open ad-hoc items
     ====================================================================== */

  function renderOpenAdhoc(host, openItems, resolvedItems) {
    var card = U.card(
      "Open ad-hoc items",
      openItems.length
        ? U.fmt.plural(openItems.length, "open item") + ", oldest first"
        : "Nothing open",
      { span: "full" }
    );
    host.appendChild(card);

    if (!openItems.length) {
      card.body.appendChild(U.empty(
        "No ad-hoc item is currently open, so there is nothing to list — every " +
        "filed finding has been resolved or promoted to a task brief."
      ));
      return;
    }

    var resolvedAges = finiteValues(resolvedItems, "age_days");
    var p85 = resolvedAges.length ? U.st.percentile(resolvedAges, 85) : null;

    var sorted = openItems.slice().sort(function (a, b) {
      /* An item whose found date never resolved has no age; it sorts last
         rather than pretending to be the newest. */
      var aa = a && a.age_days != null && isFinite(a.age_days) ? a.age_days : -1;
      var bb = b && b.age_days != null && isFinite(b.age_days) ? b.age_days : -1;
      if (aa !== bb) return bb - aa;
      return ((a && a.number) || 0) - ((b && b.number) || 0);
    });

    card.body.appendChild(U.table([
      {
        key: "number", label: "#", align: "right", width: "4rem",
        fmt: function (value) {
          return el("code", { class: "pm-mono", text: value == null ? "—" : String(value) });
        }
      },
      {
        key: "title", label: "Title",
        fmt: function (value) {
          var text = String(value == null ? "" : value);
          if (!text) return "—";
          return el("span", { title: text, text: U.fmt.truncate(text, 110) });
        }
      },
      {
        key: function (row) { return row; }, label: "Found", width: "9rem",
        cls: "pm-nowrap",
        fmt: function (row) {
          return dateCell(row.found_at, row.found_at_source, row.found_at_floored,
                          U.fmt.dateLong);
        }
      },
      {
        key: function (row) { return row; }, label: "Age", align: "right", width: "10rem",
        fmt: function (row) {
          var over = p85 != null && row.age_days != null && isFinite(row.age_days) &&
                     row.age_days > p85;
          return el("span", { class: "pm-nowrap" }, [
            U.fmt.days(row.age_days),
            over ? " " : null,
            over ? U.badge("over p85", "bad") : null
          ]);
        }
      },
      {
        key: "promoted_to", label: "Promoted to", width: "9rem",
        fmt: function (value) { return chipList(value ? [value] : []); }
      },
      {
        key: "task_ids", label: "Related tasks",
        fmt: function (value) { return chipList(value); }
      }
    ], sorted, { cls: "is-compact" }));

    var approxFound = sorted.filter(function (item) {
      return isApprox(item.found_at_source, item.found_at_floored);
    }).length;
    var undatedFound = sorted.filter(function (item) { return item.found_at == null; }).length;

    card.body.appendChild(U.note(
      "An entry in the ad-hoc file is something actually observed and verified in " +
      "this repo, not a hypothetical; it is promoted to a task brief when someone " +
      "picks it up, and the Promoted-to column names that brief."
    ));

    if (p85 != null) {
      card.body.appendChild(U.note(
        "The over-p85 badge compares an item's age against the p85 of resolved " +
        "items, " + U.fmt.days(p85) + " (n = " + U.fmt.n(resolvedAges.length) + ")."
      ));
    } else {
      card.body.appendChild(U.note(
        "No resolved item carries a usable age, so there is no p85 to compare these " +
        "ages against.",
        "warn"
      ));
    }

    if (approxFound > 0) {
      card.body.appendChild(countNote(
        "Found dates that are lower bounds or sprint-granular rather than observations",
        approxFound, sorted.length, "see Data & theme."
      ));
    }
    if (undatedFound > 0) {
      card.body.appendChild(countNote(
        "Open items whose found date never resolved, so their age is unknown",
        undatedFound, sorted.length, "see Data & theme."
      ));
    }
  }

  /* ======================================================================
     5. Ad-hoc debt trend
     ====================================================================== */

  function renderTrend(host, trend, project, metrics, adhoc) {
    /* A point whose period date did not resolve has no position on a time
       axis, and an unparsed endpoint collapses the domain onto the epoch,
       which draws the whole series in the first pixel. Such points are
       dropped from the plot and counted below rather than passed through. */
    var supplied = (trend || []).length;
    var points = (trend || []).filter(function (p) {
      return p && U.d.parse(p.date) != null;
    });
    var dropped = supplied - points.length;

    var card = U.card(
      "Ad-hoc debt trend",
      points.length
        ? U.fmt.plural(points.length, "point") + " — open items against cumulative resolved"
        : "No series",
      { span: 2 }
    );
    host.appendChild(card);

    if (!points.length) {
      card.body.appendChild(U.empty(
        supplied
          ? "No point in the ad-hoc trend series carries a resolvable date, so there " +
            "is no time axis to plot the open and resolved counts against."
          : "The generator produced no ad-hoc trend series, so there is no history of " +
            "open against resolved items to plot."
      ));
      return;
    }

    var first = points[0].date;
    var last = points[points.length - 1].date;
    var maxY = U.st.max([
      U.st.max(finiteValues(points, "open")),
      U.st.max(finiteValues(points, "resolved_cumulative"))
    ]);

    var chart = PM.svg.chart(card.body, {
      height: 280,
      margin: { t: 16, r: 18, b: 34, l: 48 },
      xType: "time",
      yType: "linear",
      label: "Open ad-hoc items and cumulative resolved items, " +
             U.fmt.dateLong(first) + " to " + U.fmt.dateLong(last),
      x: { domain: [first, last] },
      y: { domain: [0, maxY == null ? 1 : maxY], nice: true }
    });

    chart.yAxis({ ticks: 5, grid: true });
    chart.xAxis({ ticks: 6, format: U.fmt.date });

    /* `open` is left unconverted: coercing a missing count to 0 would draw the
       area down to the axis and read as "nothing was open that period", which
       is the one thing an unknown must never look like. A null drops the
       point, so the fill bridges the gap instead of claiming a zero. */
    chart.area(points, {
      x: function (p) { return p.date; },
      y0: 0,
      y1: function (p) { return p.open; },
      cls: "pm-a4",
      stroke: "pm-s4"
    });
    chart.line(points, {
      x: function (p) { return p.date; },
      y: function (p) { return p.resolved_cumulative; },
      cls: "pm-s2",
      width: 2
    });

    /* The plot group is not clipped, so a today marker outside the series
       window would draw across the axis and the card padding. diffDays returns
       null for a date it cannot read, and `null >= 0` is true, so the two
       offsets are tested for null before they are compared. */
    var today = project.today || metrics.as_of;
    var sinceFirst = U.d.diffDays(first, today);
    var untilLast = U.d.diffDays(today, last);
    if (sinceFirst != null && untilLast != null && sinceFirst >= 0 && untilLast >= 0) {
      chart.vLine(today, { cls: "pm-ref", label: "today" });
    }

    chart.hover(points, {
      x: function (p) { return p.date; },
      y: function (p) { return p.resolved_cumulative; },
      label: function (p) {
        return [
          U.fmt.dateLong(p.date),
          "Open: " + U.fmt.n(p.open),
          "Resolved to date: " + U.fmt.n(p.resolved_cumulative)
        ];
      }
    });

    chart.legend([
      { label: "Open items", cls: "pm-a4" },
      { label: "Resolved, cumulative", cls: "pm-s2" }
    ]);
    chart.done();

    card.body.appendChild(srTable(
      "Ad-hoc debt trend, one row per period.",
      [
        { key: "date", label: "Date" },
        { key: "open", label: "Open" },
        { key: "resolved_cumulative", label: "Resolved, cumulative" }
      ],
      points
    ));

    card.body.appendChild(U.note(
      "Read the two series against each other: open flat while resolved climbs is " +
      "healthy — findings are being paid off as fast as they arrive. Open climbing " +
      "is debt accruing faster than it is paid, whatever the resolved line does."
    ));
    card.body.appendChild(U.note(FILTER_NOTE));

    if (dropped > 0) {
      card.body.appendChild(countNote(
        "Trend points left off the chart because their own period date did not " +
        "resolve",
        dropped, supplied
      ));
    }

    var approxDates = (adhoc || []).filter(function (item) {
      return item && (isApprox(item.found_at_source, item.found_at_floored) ||
                      isApprox(item.resolved_at_source, item.resolved_at_floored));
    }).length;
    if (approxDates > 0 && adhoc.length) {
      card.body.appendChild(countNote(
        "Ad-hoc items on a derived rather than an observed date, so the period a " +
        "step lands in can itself be a lower bound",
        approxDates, adhoc.length, "see Data & theme."
      ));
    }
  }

  /* ======================================================================
     6. Resolution time
     ====================================================================== */

  function renderResolutionTime(host, resolvedItems) {
    var samples = resolvedItems.filter(function (item) {
      return item && item.found_at != null && item.resolved_at != null &&
             item.age_days != null && isFinite(item.age_days);
    });
    var excluded = resolvedItems.length - samples.length;

    var card = U.card(
      "Resolution time",
      samples.length
        ? "n = " + U.fmt.n(samples.length) + " resolved items with both dates"
        : "No usable sample",
      null
    );
    host.appendChild(card);

    /* Three is the floor for quoting a p50 and a p85 at all: with two samples
       the nearest-rank percentiles are just the two values back again. */
    if (samples.length < 3) {
      card.body.appendChild(U.empty(
        "Too small a sample to characterise resolution time: the histogram and its " +
        "percentiles need at least three resolved items carrying both a found and a " +
        "resolved date, and this corpus has " + U.fmt.n(samples.length) + "."
      ));
      return;
    }

    var ages = samples.map(function (item) { return item.age_days; });
    var negative = ages.filter(function (v) { return v < 0; }).length;

    var rows = AGE_BUCKETS.map(function (bucket) {
      return { bucket: bucket.key, count: 0 };
    });
    var rowByKey = {};
    rows.forEach(function (row) { rowByKey[row.bucket] = row; });
    ages.forEach(function (value) {
      var bucket = bucketFor(value);
      if (bucket) rowByKey[bucket.key].count += 1;
    });

    var p50 = U.st.percentile(ages, 50);
    var p85 = U.st.percentile(ages, 85);
    var maxCount = U.st.max(finiteValues(rows, "count"));

    var chart = PM.svg.chart(card.body, {
      height: 240,
      margin: { t: 16, r: 14, b: 34, l: 42 },
      xType: "band",
      yType: "linear",
      label: "Resolution time of " + U.fmt.n(samples.length) +
             " resolved ad-hoc items, bucketed by age in days",
      x: { domain: rows.map(function (row) { return row.bucket; }), padding: 0.25 },
      y: { domain: [0, maxCount == null ? 1 : maxCount], nice: true }
    });

    chart.yAxis({ ticks: 4, grid: true });
    chart.xAxis({});
    chart.bars(rows, {
      x: function (row) { return row.bucket; },
      y: function (row) { return row.count; },
      cls: "pm-a3",
      label: function (row) {
        return [row.bucket, U.fmt.plural(row.count, "item")];
      }
    });

    /* Percentile markers land on the bucket that contains them, because the x
       axis is a band of ranges and there is no pixel for "1.5 days". Two
       markers in one bucket become one label, or the two texts overlap. */
    var bucket50 = bucketFor(p50);
    var bucket85 = bucketFor(p85);
    if (bucket50 && bucket85 && bucket50.key === bucket85.key) {
      chart.vLine(bucket50.key, {
        cls: "pm-ref",
        label: "p50 " + U.fmt.days(p50) + " · p85 " + U.fmt.days(p85)
      });
    } else {
      if (bucket50) chart.vLine(bucket50.key, { cls: "pm-ref", label: "p50 = " + U.fmt.days(p50) });
      if (bucket85) chart.vLine(bucket85.key, { cls: "pm-ref", label: "p85 = " + U.fmt.days(p85) });
    }

    chart.done();

    card.body.appendChild(srTable(
      "Resolution time, count of resolved ad-hoc items per age bucket.",
      [{ key: "bucket", label: "Age" }, { key: "count", label: "Items" }],
      rows
    ));

    card.body.appendChild(U.note(
      "n = " + U.fmt.n(samples.length) + " resolved items carrying both a found and " +
      "a resolved date. Half resolved within " + U.fmt.days(p50) + " and 85% within " +
      U.fmt.days(p85) + "; the markers name the bucket each percentile falls in, not " +
      "a position inside it."
    ));

    if (excluded > 0) {
      card.body.appendChild(countNote(
        "Resolved items left out because one of the two dates could not be resolved",
        excluded, resolvedItems.length
      ));
    }

    var approxSamples = samples.filter(function (item) {
      return isApprox(item.found_at_source, item.found_at_floored) ||
             isApprox(item.resolved_at_source, item.resolved_at_floored);
    }).length;
    if (approxSamples > 0) {
      card.body.appendChild(countNote(
        "Durations resting on a derived date, so they are lower bounds rather than " +
        "measurements",
        approxSamples, samples.length, "see Data & theme."
      ));
    }

    if (negative > 0) {
      card.body.appendChild(U.note(
        "Not bucketed: " + U.fmt.plural(negative, "item") + " with a resolved date " +
        "earlier than its own found date. That is a corpus inconsistency, not a fast " +
        "resolution, so the bars above sum to fewer than n.",
        "bad"
      ));
    }
  }

  /* ======================================================================
     7. Undated tasks
     ====================================================================== */

  function renderUndated(host, tasks) {
    var undated = tasks.filter(function (task) {
      if (!task) return false;
      return task.created_at == null ||
             (task.closed_at == null && task.state === "done");
    });

    var card = U.card(
      "Undated tasks",
      undated.length
        ? U.fmt.plural(undated.length, "task") + " of " + U.fmt.n(tasks.length) + " in view"
        : "None in the current filter",
      null
    );
    host.appendChild(card);

    if (!undated.length) {
      card.body.appendChild(U.empty(
        "Every task in the current filter resolved the dates its state needs, so " +
        "none is excluded from the time series."
      ));
      return;
    }

    card.body.appendChild(U.table([
      {
        key: "id", label: "Task", width: "8rem", cls: "pm-mono",
        fmt: function (value) { return String(value || "—"); }
      },
      { key: "title", label: "Title" },
      {
        key: "state", label: "State", width: "7rem",
        fmt: function (value) {
          return U.badge(U.stateLabel(value), U.stateTone(value));
        }
      },
      {
        key: function (row) { return row; }, label: "Missing", width: "9rem",
        fmt: function (row) {
          var missing = [];
          if (row.created_at == null) missing.push("created_at");
          if (row.closed_at == null && row.state === "done") missing.push("closed_at");
          return chipList(missing);
        }
      },
      {
        key: function (row) { return row; }, label: "Date sources",
        fmt: function (row) {
          return chipList([
            "created: " + (row.created_at_source || "unknown"),
            "closed: " + (row.closed_at_source || "unknown")
          ]);
        }
      }
    ], undated, { cls: "is-compact" }));

    card.body.appendChild(U.note(
      "These tasks are excluded from every time series on this dashboard — burn-up, " +
      "cumulative flow, throughput, cycle time and the forecast all need a date " +
      "these briefs do not have. The Data & theme tab lists the resolution order the " +
      "collector tried before giving up."
    ));
    card.body.appendChild(U.note(
      "The sprint and lane filters apply to this table, so the counts move with the " +
      "header controls."
    ));
  }

  /* ======================================================================
     8. Stale work in progress
     ====================================================================== */

  function renderStaleWip(host, tasks, cycleTime) {
    var p85 = cycleTime.usable === false ? null : cycleTime.p85;
    var pending = tasks.filter(function (task) { return task && task.state === "pending"; });

    var stale = p85 == null ? [] : pending.filter(function (task) {
      return task.age_days != null && isFinite(task.age_days) && task.age_days > p85;
    }).sort(function (a, b) { return b.age_days - a.age_days; });

    var card = U.card(
      "Stale work in progress",
      p85 == null
        ? "No p85 to compare against"
        : U.fmt.plural(stale.length, "task") + " past the " + U.fmt.days(p85) + " p85",
      null
    );
    host.appendChild(card);

    if (p85 == null) {
      card.body.appendChild(U.empty(
        "Cycle time reports no usable p85 for this corpus, so there is no historical " +
        "duration to call a pending task stale against."
      ));
      return;
    }

    if (!pending.length) {
      card.body.appendChild(U.empty(
        "No task is pending in the current filter, so nothing can be stale."
      ));
      return;
    }

    if (!stale.length) {
      card.body.appendChild(U.empty(
        "No pending task has been open longer than the historical p85 of " +
        U.fmt.days(p85) + "."
      ));
      return;
    }

    card.body.appendChild(U.table([
      {
        key: "id", label: "Task", width: "8rem", cls: "pm-mono",
        fmt: function (value) { return String(value || "—"); }
      },
      { key: "title", label: "Title" },
      {
        key: function (row) { return row; }, label: "Age", align: "right", width: "7rem",
        fmt: function (row) {
          /* An age is only as good as the created_at it counts from. */
          return dateCell(row.age_days, row.created_at_source, row.created_at_floored,
                          U.fmt.days);
        }
      },
      {
        key: function () { return p85; }, label: "p85", align: "right", width: "6rem",
        fmt: function (value) { return U.fmt.days(value); }
      },
      {
        key: "lane", label: "Lane", width: "7rem",
        fmt: function (value) {
          return value ? U.badge(value, "neutral") : U.badge("no lane", "warn");
        }
      },
      {
        key: function (row) { return row; }, label: "Blockers",
        fmt: function (row) {
          var unmet = row.blocked_by_unmet || [];
          var gates = row.prose_gates || [];
          if (!unmet.length && !gates.length) return U.badge("none recorded", "neutral");
          return el("div", { class: "pm-chips" }, [
            unmet.map(function (id) { return el("span", { class: "pm-chip", text: id }); }),
            gates.length ? U.badge(U.fmt.plural(gates.length, "prose gate"), "bad") : null
          ]);
        }
      }
    ], stale, { cls: "is-compact" }));

    var nClause = cycleTime.n != null
      ? "n = " + U.fmt.n(cycleTime.n)
      : "sample size not reported";
    card.body.appendChild(U.note(
      "Historically 85% of closed tasks finished within " + U.fmt.days(p85) + " (" +
      nClause + "); " + U.fmt.plural(stale.length, "pending task") + " above " +
      (stale.length === 1 ? "has" : "have") + " already been open longer than that, " +
      "out of " + U.fmt.plural(pending.length, "pending task") + " in view."
    ));

    var approxAges = stale.filter(function (task) {
      return isApprox(task.created_at_source, task.created_at_floored);
    }).length;
    if (approxAges > 0) {
      card.body.appendChild(countNote(
        "Ages counting from a derived start date, so the true age is at least what " +
        "is shown",
        approxAges, stale.length, "see Data & theme."
      ));
    }
  }
})();
