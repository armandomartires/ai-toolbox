/* ==========================================================================
   22-forecast.js — PM.views.forecast: probabilistic delivery forecasting.

   Everything on this tab comes from metrics.forecast (SCHEMA.md §2.9), which
   the generator computed by resampling observed weekly throughput. Three
   consequences shape the whole file:

     - The series are pre-aggregated over the whole corpus, so the header's
       sprint/lane filters cannot apply to any panel here. Each chart says so
       rather than quietly showing whole-project numbers next to a filtered
       view somewhere else.
     - A percentile is meaningless without its n, so every figure on this tab
       is rendered beside the trial count or the sample size that produced it.
     - The closure dates the simulation learned from are derived, and some are
       lower bounds (SCHEMA.md §1.2). That count is computed from the payload
       and printed under the charts; it is never assumed to be zero.

   The confidence ladder is deliberately toned "neutral" throughout: p95 being
   later than p50 is how a forecast works, not a warning.
   ========================================================================== */

window.PM = window.PM || {};
PM.views = PM.views || {};

(function () {
  "use strict";

  var U = PM.util;
  var el = U.el;

  /* The exact sentence every pre-aggregated panel in this dashboard carries. */
  var FILTER_NOTE = "This chart shows the whole project; the sprint and lane " +
                    "filters apply to task lists only.";

  /* Date sources that are approximate by construction, independent of the
     "_floored" flag: a sprint range is sprint-granular and an mtime is a
     filesystem accident. SCHEMA.md §1.2. */
  var APPROX_SOURCES = { roadmap_sprint: 1, file_mtime: 1 };

  function arr(value) {
    return Array.isArray(value) ? value : [];
  }

  function num(value) {
    return value != null && isFinite(value) ? Number(value) : null;
  }

  /* How many of the corpus's closure dates are lower bounds rather than
     observations. The simulation's input is exactly these dates, so the count
     belongs next to the output. */
  function closureQuality(tasks) {
    var out = { total: 0, approx: 0 };
    arr(tasks).forEach(function (t) {
      if (!t || !t.closed_at) return;
      out.total += 1;
      if (t.closed_at_floored || APPROX_SOURCES[t.closed_at_source]) out.approx += 1;
    });
    return out;
  }

  function approxNote(tasks) {
    var q = closureQuality(tasks);
    if (!q.total || !q.approx) return null;
    return U.note(U.fmt.n(q.approx) + " of " + U.fmt.n(q.total) +
                  " closure dates behind this forecast are lower bounds, not " +
                  "observations — see Data & theme.");
  }

  /* A band scale can only place a reference line on a bucket it owns, so a
     percentile date falling between two buckets snaps to the nearer one. The
     exact dates are in the tiles, which is where a reader quotes them from. */
  function nearestKey(keys, target) {
    if (!U.d.parse(target) || !keys.length) return null;
    var best = null, bestGap = null;
    keys.forEach(function (key) {
      var gap = U.d.diffDays(key, target);
      if (gap == null) return;
      gap = Math.abs(gap);
      if (bestGap == null || gap < bestGap) { bestGap = gap; best = key; }
    });
    return best;
  }

  function maxOf(rows, accessors) {
    var values = [];
    arr(rows).forEach(function (row) {
      accessors.forEach(function (acc) { values.push(num(acc(row))); });
    });
    return U.st.max(values);
  }

  function shareOf(count, total) {
    var c = num(count), t = num(total);
    if (c == null || !t) return null;
    return (c / t) * 100;
  }

  /* KPI sub-line: the week count at this confidence, plus the distance from
     today. A date already in the past is said so rather than shown as a
     negative day count. */
  function tileSub(weeks, date, today) {
    var parts = [];
    var w = num(weeks);
    if (w != null) parts.push(U.fmt.plural(w, "week") + " of throughput");
    var gap = U.d.diffDays(today, date);
    if (gap == null) parts.push("no date resolved");
    else if (gap < 0) parts.push("already past");
    else parts.push("in " + U.fmt.days(gap));
    return parts.join(" · ");
  }

  /* Linear interpolation of the cumulative curve at an arbitrary date, for the
     target-date panel. Returns a position so the caller can refuse to print
     100% as certainty outside the simulated range. */
  function confidenceAt(hist, value) {
    if (!hist.length || !U.d.parse(value)) return null;
    var prev = null, next = null, exact = null;
    hist.forEach(function (h) {
      var delta = U.d.diffDays(h.date, value);     // value - h.date, in days
      if (delta == null) return;
      if (delta === 0) { exact = h; return; }
      if (delta > 0) prev = h;
      else if (next == null) next = h;
    });
    if (exact) return { pct: num(exact.cumulative_pct), position: "in" };
    if (!prev) return { pct: 0, position: "before" };
    if (!next) return { pct: 100, position: "after" };
    var span = U.d.diffDays(prev.date, next.date);
    var into = U.d.diffDays(prev.date, value);
    var a = num(prev.cumulative_pct), b = num(next.cumulative_pct);
    if (a == null || b == null) return null;
    var f = span ? into / span : 0;
    return { pct: a + (b - a) * f, position: "in" };
  }

  function addCard(band, title, sub, opts) {
    var node = U.card(title, sub, opts);
    band.body.appendChild(node);
    return node;
  }

  /* ----------------------------------------------------------------------
     The view
     ---------------------------------------------------------------------- */

  PM.views.forecast = function (root, data) {
    /* The contract hands over an emptied panel, but this function is called
       again on theme change and on resize; clearing is what makes a second
       call replace the tab rather than append a second copy of it. */
    U.clear(root);

    var payload = data || {};
    var metrics = payload.metrics || {};
    var f = metrics.forecast || {};
    var today = (payload.project && payload.project.today) || metrics.as_of || null;

    var hist = arr(f.histogram).filter(function (h) { return h && h.date; });
    var cone = arr(f.cone).filter(function (c) { return c && c.date; });
    var burndown = arr(metrics.burndown).filter(function (b) { return b && b.date; });
    var sample = arr(f.sample_values);
    var pcts = f.percentiles || {};
    var weeks = f.weeks || {};
    var trials = num(f.trials);
    var remaining = num(f.remaining);
    var sampleWeeks = num(f.sample_weeks);
    var zeroWeeks = num(f.zero_weeks);

    /* ---- not usable: one card, one reason, no empty axes ---------------- */
    if (!f || f.usable !== true) {
      var reason = f && f.note ? String(f.note) : null;
      var why = reason
        ? reason + " "
        : "The generator could not compute a forecast from this corpus. ";
      var gate = U.card("Delivery forecast", metrics.forecast
        ? "metrics.forecast.usable is not true"
        : "metrics.forecast is absent from the payload");
      gate.body.appendChild(U.empty(
        why + "A Monte Carlo forecast needs closed tasks with resolvable " +
        "closure dates spread over at least a few periods, so that weekly " +
        "throughput can be sampled; until the corpus has that, any date this " +
        "tab printed would be invented rather than derived."
      ));
      root.appendChild(gate);
      return;
    }

    /* ---- 1. the confidence ladder --------------------------------------- */

    var ladder = [
      { key: "p50", label: "50% chance by" },
      { key: "p85", label: "85% chance by" },
      { key: "p95", label: "95% chance by" }
    ];
    var haveAnyDate = false;
    ladder.forEach(function (step) {
      if (U.d.parse(pcts[step.key])) haveAnyDate = true;
    });

    if (!haveAnyDate) {
      var noDates = U.card("Delivery forecast", "metrics.forecast.percentiles");
      noDates.body.appendChild(U.empty(
        "The simulation ran but resolved no percentile dates, so there is no " +
        "date ladder to show."
      ));
      root.appendChild(noDates);
    } else {
      root.appendChild(el("div", { class: "pm-kpi-row" }, ladder.map(function (step) {
        var date = pcts[step.key];
        return U.kpi({
          label: step.label,
          display: U.fmt.dateLong(date),
          sub: tileSub(weeks[step.key], date, today),
          tone: "neutral",
          hint: "The date by which this share of the simulated runs had " +
                "finished all remaining work."
        });
      })));
      root.appendChild(U.note(
        "Read the three as one ladder, not as a good case and a bad case: the " +
        "later date is the same forecast asked for more certainty. All three " +
        "come from the same " + (trials == null ? "set of" : U.fmt.n(trials)) +
        " runs over " + (sampleWeeks == null ? "the" : U.fmt.n(sampleWeeks)) +
        " observed weeks, so they stand or fall together."
      ));
      root.appendChild(U.note(FILTER_NOTE));
    }

    /* ---- 2 + 3. the distribution and the curve -------------------------- */

    var distBand = U.section("Simulated completion dates",
      "Where the runs landed, and how much of the distribution each date buys.");
    root.appendChild(distBand);

    var dates = hist.map(function (h) { return h.date; });
    var markers = ladder.map(function (step) {
      return { label: step.key, key: nearestKey(dates, pcts[step.key]) };
    }).filter(function (m) { return m.key != null; });

    var distCard = addCard(distBand, "Completion-date distribution",
      trials == null
        ? "One bar per simulated finish date."
        : U.fmt.n(trials) + " runs, one bar per finish date",
      { span: 2 });

    if (!hist.length) {
      distCard.body.appendChild(U.empty(
        "The simulation produced no completion-date histogram, so there is no " +
        "distribution to plot."
      ));
    } else {
      var c1 = PM.svg.chart(distCard.body, {
        height: 300,
        margin: { t: 20, r: 18, b: 46, l: 58 },
        xType: "band",
        yType: "linear",
        x: { domain: dates, padding: 0.22 },
        y: { domain: [0, maxOf(hist, [function (h) { return h.count; }]) || 1] },
        label: "Histogram of simulated completion dates"
      });
      c1.yAxis({ ticks: 5, grid: true, title: "Runs" });
      c1.xAxis({ ticks: 8, format: U.fmt.date, title: "Simulated finish date" });
      c1.bars(hist, {
        x: function (h) { return h.date; },
        y: function (h) { return h.count; },
        cls: "pm-a1"
      });
      markers.forEach(function (m) {
        c1.vLine(m.key, { cls: "pm-ref", label: m.label });
      });
      c1.hover(hist, {
        x: function (h) { return h.date; },
        y: function (h) { return h.count; },
        label: function (h) {
          return [
            U.fmt.dateLong(h.date),
            num(h.weeks) == null ? null : U.fmt.plural(h.weeks, "week") + " from now",
            U.fmt.plural(num(h.count) || 0, "run") + " finished here",
            "Share of runs: " + U.fmt.pct(shareOf(h.count, trials)),
            "Cumulative: " + U.fmt.pct(h.cumulative_pct)
          ];
        }
      });
      c1.done();
      distCard.body.appendChild(U.note(
        (trials == null ? "An unreported number of" : U.fmt.n(trials)) +
        " simulated projects, resampling " +
        (sampleWeeks == null ? "the" : U.fmt.n(sampleWeeks)) +
        " observed weeks of throughput."
      ));
      var distApprox = approxNote(payload.tasks);
      if (distApprox) distCard.body.appendChild(distApprox);
      distCard.body.appendChild(U.note(FILTER_NOTE));
    }

    var curveCard = addCard(distBand, "Confidence curve",
      "Share of runs finished by each date");

    if (!hist.length) {
      curveCard.body.appendChild(U.empty(
        "The cumulative curve is drawn from the same histogram, and there is " +
        "no histogram to draw it from."
      ));
    } else {
      var c2 = PM.svg.chart(curveCard.body, {
        height: 280,
        margin: { t: 20, r: 18, b: 46, l: 52 },
        xType: "band",
        yType: "linear",
        x: { domain: dates, padding: 0.22 },
        y: { domain: [0, 100] },
        label: "Cumulative share of simulated runs finished by each date"
      });
      c2.yAxis({
        ticks: 5, grid: true, title: "Confidence",
        format: function (v) { return U.fmt.pct(v, 0); }
      });
      c2.xAxis({ ticks: 6, format: U.fmt.date });
      [50, 85, 95].forEach(function (level) {
        c2.hLine(level, { cls: "pm-ref", label: level + "%" });
      });
      c2.line(hist, {
        x: function (h) { return h.date; },
        y: function (h) { return num(h.cumulative_pct); },
        cls: "pm-s2",
        width: 2
      });
      c2.dots(hist, {
        x: function (h) { return h.date; },
        y: function (h) { return num(h.cumulative_pct); },
        r: 2.5,
        cls: "pm-s2"
      });
      c2.hover(hist, {
        x: function (h) { return h.date; },
        y: function (h) { return num(h.cumulative_pct); },
        label: function (h) {
          return [
            U.fmt.dateLong(h.date),
            U.fmt.pct(h.cumulative_pct) + " of runs finished by this date",
            trials == null ? null : "out of " + U.fmt.n(trials) + " runs"
          ];
        }
      });
      c2.done();
      curveCard.body.appendChild(U.note(FILTER_NOTE));
    }

    /* ---- 4. burn-down with the forecast cone ---------------------------- */

    var coneBand = U.section("Projected remaining work",
      "Observed burn-down, continued as three confidence levels.");
    root.appendChild(coneBand);

    var history = burndown.filter(function (b) {
      var gap = U.d.diffDays(b.date, today);
      return gap == null ? true : gap >= 0;
    });
    var lastObserved = history.length ? history[history.length - 1] : null;

    /* Anchor the cone on the last observed point. Without it the three dashed
       lines start in mid-air one period to the right of the solid line, which
       reads as a jump in remaining work that the model never predicted. */
    var coneLines = cone;
    if (lastObserved && cone.length && num(lastObserved.remaining) != null) {
      coneLines = [{
        date: lastObserved.date,
        p50: num(lastObserved.remaining),
        p85: num(lastObserved.remaining),
        p95: num(lastObserved.remaining)
      }].concat(cone);
    }

    var coneCard = addCard(coneBand, "Burn-down with forecast cone",
      remaining == null
        ? "Remaining tasks, observed and projected"
        : U.fmt.plural(remaining, "task") + " remaining at " +
          U.fmt.dateLong(today),
      { span: 2 });

    if (!history.length && !cone.length) {
      coneCard.body.appendChild(U.empty(
        "Neither an observed burn-down nor a projected cone is present, so " +
        "there is no remaining-work line to draw."
      ));
    } else {
      var xFrom = history.length ? history[0].date : (coneLines[0] && coneLines[0].date);
      var xTo = cone.length ? cone[cone.length - 1].date
                            : (history.length ? history[history.length - 1].date : null);
      var yMax = U.st.max([
        maxOf(history, [function (b) { return b.remaining; }]),
        maxOf(coneLines, [
          function (c) { return c.p50; },
          function (c) { return c.p85; },
          function (c) { return c.p95; }
        ])
      ]) || 1;

      var c3 = PM.svg.chart(coneCard.body, {
        height: 320,
        margin: { t: 22, r: 20, b: 38, l: 56 },
        xType: "time",
        yType: "linear",
        x: { domain: [xFrom, xTo] },
        y: { domain: [0, yMax] },
        label: "Remaining tasks over time with a three-level forecast cone"
      });
      c3.yAxis({ ticks: 5, grid: true, title: "Tasks remaining" });
      c3.xAxis({ ticks: 6, format: U.fmt.date });

      if (cone.length && U.d.parse(today) && U.d.parse(xTo)) {
        c3.xBand(today, xTo, { cls: "is-forecast", label: "simulated" });
      }
      c3.hLine(0, { cls: "pm-ref", label: "0 left" });

      c3.line(history, {
        x: function (b) { return b.date; },
        y: function (b) { return num(b.remaining); },
        cls: "pm-s1",
        width: 2
      });
      [
        { key: "p50", cls: "pm-s2" },
        { key: "p85", cls: "pm-s4" },
        { key: "p95", cls: "pm-s6" }
      ].forEach(function (level) {
        c3.line(coneLines, {
          x: function (c) { return c.date; },
          y: function (c) { return num(c[level.key]); },
          cls: level.cls,
          width: 2,
          dashed: true
        });
      });

      var hoverRows = history.map(function (b) {
        return { date: b.date, remaining: num(b.remaining) };
      }).concat(cone.map(function (c) {
        return { date: c.date, p50: num(c.p50), p85: num(c.p85), p95: num(c.p95) };
      }));
      c3.hover(hoverRows, {
        x: function (r) { return r.date; },
        y: function (r) { return r.remaining != null ? r.remaining : r.p50; },
        label: function (r) {
          if (r.remaining != null) {
            return [U.fmt.dateLong(r.date) + " — observed",
                    U.fmt.plural(r.remaining, "task") + " remaining"];
          }
          return [
            U.fmt.dateLong(r.date) + " — simulated",
            "50% of runs: " + U.fmt.plural(r.p50 == null ? 0 : r.p50, "task") + " left",
            "85% of runs: " + U.fmt.plural(r.p85 == null ? 0 : r.p85, "task") + " left",
            "95% of runs: " + U.fmt.plural(r.p95 == null ? 0 : r.p95, "task") + " left"
          ];
        }
      });

      /* The legend names only what was actually drawn — listing a cone series
         that had no data would invent three lines the reader cannot find. */
      var keys = [];
      if (history.length) keys.push({ label: "Remaining (observed)", cls: "pm-s1" });
      if (cone.length) {
        keys.push({ label: "50% of runs", cls: "pm-s2" });
        keys.push({ label: "85% of runs", cls: "pm-s4" });
        keys.push({ label: "95% of runs", cls: "pm-s6" });
      }
      c3.legend(keys);
      c3.done();

      if (!history.length) {
        coneCard.body.appendChild(U.note(
          "No observed burn-down is present, so the solid history line is " +
          "absent and only the simulated cone is drawn."
        ));
      }
      if (!cone.length) {
        coneCard.body.appendChild(U.note(
          "The forecast produced no cone, so this is history only — nothing " +
          "right of today is projected."
        ));
      }
      /* Only explain the cone's shape where a cone was drawn; describing the
         widening of three absent lines would send the reader looking for
         something this chart does not contain. */
      if (cone.length) {
        var zeroPhrase = "";
        if (zeroWeeks != null) {
          zeroPhrase = sampleWeeks == null
            ? " (" + U.fmt.n(zeroWeeks) + " of them)"
            : " (" + U.fmt.n(zeroWeeks) + " of " + U.fmt.n(sampleWeeks) + ")";
        }
        coneCard.body.appendChild(U.note(
          "The cone widens with distance because the sample it draws from " +
          "includes weeks with no closures" + zeroPhrase + ": a run that draws " +
          "several of those in a row finishes much later than one that does not."
        ));
      }
      var coneApprox = approxNote(payload.tasks);
      if (coneApprox) coneCard.body.appendChild(coneApprox);
      coneCard.body.appendChild(U.note(FILTER_NOTE));
    }

    /* ---- 5. target-date probability ------------------------------------- */

    var targetCard = addCard(coneBand, "Probability of a target date",
      "Pick a date; read it off the same curve");

    if (!hist.length) {
      targetCard.body.appendChild(U.empty(
        "Without a histogram there is no distribution to read a probability " +
        "off, so this panel has nothing to answer with."
      ));
    } else {
      var firstDate = hist[0].date;
      var lastDate = hist[hist.length - 1].date;
      var seed = U.d.iso(pcts.p85) || U.d.iso(pcts.p50) || U.d.iso(lastDate);
      var readout = document.createTextNode("");

      /* Only this text node is rewritten on input. Re-rendering the tab would
         rebuild every chart above and steal focus from the picker. */
      var describe = function (value) {
        var answer = confidenceAt(hist, value);
        var n = trials == null ? "the" : U.fmt.n(trials);
        if (!answer) {
          return "Pick a date to see how many of the simulated runs finish by then.";
        }
        if (answer.position === "before") {
          return "Essentially 0%: none of " + n + " runs finishes by " +
                 U.fmt.dateLong(value) + ". The earliest simulated finish is " +
                 U.fmt.dateLong(firstDate) + ".";
        }
        if (answer.position === "after") {
          return "Beyond the simulated range: all of " + n + " runs had " +
                 "finished by " + U.fmt.dateLong(lastDate) + ", so " +
                 U.fmt.dateLong(value) + " is off the end of the distribution " +
                 "rather than a certainty.";
        }
        /* A histogram row with no cumulative share cannot be turned into a
           probability, and inventing one here would be the single most
           misread number on the tab. */
        if (answer.pct == null) {
          return "The simulated distribution records no cumulative share at " +
                 U.fmt.dateLong(value) + ", so this date cannot be answered " +
                 "from it.";
        }
        /* The two edges of the distribution are stated as facts about the
           sample. Rounding 99.7 to "100%" would read as a guarantee, and
           rounding 0.4 to "0%" would deny a finish the model did produce. */
        if (answer.pct >= 99.5) {
          return "Every one of " + n + " runs had finished by " +
                 U.fmt.dateLong(value) + " — the far edge of the simulated " +
                 "range, not a guarantee.";
        }
        if (answer.pct < 0.5) {
          return "Fewer than 1% of " + n + " runs finish by " +
                 U.fmt.dateLong(value) + ".";
        }
        return "About " + U.fmt.pct(answer.pct, 0) + " of " + n +
               " simulated projects finish by " + U.fmt.dateLong(value) + ".";
      };

      var input = el("input", {
        type: "date",
        class: "pm-select",
        value: seed,
        min: U.d.iso(today) || undefined,
        "aria-label": "Target completion date",
        onInput: function (ev) { readout.nodeValue = describe(ev.target.value); }
      });
      readout.nodeValue = describe(seed);

      targetCard.body.appendChild(el("div", { class: "pm-field" }, [
        el("span", { class: "pm-field-label", text: "Target date" }),
        input
      ]));
      targetCard.body.appendChild(el("p", { class: "pm-note" }, readout));
      targetCard.body.appendChild(U.note(
        "Interpolated between the two nearest simulated dates" +
        (firstDate && lastDate
          ? ", which run " + U.fmt.date(firstDate) + " to " + U.fmt.date(lastDate)
          : "") +
        ". A date outside that span is reported as outside it, not as 0% or 100%."
      ));
    }

    /* ---- 6 + 7. the inputs, and what the model does not know ------------ */

    var inputBand = U.section("Forecast inputs and limits",
      "The audit trail: the numbers the simulation resampled, and the things " +
      "it does not model.");
    root.appendChild(inputBand);

    var sampleCard = addCard(inputBand, "Throughput sample",
      sampleWeeks == null
        ? "Observed weekly closures the model resamples"
        : U.fmt.plural(sampleWeeks, "week") + " of observed closures");

    if (!sample.length) {
      sampleCard.body.appendChild(U.empty(
        "The forecast reported no sample values, so its input cannot be " +
        "checked here — the percentiles above are unauditable from this panel."
      ));
    } else {
      var rows = sample.map(function (value, i) {
        return { index: i + 1, count: num(value) };
      });
      sampleCard.body.appendChild(U.table([
        { key: "index", label: "#", align: "right", width: "3.5rem",
          fmt: function (v) { return U.fmt.n(v); } },
        { key: "count", label: "Tasks closed", align: "right",
          fmt: function (v) { return U.fmt.n(v); } },
        { key: "count", label: "Note",
          fmt: function (v) { return v ? "" : U.badge("no closures", "warn"); } }
      ], rows, { cls: "is-compact" }));

      var mean = U.st.mean(sample.filter(function (v) { return num(v) != null; }));
      sampleCard.body.appendChild(U.note(
        (zeroWeeks == null
          ? "Weeks with no closures are kept in the sample on purpose"
          : U.fmt.plural(zeroWeeks, "week") + " of these " +
            U.fmt.n(sample.length) + " closed nothing, and they are kept in " +
            "the sample on purpose") +
        " — dropping them would forecast a project that never stalls. " +
        "Mean " + U.fmt.n(mean, 1) + " tasks per week over " +
        U.fmt.plural(sample.length, "sampled week") + "."
      ));
      if (f.note) sampleCard.body.appendChild(U.note(String(f.note)));
    }

    var howCard = addCard(inputBand, "How this forecast works",
      f.method ? String(f.method) : null);
    var blocked = num(metrics.totals && metrics.totals.blocked);
    var units = payload.units || {};
    var primary = units.primary || "tasks";
    var coverage = num(units.points_coverage);

    howCard.body.appendChild(el("p", {
      text: "The model resamples this project's own history. It draws one of " +
            "the " + (sampleWeeks == null ? "observed" : U.fmt.n(sampleWeeks)) +
            " observed weekly closure counts at random, with replacement, and " +
            "keeps drawing week after week until " +
            (remaining == null
              ? "the remaining work is gone"
              : U.fmt.plural(remaining, "task") + " are gone") +
            ". That is one run; it does this " +
            (trials == null ? "many" : U.fmt.n(trials)) +
            " times and reads the percentiles off the spread of finish dates."
    }));
    howCard.body.appendChild(el("p", {
      text: "It assumes the coming weeks resemble the sampled window and " +
            "nothing else. It does not model dependencies, so a task that " +
            "cannot start until another closes is treated as freely " +
            "schedulable. It does not model lane serialisation, and the model " +
            "lane runs one model at a time. It does not model operator " +
            "availability. And the " +
            (blocked == null ? "currently blocked tasks" : U.fmt.plural(blocked, "blocked task")) +
            ", including the ones waiting on hardware, are counted as " +
            "ordinary work that throughput will absorb."
    }));
    /* Whether the corpus carries estimates is a payload fact, not something
       this file may assert: units.points_available flips it. */
    howCard.body.appendChild(el("p", {
      text: "Every remaining item carries equal weight. " +
            (units.points_available === true
              ? "Estimates are present on " +
                (coverage == null ? "part of" : U.fmt.pct(coverage * 100) + " of") +
                " the corpus, but the simulation resamples closure counts " +
                "rather than estimates"
              : "The corpus carries no estimates") +
            " — the primary unit is \"" + primary + "\" — so the projection " +
            "counts briefs, not effort, and a one-line fix and a week-long " +
            "qualification sweep are the same single unit here."
    }));
    howCard.body.appendChild(el("p", {
      text: "Those are limits of the model, not hedges about the output. " +
            "Inside them the percentiles are exactly what the runs produced; " +
            "outside them — a dependency chain that serialises, a week lost " +
            "to hardware — the real finish date can sit past p95 without the " +
            "forecast having been wrong about anything it measured."
    }));
  };
})();
