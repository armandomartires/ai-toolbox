/* ==========================================================================
   90-app.js — PM.app: bootstrap, tab routing, filters, resize.

   Concatenated last, so every PM.views.* function is already defined by the
   time this runs. It owns three things no view may touch: which panel is
   visible, what the sprint/lane filter currently is, and when a view is asked
   to render.

   The error boundary around each view call is the important part. Eleven view
   modules render into eleven panels; without it, one module throwing on an
   unexpected payload shape takes down the whole page and leaves a blank white
   document with the real cause in a console nobody opened. With it, the broken
   tab says so and the other ten still work.
   ========================================================================== */

window.PM = window.PM || {};

(function () {
  "use strict";

  var U = PM.util;
  var el = U.el;

  /* The complete, closed tab set. Must match template.html and SCHEMA.md §4. */
  var TABS = [
    "overview", "burn", "flow", "forecast", "board", "roadmap",
    "backlog", "deps", "decisions", "activity", "debt", "data"
  ];

  var state = {
    data: null,
    active: null,
    rendered: {},        // tab -> true once drawn with the current filter
    filter: { sprint: "all", lane: "all" }
  };

  /* ----------------------------------------------------------------------
     Payload
     ---------------------------------------------------------------------- */

  function readPayload() {
    var node = document.getElementById("pm-data");
    if (!node) return { error: "No #pm-data block is present in this file." };
    var text = (node.textContent || "").trim();
    if (!text || text.indexOf("{{DATA}}") !== -1) {
      return { error: "The data placeholder was never substituted. Re-run pm_dashboard.py." };
    }
    try {
      return { data: JSON.parse(text) };
    } catch (err) {
      return { error: "The embedded payload is not valid JSON: " + err.message };
    }
  }

  /* ----------------------------------------------------------------------
     Filters
     ---------------------------------------------------------------------- */

  function applyFilter(tasks) {
    var f = state.filter;
    return (tasks || []).filter(function (task) {
      if (f.sprint !== "all" && task.sprint_id !== f.sprint) return false;
      if (f.lane !== "all" && task.lane !== f.lane) return false;
      return true;
    });
  }

  function buildFilters(data) {
    var sprintSelect = document.getElementById("pm-filter-sprint");
    var laneSelect = document.getElementById("pm-filter-lane");
    if (!sprintSelect || !laneSelect) return;

    var sprints = (data.sprints || []).filter(function (s) { return s.has_briefs; });
    U.clear(sprintSelect);
    sprintSelect.appendChild(el("option", { value: "all", text: "All sprints" }));
    sprints.slice().reverse().forEach(function (sprint) {
      sprintSelect.appendChild(el("option", {
        value: sprint.id,
        text: sprint.id + " · " + U.fmt.deCamel(sprint.name) +
              " (" + sprint.done_count + "/" + sprint.task_count + ")"
      }));
    });

    var lanes = {};
    (data.tasks || []).forEach(function (task) { lanes[task.lane] = true; });
    U.clear(laneSelect);
    laneSelect.appendChild(el("option", { value: "all", text: "All lanes" }));
    Object.keys(lanes).sort().forEach(function (lane) {
      laneSelect.appendChild(el("option", { value: lane, text: lane }));
    });

    sprintSelect.value = state.filter.sprint;
    laneSelect.value = state.filter.lane;

    sprintSelect.addEventListener("change", function () {
      state.filter.sprint = sprintSelect.value;
      invalidate();
    });
    laneSelect.addEventListener("change", function () {
      state.filter.lane = laneSelect.value;
      invalidate();
    });
  }

  /* ----------------------------------------------------------------------
     Rendering
     ---------------------------------------------------------------------- */

  function panelFor(tab) {
    return document.getElementById("tab-" + tab);
  }

  function renderTab(tab) {
    var panel = panelFor(tab);
    if (!panel) return;
    U.clear(panel);

    var view = PM.views && PM.views[tab];
    if (typeof view !== "function") {
      var missing = U.card("Not available");
      missing.body.appendChild(
        U.empty("No view module is loaded for the “" + tab + "” tab.")
      );
      panel.appendChild(missing);
      state.rendered[tab] = true;
      return;
    }

    try {
      view(panel, state.data);
    } catch (err) {
      // Deliberately verbose: the stack is the only diagnostic a reader of a
      // generated file has, and burying it would make a broken module
      // indistinguishable from an empty corpus.
      U.clear(panel);
      var card = U.card(
        "This tab failed to render",
        "The rest of the dashboard is unaffected."
      );
      card.body.appendChild(U.note(
        "PM.views." + tab + " threw: " + (err && err.message ? err.message : String(err)),
        "bad"
      ));
      card.body.appendChild(el("pre", {
        class: "pm-code",
        text: (err && err.stack) ? String(err.stack) : "(no stack available)"
      }));
      panel.appendChild(card);
      if (window.console && console.error) console.error("PM.views." + tab, err);
    }
    state.rendered[tab] = true;
  }

  function show(tab, options) {
    if (TABS.indexOf(tab) === -1) tab = TABS[0];
    var opts = options || {};

    TABS.forEach(function (name) {
      var panel = panelFor(name);
      var button = document.getElementById("pm-tabbtn-" + name);
      var on = name === tab;
      if (panel) panel.hidden = !on;
      if (button) {
        button.setAttribute("aria-selected", on ? "true" : "false");
        button.tabIndex = on ? 0 : -1;
      }
    });

    state.active = tab;
    if (!state.rendered[tab]) renderTab(tab);

    try {
      window.localStorage.setItem("pm.tab", tab);
    } catch (err) { /* private mode or file:// restrictions; not worth failing over */ }

    if (!opts.silent && window.location.hash.slice(1) !== tab) {
      // replaceState keeps the back button useful for the page the reader came
      // from rather than filling history with eleven tab clicks.
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, "", "#" + tab);
      } else {
        window.location.hash = tab;
      }
    }
    if (opts.focus) {
      var btn = document.getElementById("pm-tabbtn-" + tab);
      if (btn) btn.focus();
    }
  }

  /* Every tab must redraw after a filter change, but only the visible one
     redraws now - the other ten redraw when they are next shown. */
  function invalidate() {
    state.rendered = {};
    if (state.active) renderTab(state.active);
  }

  /* ----------------------------------------------------------------------
     Wiring
     ---------------------------------------------------------------------- */

  function wireTabs() {
    var nav = document.getElementById("pm-tabs");
    if (!nav) return;

    nav.addEventListener("click", function (ev) {
      var button = ev.target.closest ? ev.target.closest(".pm-tab") : null;
      if (button && button.dataset.tab) show(button.dataset.tab);
    });

    nav.addEventListener("keydown", function (ev) {
      var index = TABS.indexOf(state.active);
      if (index === -1) return;
      var next = null;
      if (ev.key === "ArrowRight") next = TABS[(index + 1) % TABS.length];
      else if (ev.key === "ArrowLeft") next = TABS[(index - 1 + TABS.length) % TABS.length];
      else if (ev.key === "Home") next = TABS[0];
      else if (ev.key === "End") next = TABS[TABS.length - 1];
      if (next) {
        ev.preventDefault();
        show(next, { focus: true });
      }
    });
  }

  function wireShortcuts() {
    document.addEventListener("keydown", function (ev) {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      var tag = (ev.target && ev.target.tagName) || "";
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (ev.key === "t" && PM.theme) PM.theme.cycle();
      else if (ev.key === "p") printAll();
    });
  }

  /* Some engines will not lay out a [hidden] panel even under a print
     stylesheet, so the class is applied first and removed after. */
  function printAll() {
    document.body.classList.add("pm-print-all");
    TABS.forEach(function (tab) {
      if (!state.rendered[tab]) renderTab(tab);
      var panel = panelFor(tab);
      if (panel) panel.hidden = false;
    });
    var restore = function () {
      document.body.classList.remove("pm-print-all");
      show(state.active, { silent: true });
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
    // afterprint is unreliable in a few engines; a timer guarantees the page
    // comes back rather than being left with all eleven panels open.
    setTimeout(function () {
      if (document.body.classList.contains("pm-print-all")) restore();
    }, 2000);
  }

  function wireHeader(data) {
    var name = document.getElementById("pm-project-name");
    if (name) name.textContent = data.project.name + " — project dashboard";

    var sub = document.getElementById("pm-project-sub");
    if (sub) {
      var totals = (data.metrics && data.metrics.totals) || {};
      sub.textContent = U.fmt.plural(totals.tasks || 0, "task") + " · " +
        U.fmt.pct(totals.completion_pct) + " complete · as of " +
        U.fmt.dateLong(data.project.today);
    }

    var generated = document.getElementById("pm-generated-at");
    if (generated) {
      generated.textContent = "generated " + (data.generated_at || "").replace("T", " ");
      generated.title = "pm_dashboard.py " +
        ((data.generator && data.generator.version) || "");
    }

    var corpus = document.getElementById("pm-footer-corpus");
    if (corpus) corpus.textContent = data.project.workflow_dir + "/";

    var print = document.getElementById("pm-print");
    if (print) print.addEventListener("click", printAll);
  }

  function wireResize() {
    var timer = null;
    window.addEventListener("resize", function () {
      // Charts take their width from the host element at draw time, so a
      // resize needs a redraw rather than a CSS reflow. Debounced, because a
      // drag fires this continuously.
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () {
        timer = null;
        if (state.active) renderTab(state.active);
      }, 200);
    });
    window.addEventListener("pm:themechange", function () {
      if (state.active) renderTab(state.active);
    });
  }

  function fatal(message) {
    var main = document.getElementById("pm-main");
    if (!main) return;
    U.clear(main);
    var card = U.card("This dashboard could not load");
    card.body.appendChild(U.note(message, "bad"));
    card.body.appendChild(U.note(
      "The payload is embedded in this file as a <script id=\"pm-data\"> block, " +
      "and the same data is written beside it as dashboard-data.json."
    ));
    main.appendChild(card);
  }

  function initialTab(data) {
    var hash = window.location.hash.slice(1);
    if (TABS.indexOf(hash) !== -1) return hash;
    try {
      var stored = window.localStorage.getItem("pm.tab");
      if (stored && TABS.indexOf(stored) !== -1) return stored;
    } catch (err) { /* see the note in show() */ }
    return TABS[0];
  }

  function init() {
    var result = readPayload();
    if (result.error) {
      if (PM.theme && PM.theme.init) PM.theme.init();
      fatal(result.error);
      return;
    }
    state.data = result.data;

    if (Number(state.data.schema_version) !== U.SCHEMA_VERSION &&
        window.console && console.warn) {
      console.warn(
        "pm-dashboard: payload schema_version is " + state.data.schema_version +
        ", this front end implements " + U.SCHEMA_VERSION +
        ". Some panels may be wrong."
      );
    }

    if (PM.theme && PM.theme.init) PM.theme.init();
    wireHeader(state.data);
    buildFilters(state.data);
    wireTabs();
    wireShortcuts();
    wireResize();

    window.addEventListener("hashchange", function () {
      var hash = window.location.hash.slice(1);
      if (TABS.indexOf(hash) !== -1 && hash !== state.active) {
        show(hash, { silent: true });
      }
    });

    show(initialTab(state.data), { silent: true });
  }

  PM.app = {
    TABS: TABS,
    filter: state.filter,
    applyFilter: applyFilter,
    data: function () { return state.data; },
    active: function () { return state.active; },
    show: show,
    invalidate: invalidate,
    render: renderTab,
    print: printAll,
    init: init
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
