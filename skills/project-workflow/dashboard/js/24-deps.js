/* ==========================================================================
   24-deps.js — PM.views.deps: the Dependencies tab.

   metrics.dependencies arrives already layered (SCHEMA.md §2.10), so this
   file does no graph maths: no topological sort, no cycle search, no
   critical-path search. `layer` is the x column, position within the layer is
   the y row, and everything else drawn here is a lookup. If this layout ever
   disagrees with the generator, the generator is right.

   The one thing this tab must never imply is time. A dependency edge carries
   no duration, so the critical path is a count of sequential units and never
   a date — the Forecast tab owns dates.
   ========================================================================== */

window.PM = window.PM || {};
PM.views = PM.views || {};

(function () {
  "use strict";

  var U = PM.util;
  var el = U.el;

  /* Geometry. GAP_X is wide relative to the node because edges are cubic
     beziers: with a narrow column gap the control points collapse and every
     edge reads as a straight diagonal, which is exactly what the curve is
     there to avoid. */
  var NODE_W = 118;
  var NODE_H = 26;
  var GAP_X = 62;
  var GAP_Y = 14;
  var PAD = { t: 34, r: 16, b: 18, l: 16 };   /* top leaves room for the layer headers */
  var MIN_W = 360;
  var MIN_H = 170;

  /* ----------------------------------------------------------------------
     Small shared helpers
     ---------------------------------------------------------------------- */

  function px1(value) {
    return Math.round(value * 10) / 10;
  }

  function byId(a, b) {
    return String(a.id).localeCompare(String(b.id));
  }

  function indexTasks(tasks) {
    var map = {};
    (tasks || []).forEach(function (t) {
      if (t && t.id != null) map[String(t.id)] = t;
    });
    return map;
  }

  /* A task id may name a brief that is not in `tasks` — a dangling
     declaration. Saying so is better than rendering a blank cell. */
  function titleOf(id, tasksById) {
    var t = tasksById[String(id)];
    if (!t) return null;
    return t.title || U.fmt.deCamel(t.name) || String(id);
  }

  function stateOf(task) {
    if (!task) return null;
    return task.workflow_state || task.state || null;
  }

  function listOr(values, fallback) {
    if (!values || !values.length) return fallback;
    return U.fmt.truncate(values.join(", "), 110);
  }

  function chip(label, titleAttr, extra) {
    return el("span", { class: "pm-chip", title: titleAttr || null },
              [label, extra || null]);
  }

  function chipRow(children) {
    return el("div", { class: "pm-chips" }, children);
  }

  /* An id chain rendered as chips with arrows. Used by both the critical path
     and the cycle rows; a chain is the only honest shape for an ordering that
     carries no dates. */
  function chainChips(ids, tasksById) {
    var out = [];
    (ids || []).forEach(function (id, i) {
      if (i) out.push(el("span", { class: "pm-chip-sep", "aria-hidden": "true", text: "→" }));
      var title = titleOf(id, tasksById);
      var st = stateOf(tasksById[String(id)]);
      out.push(chip(
        String(id),
        title || "This id is not in the task list.",
        st ? U.badge(U.stateLabel(st), U.stateTone(st)) : U.badge("not in corpus", "warn")
      ));
    });
    return chipRow(out);
  }

  /* is-done / is-pending / is-blocked, from state + workflow_state together.
     `unparseable` collapses into pending on purpose: the board column is
     unknown, but the work is certainly not closed, and colouring it as done
     would be the one wrong answer. */
  function nodeMod(node) {
    if (node.workflow_state === "blocked") return "is-blocked";
    if (node.state === "done" || node.workflow_state === "done") return "is-done";
    return "is-pending";
  }

  function nodeTip(node, tasksById) {
    var task = tasksById[String(node.id)] || {};
    var st = node.workflow_state || node.state;
    var lines = [String(node.id)];
    var title = titleOf(node.id, tasksById);
    if (title) lines.push(title);
    lines.push("State: " + U.stateLabel(st));
    lines.push("Lane: " + (node.lane || task.lane || "not set"));
    lines.push("Sprint: " + (node.sprint_id || task.sprint_id || "not set"));
    lines.push("In " + U.fmt.n(node.in_degree || 0) + " · out " + U.fmt.n(node.out_degree || 0));
    lines.push("Depends on: " + listOr(task.depends_on, "nothing"));
    lines.push("Blocks: " + listOr(task.blocks, "nothing"));
    if (node.on_critical_path) lines.push("On the critical path");
    return lines;
  }

  /* ----------------------------------------------------------------------
     Panel 1 — KPI row
     ---------------------------------------------------------------------- */

  function kpiRow(deps) {
    var nodes = deps.nodes || [];
    var edges = deps.edges || [];
    var cycles = deps.cycles || [];
    var path = deps.critical_path || [];

    var unsatisfied = edges.filter(function (e) { return e.satisfied === false; }).length;

    return el("div", { class: "pm-kpi-row" }, [
      U.kpi({
        key: "dep-nodes", label: "Tasks in the graph", value: nodes.length,
        tone: "neutral",
        sub: deps.layer_count == null
          ? "layer count not reported"
          : U.fmt.plural(deps.layer_count, "layer"),
        hint: "Briefs that declare a dependency or are named by one. A brief with no edges at all is not a node here."
      }),
      U.kpi({
        key: "dep-edges", label: "Declared edges", value: edges.length,
        tone: "neutral",
        sub: "one per depends_on entry",
        hint: "Every resolved depends_on relation the collector could match to a real task id."
      }),
      U.kpi({
        key: "dep-unsatisfied", label: "Unsatisfied edges", value: unsatisfied,
        tone: unsatisfied > 0 ? "warn" : "good",
        sub: "of " + U.fmt.plural(edges.length, "edge"),
        hint: "An edge whose upstream task is not closed. This is the work that is actually holding other work up."
      }),
      U.kpi({
        key: "dep-critical", label: "Critical path", value: path.length,
        tone: "neutral",
        sub: path.length ? U.fmt.plural(path.length, "task") + " in sequence" : "no chain found",
        hint: "The longest chain of declared dependencies, counted in tasks. It carries no durations, so it is not a date."
      }),
      U.kpi({
        key: "dep-cycles", label: "Cycles", value: cycles.length,
        tone: cycles.length > 0 ? "bad" : "good",
        sub: cycles.length > 0 ? "work that can never start" : "none declared",
        hint: "A cycle means the corpus declares A before B and B before A. Zero is the only healthy value."
      })
    ]);
  }

  /* ----------------------------------------------------------------------
     Panel 2 — the layered DAG
     ---------------------------------------------------------------------- */

  function graphCard(deps, tasksById) {
    var card = U.card(
      "Dependency graph",
      "Left to right is dependency order, not time — layer 0 is blocked by nothing.",
      { span: "full" }
    );

    var nodes = deps.nodes || [];
    if (!nodes.length) {
      card.body.appendChild(U.empty(
        "No brief declares a dependency on another, so there is no graph to draw."
      ));
      return card;
    }

    /* Column buckets. A node whose `layer` is missing or not a number gets its
       own trailing column rather than being folded into layer 0 — pretending
       an unknown position is position zero would be a quiet lie. */
    var buckets = {}, keys = [];
    nodes.forEach(function (nd) {
      var key = (typeof nd.layer === "number" && isFinite(nd.layer)) ? String(nd.layer) : "none";
      if (!buckets[key]) { buckets[key] = []; keys.push(key); }
      buckets[key].push(nd);
    });
    keys.sort(function (a, b) {
      if (a === "none") return 1;
      if (b === "none") return -1;
      return (+a) - (+b);
    });

    /* Sorting within a layer by id is what makes the layout stable: PM.app
       re-renders this view on every resize and theme change, and a graph that
       reshuffles each time is unreadable. */
    var columns = [], pos = {}, maxRows = 0;
    keys.forEach(function (key, ci) {
      var col = buckets[key].slice().sort(byId);
      columns.push({ key: key, nodes: col });
      if (col.length > maxRows) maxRows = col.length;
      col.forEach(function (nd, ri) {
        pos[String(nd.id)] = {
          x: PAD.l + ci * (NODE_W + GAP_X),
          y: PAD.t + ri * (NODE_H + GAP_Y)
        };
      });
    });

    var width = Math.max(MIN_W, PAD.l + keys.length * (NODE_W + GAP_X));
    var height = Math.max(MIN_H, PAD.t + maxRows * (NODE_H + GAP_Y) + PAD.b);

    var counts = { done: 0, pending: 0, blocked: 0, critical: 0 };
    nodes.forEach(function (nd) {
      var mod = nodeMod(nd);
      if (mod === "is-done") counts.done++;
      else if (mod === "is-blocked") counts.blocked++;
      else counts.pending++;
      if (nd.on_critical_path) counts.critical++;
    });

    var edges = deps.edges || [];
    var unsatisfied = edges.filter(function (e) { return e.satisfied === false; }).length;

    /* Legend first, so it sits above the svg PM.svg.raw is about to append.
       Two pairs of rows deliberately share a swatch colour, because the graph
       itself does: a blocked node and an unsatisfied edge are both drawn in
       --pm-bad, and a critical node and a pending node are both --pm-info,
       separated by stroke weight rather than hue. A legend that invented a
       distinct colour per row would not match the picture above it. */
    card.body.appendChild(PM.svg.legend([
      { label: "Done", cls: "pm-ok", value: U.fmt.n(counts.done) },
      { label: "Pending", cls: "pm-s1", value: U.fmt.n(counts.pending) },
      { label: "Blocked", cls: "pm-bad", value: U.fmt.n(counts.blocked) },
      { label: "On critical path (heavier outline)", cls: "pm-s1", value: U.fmt.n(counts.critical) },
      { label: "Unsatisfied edge (dashed)", cls: "pm-bad", value: U.fmt.n(unsatisfied) }
    ]));

    var frame = PM.svg.raw(card.body, {
      width: width, height: height, cls: "pm-dag",
      label: "Layered dependency graph: " + U.fmt.plural(nodes.length, "task") +
             " in " + U.fmt.plural(keys.length, "layer") + ", " +
             U.fmt.plural(edges.length, "edge") + "."
    });

    var gHeads = el("g", { class: "pm-dag-heads" });
    var gEdges = el("g", { class: "pm-dag-edges" });
    var gNodes = el("g", { class: "pm-dag-nodes" });
    frame.g.appendChild(gHeads);
    frame.g.appendChild(gEdges);
    frame.g.appendChild(gNodes);           /* nodes last so boxes sit over edges */

    columns.forEach(function (col, ci) {
      gHeads.appendChild(el("text", {
        class: "pm-hm-label",
        x: PAD.l + ci * (NODE_W + GAP_X) + NODE_W / 2,
        y: PAD.t - 12,
        "text-anchor": "middle",
        text: col.key === "none" ? "layer not set" : "layer " + col.key
      }));
    });

    /* Consecutive pairs of critical_path, so an edge can say whether it is
       itself on the path rather than merely touching a node that is. */
    var path = deps.critical_path || [];
    var criticalPair = {};
    for (var i = 0; i + 1 < path.length; i++) {
      criticalPair[String(path[i]) + ">" + String(path[i + 1])] = true;
    }

    var dangling = 0;
    edges.forEach(function (e) {
      var a = pos[String(e.from)], b = pos[String(e.to)];
      if (!a || !b) { dangling++; return; }
      var x1 = a.x + NODE_W, y1 = a.y + NODE_H / 2;
      var x2 = b.x, y2 = b.y + NODE_H / 2;
      /* abs() keeps a backward edge (which only happens inside a cycle) from
         inverting its control points into an unreadable knot. */
      var dx = Math.max(24, Math.abs(x2 - x1) / 2);
      var cls = "pm-edge";
      if (e.satisfied === false) cls += " is-unsatisfied";
      if (criticalPair[String(e.from) + ">" + String(e.to)]) cls += " is-critical";
      gEdges.appendChild(el("path", {
        class: cls,
        d: "M" + px1(x1) + "," + px1(y1) +
           " C" + px1(x1 + dx) + "," + px1(y1) +
           " " + px1(x2 - dx) + "," + px1(y2) +
           " " + px1(x2) + "," + px1(y2),
        fill: "none"
      }));
    });

    columns.forEach(function (col) {
      col.nodes.forEach(function (nd) {
        var p = pos[String(nd.id)];
        var cls = "pm-node " + nodeMod(nd) + (nd.on_critical_path ? " is-critical" : "");
        var group = el("g", {
          class: "pm-dag-node",
          "data-id": String(nd.id),
          "aria-label": String(nd.id) + ", " + U.stateLabel(nd.workflow_state || nd.state)
        }, [
          el("rect", {
            class: cls, x: p.x, y: p.y, width: NODE_W, height: NODE_H, rx: 6, ry: 6
          }),
          el("text", {
            class: "pm-node-label",
            x: p.x + NODE_W / 2, y: p.y + NODE_H / 2 + 4,
            "text-anchor": "middle",
            text: U.fmt.truncate(String(nd.id), 16)
          })
        ]);
        PM.svg.bindTip(group, nodeTip(nd, tasksById));
        gNodes.appendChild(group);
      });
    });

    card.body.appendChild(U.note(
      "This chart shows the whole project; the sprint and lane filters apply to task lists only."
    ));
    card.body.appendChild(U.note(
      "An edge carries no duration, so nothing here is a schedule — column order is precedence only."
    ));
    if (dangling) {
      card.body.appendChild(U.note(
        "Not drawn: " + U.fmt.plural(dangling, "edge") +
        " naming a task that is not a node in this graph.",
        "warn"
      ));
    }
    if (buckets.none && buckets.none.length) {
      card.body.appendChild(U.note(
        "The last column holds " + U.fmt.plural(buckets.none.length, "task") +
        " that arrived with no layer value; an unknown position is not assumed to be layer 0.",
        "warn"
      ));
    }
    return card;
  }

  /* ----------------------------------------------------------------------
     Panel 3 — critical path
     ---------------------------------------------------------------------- */

  function criticalCard(deps, tasksById) {
    var path = deps.critical_path || [];
    var card = U.card(
      "Critical path",
      path.length ? U.fmt.plural(path.length, "task") + " in sequence" : "none found"
    );

    if (!path.length) {
      card.body.appendChild(U.empty(
        "The generator found no chain of declared dependencies, so there is no critical path to show."
      ));
      return card;
    }

    card.body.appendChild(chainChips(path, tasksById));
    card.body.appendChild(U.note(
      "This is the longest chain of declared dependencies in the corpus, counted in tasks and " +
      "including any already closed: no two tasks on it can ever be done at the same time. Each " +
      "chip carries its own state, so what is still outstanding is what is not badged Done."
    ));
    card.body.appendChild(U.note(
      "It is not a schedule. The chain carries no durations and no dates — it is a sequence count, " +
      "and the Forecast tab is the only place that turns counts into dates."
    ));
    return card;
  }

  /* ----------------------------------------------------------------------
     Panel 4 — ready to start
     ---------------------------------------------------------------------- */

  function readyCard(deps, tasksById, allowed, filtered) {
    var ids = deps.ready || [];
    var shown = ids.filter(function (id) { return allowed(id); });
    var card = U.card("Ready to start", filtered
      ? U.fmt.n(shown.length) + " of " + U.fmt.plural(ids.length, "task") + " on the frontier"
      : U.fmt.plural(ids.length, "task") + " on the frontier");

    if (!ids.length) {
      card.body.appendChild(U.empty(
        "Nothing is ready: every pending brief is still waiting on a dependency, a prose gate, or a readable status."
      ));
      return card;
    }
    if (!shown.length) {
      card.body.appendChild(U.empty(
        "Tasks are ready, but none of them match the current sprint and lane filter."
      ));
      return card;
    }

    var rows = shown.map(function (id) {
      return { id: String(id), task: tasksById[String(id)] || null };
    });

    card.body.appendChild(U.table([
      { key: "id", label: "Task", width: "8.5rem" },
      {
        key: function (r) { return r.task ? titleOf(r.id, tasksById) : null; },
        label: "Title",
        fmt: function (value) {
          return value == null ? U.badge("not in the task list", "warn") : String(value);
        }
      },
      {
        key: function (r) { return r.task && r.task.lane; }, label: "Lane", width: "6rem",
        fmt: function (value) { return value == null ? "not set" : String(value); }
      },
      {
        key: function (r) { return r.task && r.task.sprint_id; }, label: "Sprint", width: "5.5rem",
        fmt: function (value) { return value == null ? "—" : String(value); }
      },
      {
        key: function (r) { return r.task && r.task.goal; }, label: "Goal",
        fmt: function (value) {
          if (!value) return "no ## Goal section";
          return el("span", { title: String(value), text: U.fmt.truncate(String(value), 120) });
        }
      }
    ], rows));

    card.body.appendChild(U.note(
      "Ready means all four at once: the brief is pending, its status parsed, every dependency it " +
      "declares is closed, and its lane is one an agent can execute. It is the queue's own frontier, " +
      "not a priority order."
    ));
    if (filtered) {
      card.body.appendChild(U.note(
        "Filtered to the current sprint and lane: " + U.fmt.n(shown.length) + " of " +
        U.fmt.n(ids.length) + " ready tasks shown."
      ));
    }
    return card;
  }

  /* ----------------------------------------------------------------------
     Panel 5 — blocked
     ---------------------------------------------------------------------- */

  function blockedCard(tasks, tasksById, filtered) {
    var rows = tasks.filter(function (t) {
      return t && t.blocked_by_unmet && t.blocked_by_unmet.length;
    }).slice().sort(function (a, b) {
      var d = b.blocked_by_unmet.length - a.blocked_by_unmet.length;
      return d !== 0 ? d : byId(a, b);
    });

    var card = U.card("Blocked by another task", U.fmt.plural(rows.length, "task") + " waiting");

    if (!rows.length) {
      card.body.appendChild(U.empty(
        filtered
          ? "No task matching the current sprint and lane filter is waiting on an unmet dependency."
          : "No task is waiting on an unmet dependency — every declared blocker in the corpus is closed."
      ));
      return card;
    }

    card.body.appendChild(U.table([
      { key: "id", label: "Task", width: "8.5rem" },
      {
        key: function (t) { return t.title || U.fmt.deCamel(t.name); }, label: "Title",
        fmt: function (value) { return value ? String(value) : "—"; }
      },
      {
        key: "blocked_by_unmet", label: "Unmet blockers",
        fmt: function (ids) {
          return chipRow((ids || []).map(function (id) {
            var blocker = tasksById[String(id)];
            var st = stateOf(blocker);
            return chip(
              String(id),
              titleOf(id, tasksById) || "This id is not in the task list.",
              st ? U.badge(U.stateLabel(st), U.stateTone(st)) : U.badge("not in corpus", "warn")
            );
          }));
        }
      }
    ], rows));

    card.body.appendChild(U.note(
      "Each chip is a blocker that is not closed, carrying its own state — so a blocker that is " +
      "itself blocked shows the depth of the problem without opening another tab."
    ));
    /* The count above is of the filtered list, so it must say so: a blocked
       task outside the current sprint and lane is absent, not resolved. */
    if (filtered) {
      card.body.appendChild(U.note(
        "Filtered to the current sprint and lane: a task blocked by an unmet dependency but " +
        "outside the filter is not counted here."
      ));
    }
    return card;
  }

  /* ----------------------------------------------------------------------
     Panel 6 — prose-gated
     ---------------------------------------------------------------------- */

  function proseCard(deps, tasksById, allowed, filtered) {
    var ids = deps.prose_gated || [];
    var shown = ids.filter(function (id) { return allowed(id); });
    var card = U.card("Gated on prose", filtered
      ? U.fmt.n(shown.length) + " of " + U.fmt.plural(ids.length, "task") +
        " with a free-text blocker"
      : U.fmt.plural(ids.length, "task") + " with a free-text blocker");

    if (!ids.length) {
      card.body.appendChild(U.empty(
        "No brief states a blocker in prose; every declared dependency in the corpus resolves to a task id."
      ));
      return card;
    }
    if (!shown.length) {
      card.body.appendChild(U.empty(
        "Prose-gated tasks exist, but none of them match the current sprint and lane filter."
      ));
      return card;
    }

    var rows = shown.map(function (id) {
      var task = tasksById[String(id)] || {};
      return { id: String(id), gates: task.prose_gates || [], task: task };
    });

    card.body.appendChild(U.table([
      { key: "id", label: "Task", width: "8.5rem" },
      {
        key: function (r) { return titleOf(r.id, tasksById); }, label: "Title", width: "14rem",
        fmt: function (value) {
          return value == null ? U.badge("not in the task list", "warn") : String(value);
        }
      },
      {
        key: "gates", label: "Gate, as written",
        /* Verbatim, because the wording is the whole content of the blocker —
           paraphrasing a gate would lose the only thing that can resolve it. */
        fmt: function (gates) {
          if (!gates || !gates.length) return "no gate text recorded on the brief";
          return el("ul", null, gates.map(function (g) {
            return el("li", { title: String(g), text: U.fmt.truncate(String(g), 160) });
          }));
        }
      }
    ], rows));

    card.body.appendChild(U.note(
      "A prose gate is a blocker somebody wrote in English rather than as a task id. Nothing can " +
      "resolve it automatically, so it is deliberately treated as unresolved and these tasks are " +
      "kept off the ready frontier even when every id-shaped dependency is closed."
    ));
    if (filtered) {
      card.body.appendChild(U.note(
        "Filtered to the current sprint and lane: " + U.fmt.n(shown.length) + " of " +
        U.fmt.n(ids.length) + " prose-gated tasks shown."
      ));
    }
    return card;
  }

  /* ----------------------------------------------------------------------
     Panel 7 — cycles
     ---------------------------------------------------------------------- */

  function cyclesCard(deps, tasksById) {
    var cycles = deps.cycles || [];
    var card = U.card("Dependency cycles", U.fmt.plural(cycles.length, "cycle") + " declared");

    card.body.appendChild(U.note(
      "A cycle is not a scheduling problem, it is a defect: the corpus declares work that can never " +
      "start, because each task in the chain waits on the next. One of the declarations is wrong and " +
      "must be removed from the brief that carries it.",
      "bad"
    ));

    cycles.forEach(function (ids, i) {
      var chain = (ids || []).slice();
      /* Repeat the first id at the end so the loop is visible as a loop. */
      if (chain.length) chain.push(chain[0]);
      card.body.appendChild(el("div", { class: "pm-cycle-row" }, [
        U.badge("cycle " + (i + 1), "bad"),
        chainChips(chain, tasksById)
      ]));
    });

    return card;
  }

  /* ----------------------------------------------------------------------
     The view
     ---------------------------------------------------------------------- */

  PM.views.deps = function (root, data) {
    U.clear(root);                        /* idempotent: rebuilt on resize and theme change */

    var payload = data || {};
    if (!payload.metrics || !payload.metrics.dependencies) {
      root.appendChild(U.empty(
        "This payload carries no metrics.dependencies block, so there is no graph, no critical path " +
        "and no frontier to show."
      ));
      return;
    }

    var deps = payload.metrics.dependencies;
    var allTasks = payload.tasks || [];
    var tasksById = indexTasks(allTasks);

    var tasks = (PM.app && PM.app.applyFilter) ? PM.app.applyFilter(allTasks) : allTasks;
    var filter = (PM.app && PM.app.filter) || {};
    var filtered = (filter.sprint && filter.sprint !== "all") ||
                   (filter.lane && filter.lane !== "all");

    /* The id-list panels (ready, prose-gated) come from metrics but are about
       individual tasks, so they obey the same filter the blocked table does. */
    var allowedIds = {};
    tasks.forEach(function (t) { if (t && t.id != null) allowedIds[String(t.id)] = true; });
    function allowed(id) {
      if (!filtered) return true;
      return allowedIds[String(id)] === true;
    }

    root.appendChild(kpiRow(deps));

    var graph = U.section(
      "Dependency graph",
      "Every brief that declares a dependency or is named by one, laid out in the layers the generator computed."
    );
    graph.body.appendChild(graphCard(deps, tasksById));
    root.appendChild(graph);

    var next = U.section(
      "What can move",
      "The longest chain of declared dependencies, and the frontier that is executable today."
    );
    next.body.appendChild(criticalCard(deps, tasksById));
    next.body.appendChild(readyCard(deps, tasksById, allowed, filtered));
    root.appendChild(next);

    var stuck = U.section(
      "What is stuck",
      "Blocked by a task, gated by a sentence, or declared in a circle."
    );
    stuck.body.appendChild(blockedCard(tasks, tasksById, filtered));
    stuck.body.appendChild(proseCard(deps, tasksById, allowed, filtered));
    if ((deps.cycles || []).length) {
      stuck.body.appendChild(cyclesCard(deps, tasksById));
    }
    root.appendChild(stuck);

    /* A clean result is worth one line, not a whole card. */
    if (!(deps.cycles || []).length) {
      stuck.appendChild(U.note("No dependency cycles."));
    }
  };
})();
