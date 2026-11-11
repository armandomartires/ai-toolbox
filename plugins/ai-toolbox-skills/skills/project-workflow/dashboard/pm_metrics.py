#!/usr/bin/env python3
"""
pm_metrics.py — agile metrics over a collected `project-workflow` corpus
(S027.T001_BuildAgileDashboard).

## What this module IS

Pure functions from `pm_collect.collect()`'s record to `SCHEMA.md` section 2.
No I/O, no git, no filesystem. Given the same record it returns the same
numbers, including the forecast — the Monte Carlo RNG is seeded from a hash of
its own inputs, because a dashboard whose headline delivery date moves every
time you regenerate it is a dashboard nobody believes twice.

## Three modelling decisions worth reading before trusting a chart

**1. Tasks, not points.** The corpus records no estimates (see
`SCHEMA.md` section 0), so every count here is a count of tasks. This is not a
degraded mode: count-based throughput forecasting is the mainstream Kanban
practice precisely because estimates add error rather than removing it. Where a
project does supply `**Points**:` on every brief, `units.primary` flips and the
velocity series carries both.

**2. The cumulative flow diagram is reconstructed, and only partly
observable.** A real CFD needs every state transition. This corpus records two:
a brief arriving (its first commit) and a brief closing (its status line). So
`done` is exact at every point in time, and the open bands are a reconstruction
— an item open at time *t* that has since closed is shown as in-progress at
*t*, because what it was doing then is not recorded anywhere. The right-hand
edge of the chart is exact; the middle is the best available reading. This is
stated in `provenance.notes` rather than left for a reader to discover.

**3. The burn-down's reference line is a pace line, not a commitment.** This
project never committed to an end date, so there is no ideal line in the Scrum
sense. What is drawn instead is a constant-pace reference from the scope known
at the first period down to zero at the p50 forecast date. A real line above it
means the project is behind that constant pace — from either slower delivery or
added scope, and the burn-up is where you tell those two apart.

Stdlib only, Python-only per ADR-0003.
"""

from __future__ import annotations

import datetime
import hashlib
import json
import math
import random
import sys

# Cumulative series (burn-up, burn-down, CFD, debt trend) switch from daily to
# weekly points past this window length, so a two-year project stays legible
# without a 700-point path while a two-month one keeps real resolution.
DAILY_WINDOW_LIMIT_DAYS = 150

MONTE_CARLO_TRIALS = 10000
FORECAST_HORIZON_WEEKS = 260          # a hard stop; a 5-year cone is not a plan

WORKFLOW_STATES = ("done", "in_progress", "blocked", "not_started", "unparseable")


# ---------------------------------------------------------------------------
# dates
# ---------------------------------------------------------------------------


def _d(value):
    if not value:
        return None
    try:
        return datetime.date.fromisoformat(value)
    except (TypeError, ValueError):
        return None


def _iso(value):
    return value.isoformat() if value else None


def _week_start(date):
    return date - datetime.timedelta(days=date.weekday())


def _week_label(date):
    year, week, _ = _week_start(date).isocalendar()
    return "%d-W%02d" % (year, week)


def _month(date):
    return "%04d-%02d" % (date.year, date.month)


def _percentile(values, p):
    """Nearest-rank percentile.

    Not interpolated on purpose: "85% of items finished within N days" has to
    name a duration some item actually took, or the number is an artefact of
    the averaging rather than an observation.
    """
    ordered = sorted(v for v in values if v is not None)
    if not ordered:
        return None
    rank = math.ceil((p / 100.0) * len(ordered)) - 1
    return ordered[min(len(ordered) - 1, max(0, rank))]


def _mean(values):
    clean = [v for v in values if v is not None]
    return sum(clean) / len(clean) if clean else None


def _stddev(values):
    clean = [v for v in values if v is not None]
    if len(clean) < 2:
        return None
    avg = _mean(clean)
    return math.sqrt(sum((v - avg) ** 2 for v in clean) / (len(clean) - 1))


APPROXIMATE_SOURCES = ("roadmap_sprint", "file_mtime")


def _is_approximate(task, prefix):
    return bool(
        task.get(prefix + "_floored")
        or task.get(prefix + "_source") in APPROXIMATE_SOURCES
    )


# ---------------------------------------------------------------------------
# window and periods
# ---------------------------------------------------------------------------


def _window(record):
    today = _d(record["project"]["today"]) or datetime.date.today()
    candidates = []
    for task in record["tasks"]:
        candidates.extend(_d(task[k]) for k in ("created_at", "closed_at"))
    for entry in record["log"]:
        candidates.append(_d(entry["date"]))
    for commit in record["commits"]:
        candidates.append(_d(commit["date"]))
    for item in record["adhoc"]:
        candidates.extend(_d(item[k]) for k in ("found_at", "resolved_at"))
    clean = [c for c in candidates if c]
    start = min(clean) if clean else today
    end = max(max(clean) if clean else today, today)
    return start, end, today


def _periods(start, end, granularity):
    """Inclusive series of period anchor dates."""
    out = []
    if granularity == "week":
        cursor = _week_start(start)
        while cursor <= end:
            out.append(cursor)
            cursor += datetime.timedelta(days=7)
        if out and out[-1] != end:
            out.append(end)
    else:
        cursor = start
        while cursor <= end:
            out.append(cursor)
            cursor += datetime.timedelta(days=1)
    return out


def _weeks(start, end):
    out, cursor = [], _week_start(start)
    while cursor <= end:
        out.append(cursor)
        cursor += datetime.timedelta(days=7)
    return out


# ---------------------------------------------------------------------------
# burn-up, burn-down, cumulative flow
# ---------------------------------------------------------------------------


def _cumulative_series(tasks, periods):
    created = sorted(d for d in (_d(t["created_at"]) for t in tasks) if d)
    closed = sorted(d for d in (_d(t["closed_at"]) for t in tasks) if d)

    burnup = []
    for anchor in periods:
        scope = sum(1 for d in created if d <= anchor)
        done = sum(1 for d in closed if d <= anchor)
        burnup.append({
            "date": _iso(anchor),
            "scope": scope,
            "done": done,
            "remaining": scope - done,
        })
    return burnup


TREND_WINDOW_DAYS = 28


def _burndown(burnup, forecast, periods):
    """Remaining, plus a pace trend line.

    The `ideal` key is a least-squares fit through the trailing
    TREND_WINDOW_DAYS of the remaining series, extended across the chart - a
    *current pace* line, which is what a Jira-style burndown's trend line is.

    It is emphatically NOT the Scrum ideal line, and an earlier draft of this
    function tried to be: a straight descent from the project's total scope on
    day one to zero at the forecast date. On a project whose scope grew from 6
    briefs to 118 that line starts at 118 on a day when 6 tasks existed, so it
    sits far above the real line from the first pixel and reports a project
    "behind schedule" against a schedule that never existed. A pace fit says
    something true instead: whether remaining is trending toward zero, and how
    fast.
    """
    if not burnup:
        return []

    last = _d(burnup[-1]["date"])
    cutoff = last - datetime.timedelta(days=TREND_WINDOW_DAYS)
    fit = [p for p in burnup if (_d(p["date"]) or last) >= cutoff]
    if len(fit) < 2:
        fit = burnup

    origin = _d(fit[0]["date"])
    xs = [float(((_d(p["date"]) or origin) - origin).days) for p in fit]
    ys = [float(p["remaining"]) for p in fit]
    n = len(xs)
    mean_x, mean_y = sum(xs) / n, sum(ys) / n
    denom = sum((x - mean_x) ** 2 for x in xs)
    slope = (
        sum((xs[i] - mean_x) * (ys[i] - mean_y) for i in range(n)) / denom
        if denom else 0.0
    )
    intercept = mean_y - slope * mean_x

    out = []
    for point in burnup:
        offset = float(((_d(point["date"]) or origin) - origin).days)
        out.append({
            "date": point["date"],
            "remaining": point["remaining"],
            # Clamped at zero: a negative remaining is not a thing, and an
            # extrapolated line that dives below the axis reads as a bug.
            "ideal": round(max(0.0, intercept + slope * offset), 2),
        })
    return out


def _cfd(tasks, periods):
    """Stacked state counts per period. Partly reconstructed - see docstring."""
    prepared = []
    for task in tasks:
        prepared.append((
            _d(task["created_at"]),
            _d(task["closed_at"]),
            task["workflow_state"],
        ))

    out = []
    for anchor in periods:
        bands = {"done": 0, "in_progress": 0, "blocked": 0, "not_started": 0}
        for created, closed, state in prepared:
            if not created or created > anchor:
                continue
            if closed and closed <= anchor:
                bands["done"] += 1
            elif closed:
                # Open at this point in time and closed later. Nothing records
                # what it was doing then, so it counts as work in the system.
                bands["in_progress"] += 1
            elif state in bands:
                bands[state] += 1
            else:
                bands["not_started"] += 1
        bands["date"] = _iso(anchor)
        out.append(bands)
    return out


# ---------------------------------------------------------------------------
# velocity, throughput, churn
# ---------------------------------------------------------------------------


def _velocity(tasks, sprints):
    by_sprint = {}
    for task in tasks:
        by_sprint.setdefault(task["sprint_id"], []).append(task)

    out = []
    for sprint in sprints:
        members = by_sprint.get(sprint["id"], [])
        closed = [t for t in members if t["state"] == "done"]
        if not closed:
            continue
        points = [t["points"] for t in closed if t["points"] is not None]
        out.append({
            "sprint_id": sprint["id"],
            "label": sprint["label"],
            "closed": len(closed),
            "points": sum(points) if points else None,
            "rolling_avg": None,
        })

    for i, entry in enumerate(out):
        window = [e["closed"] for e in out[max(0, i - 2): i + 1]]
        entry["rolling_avg"] = round(_mean(window) or 0.0, 2)
    return out


def _throughput(tasks, weeks):
    closed = [_d(t["closed_at"]) for t in tasks]
    closed = [d for d in closed if d]
    out = []
    for week in weeks:
        stop = week + datetime.timedelta(days=7)
        out.append({
            "period": _week_label(week),
            "start": _iso(week),
            "count": sum(1 for d in closed if week <= d < stop),
        })
    return out


def _scope_churn(tasks, weeks):
    created = [d for d in (_d(t["created_at"]) for t in tasks) if d]
    closed = [d for d in (_d(t["closed_at"]) for t in tasks) if d]
    out = []
    for week in weeks:
        stop = week + datetime.timedelta(days=7)
        added = sum(1 for d in created if week <= d < stop)
        done = sum(1 for d in closed if week <= d < stop)
        out.append({
            "period": _week_label(week),
            "start": _iso(week),
            "added": added,
            "closed": done,
            "net": added - done,
        })
    return out


# ---------------------------------------------------------------------------
# cycle and lead time
# ---------------------------------------------------------------------------


def _duration_stats(samples, label):
    days = [s["days"] for s in samples]
    return {
        "samples": samples,
        "n": len(samples),
        "avg": round(_mean(days), 2) if days else None,
        "p50": _percentile(days, 50),
        "p85": _percentile(days, 85),
        "p95": _percentile(days, 95),
        "max": max(days) if days else None,
        "usable": len(samples) >= 1,
        "label": label,
    }


def _cycle_time(tasks):
    samples, negatives = [], []
    for task in tasks:
        if task["state"] != "done":
            continue
        created, closed = _d(task["created_at"]), _d(task["closed_at"])
        if not created or not closed:
            continue
        days = (closed - created).days
        if days < 0:
            # Only possible when the two dates come from different sources -
            # e.g. a sprint-granularity arrival later than a hand-recorded
            # closure. Clamped rather than dropped, and counted, because
            # dropping it would quietly shrink the sample the percentiles rest
            # on.
            negatives.append(task["id"])
            days = 0
        samples.append({
            "id": task["id"],
            "closed_at": task["closed_at"],
            "days": days,
            "sprint_id": task["sprint_id"],
            "lane": task["lane"],
            "approximate": _is_approximate(task, "created_at")
            or _is_approximate(task, "closed_at"),
        })
    samples.sort(key=lambda s: s["closed_at"])
    stats = _duration_stats(samples, "cycle time")
    stats["clamped_negative"] = negatives
    return stats


def _lead_time(tasks):
    samples = []
    for task in tasks:
        if task["state"] != "done":
            continue
        closed = _d(task["closed_at"])
        first = _d(task.get("first_evidence")) or _d(task["created_at"])
        if not closed or not first:
            continue
        samples.append({
            "id": task["id"],
            "closed_at": task["closed_at"],
            "days": max(0, (closed - first).days),
            "sprint_id": task["sprint_id"],
            "lane": task["lane"],
            "approximate": _is_approximate(task, "closed_at"),
        })
    samples.sort(key=lambda s: s["closed_at"])
    return _duration_stats(samples, "lead time")


def _aging_wip(tasks, today, cycle):
    out = []
    for task in tasks:
        if task["state"] != "pending":
            continue
        created = _d(task["created_at"])
        age = (today - created).days if created else None
        band = "unknown"
        if age is not None and cycle["usable"]:
            if cycle["p95"] is not None and age > cycle["p95"]:
                band = "over_p95"
            elif cycle["p85"] is not None and age > cycle["p85"]:
                band = "p95"
            elif cycle["p50"] is not None and age > cycle["p50"]:
                band = "p85"
            else:
                band = "p50"
        out.append({
            "id": task["id"],
            "title": task["title"],
            "age_days": age,
            "workflow_state": task["workflow_state"],
            "lane": task["lane"],
            "sprint_id": task["sprint_id"],
            "blocked_by_unmet": list(task["blocked_by_unmet"]),
            "percentile_band": band,
            "approximate": _is_approximate(task, "created_at"),
        })
    out.sort(key=lambda t: (t["age_days"] is None, -(t["age_days"] or 0)))
    return out


# ---------------------------------------------------------------------------
# Monte Carlo forecast
# ---------------------------------------------------------------------------


def _forecast(throughput, remaining, today, trials=MONTE_CARLO_TRIALS, seed=None):
    """Resample observed weekly throughput to a distribution of finish dates.

    Zero-throughput weeks stay in the sample. Dropping them is the single most
    common way this technique is made to lie: a project that delivered in 6 of
    10 weeks does not deliver at its 6-week pace, and removing the 4 quiet
    weeks would advance every percentile by weeks.
    """
    # The current week is almost always incomplete, and an incomplete week
    # looks exactly like a week that delivered nothing. Left in, a Monday
    # regeneration drags every percentile later than a Friday one on identical
    # data. Dropped, and the drop is reported.
    complete = [
        w for w in throughput
        if (_d(w["start"]) or today) + datetime.timedelta(days=7) <= today
    ]
    partial_dropped = len(throughput) - len(complete)
    if not complete:
        complete = list(throughput)
        partial_dropped = 0

    sample = [w["count"] for w in complete]
    zero_weeks = sum(1 for v in sample if v == 0)

    base = {
        "method": "monte_carlo_weekly_throughput",
        "trials": trials,
        "remaining": remaining,
        "sample_weeks": len(sample),
        "sample_values": sample,
        "zero_weeks": zero_weeks,
        "partial_weeks_dropped": partial_dropped,
        "weeks": {},
        "percentiles": {},
        "histogram": [],
        "cone": [],
    }

    if remaining <= 0:
        base["usable"] = False
        base["note"] = (
            "Nothing is pending, so there is nothing to forecast."
        )
        return base
    if not sample or sum(sample) == 0:
        base["usable"] = False
        base["note"] = (
            "No week in the observed window closed a task, so there is no "
            "throughput to resample. A forecast needs at least one completed "
            "task with a resolvable closure date."
        )
        return base

    # Seeded from the inputs, so the same corpus always yields the same
    # forecast and a changed corpus always yields a fresh one.
    if seed is None:
        digest = hashlib.sha256(
            json.dumps([sample, remaining, trials], sort_keys=True).encode("utf-8")
        ).hexdigest()
        seed = int(digest[:16], 16)
    rng = random.Random(seed)

    week_counts = []
    # cumulative[w] collects, across trials, how much was completed by week w.
    horizon = FORECAST_HORIZON_WEEKS
    cumulative = [[] for _ in range(horizon + 1)]

    for _ in range(trials):
        done = 0
        week = 0
        while done < remaining and week < horizon:
            week += 1
            done += rng.choice(sample)
            if week <= horizon:
                cumulative[week].append(min(done, remaining))
        week_counts.append(week)

    p50w = _percentile(week_counts, 50)
    p85w = _percentile(week_counts, 85)
    p95w = _percentile(week_counts, 95)

    def date_at(weeks):
        if weeks is None:
            return None
        return _iso(today + datetime.timedelta(days=7 * weeks))

    base["weeks"] = {"p50": p50w, "p85": p85w, "p95": p95w}
    base["percentiles"] = {
        "p50": date_at(p50w), "p85": date_at(p85w), "p95": date_at(p95w),
    }

    tally = {}
    for weeks in week_counts:
        tally[weeks] = tally.get(weeks, 0) + 1
    running = 0
    for weeks in sorted(tally):
        running += tally[weeks]
        base["histogram"].append({
            "date": date_at(weeks),
            "weeks": weeks,
            "count": tally[weeks],
            "cumulative_pct": round(100.0 * running / trials, 2),
        })

    cone_end = min(horizon, (p95w or 1))
    for week in range(1, cone_end + 1):
        completed = cumulative[week]
        if not completed:
            break
        # A pessimistic REMAINING line is the optimistic COMPLETED percentile
        # inverted; getting this backwards produces a cone that narrows with
        # time, which is the opposite of what uncertainty does.
        base["cone"].append({
            "date": date_at(week),
            "p50": max(0, remaining - (_percentile(completed, 50) or 0)),
            "p85": max(0, remaining - (_percentile(completed, 15) or 0)),
            "p95": max(0, remaining - (_percentile(completed, 5) or 0)),
        })

    base["usable"] = True
    base["note"] = (
        "%d simulated projects, each drawing weekly closure counts with "
        "replacement from the %d complete observed weeks - including the %d "
        "that closed nothing, which are kept in the sample on purpose.%s"
        % (
            trials, len(sample), zero_weeks,
            "" if not partial_dropped else
            " The current incomplete week is excluded, since a part-week looks "
            "identical to a week that delivered nothing.",
        )
    )
    return base


# ---------------------------------------------------------------------------
# dependency graph
# ---------------------------------------------------------------------------


def _dependencies(tasks, ready):
    index = {t["id"]: t for t in tasks}
    involved = sorted(
        t["id"] for t in tasks if t["depends_on"] or t["blocks"]
    )
    involved_set = set(involved)

    edges = []
    for tid in involved:
        for dep in index[tid]["depends_on"]:
            if dep in involved_set:
                edges.append({
                    "from": dep,
                    "to": tid,
                    "satisfied": index[dep]["state"] == "done",
                })

    incoming = {tid: [] for tid in involved}
    outgoing = {tid: [] for tid in involved}
    for edge in edges:
        outgoing[edge["from"]].append(edge["to"])
        incoming[edge["to"]].append(edge["from"])

    # Longest-path layering with explicit cycle detection. A cycle is a real
    # corpus defect (declared work that can never start), so it is reported
    # rather than broken silently by an arbitrary edge removal.
    layer, state, cycles = {}, {}, []

    def visit(node, stack):
        if state.get(node) == "done":
            return layer[node]
        if state.get(node) == "visiting":
            if node in stack:
                cycles.append(stack[stack.index(node):] + [node])
            return 0
        state[node] = "visiting"
        best = 0
        for parent in incoming[node]:
            best = max(best, visit(parent, stack + [node]) + 1)
        state[node] = "done"
        layer[node] = best
        return best

    sys.setrecursionlimit(max(3000, len(involved) * 10))
    for tid in involved:
        visit(tid, [])

    # Longest chain by node count. `on_stack` is not optional: the graph is a
    # DAG only if the corpus is well-formed, and an unguarded recursion on a
    # cyclic one does not return a wrong answer - it exhausts the stack and
    # takes the whole dashboard down. A cycle has to be a reported finding, so
    # the walk treats a back edge as a dead end and lets `visit()` above name it.
    memo, chain, on_stack = {}, {}, set()

    def longest(node):
        if node in memo:
            return memo[node]
        if node in on_stack:
            return 0
        on_stack.add(node)
        best, via = 1, None
        for child in outgoing[node]:
            if child == node:
                continue
            length = longest(child) + 1
            if length > best:
                best, via = length, child
        on_stack.discard(node)
        memo[node] = best
        chain[node] = via
        return best

    for tid in involved:
        longest(tid)

    critical = []
    if involved:
        cursor = max(involved, key=lambda t: (memo.get(t, 0), t))
        while cursor and cursor not in critical:
            critical.append(cursor)
            cursor = chain.get(cursor)

    nodes = []
    for tid in involved:
        task = index[tid]
        nodes.append({
            "id": tid,
            "layer": layer.get(tid, 0),
            "state": task["state"],
            "workflow_state": task["workflow_state"],
            "lane": task["lane"],
            "sprint_id": task["sprint_id"],
            "in_degree": len(incoming[tid]),
            "out_degree": len(outgoing[tid]),
            "on_critical_path": tid in critical,
        })

    deduped = []
    seen = set()
    for cycle in cycles:
        key = tuple(sorted(cycle))
        if key not in seen:
            seen.add(key)
            deduped.append(cycle)

    return {
        "nodes": nodes,
        "edges": edges,
        "layer_count": (max(layer.values()) + 1) if layer else 0,
        "cycles": deduped,
        "critical_path": critical,
        "ready": list(ready),
        "prose_gated": sorted(t["id"] for t in tasks if t["prose_gates"]),
    }


# ---------------------------------------------------------------------------
# activity
# ---------------------------------------------------------------------------


def _activity(record, start, end, weeks):
    tasks, log, commits = record["tasks"], record["log"], record["commits"]

    per_day = {}

    def bump(date, key, amount=1):
        if not date:
            return
        slot = per_day.setdefault(
            date, {"commits": 0, "log_entries": 0, "tasks_closed": 0}
        )
        slot[key] += amount

    for commit in commits:
        bump(commit["date"], "commits")
    for entry in log:
        bump(entry["date"], "log_entries")
    for task in tasks:
        if task["closed_at"]:
            bump(task["closed_at"], "tasks_closed")

    calendar = []
    for date in sorted(per_day):
        slot = per_day[date]
        calendar.append({
            "date": date,
            "commits": slot["commits"],
            "log_entries": slot["log_entries"],
            "tasks_closed": slot["tasks_closed"],
            # A closure is the highest-signal event of the three, so it is
            # weighted; the score exists only to drive the heatmap ramp.
            "score": slot["commits"] + slot["log_entries"] + 2 * slot["tasks_closed"],
        })

    by_month, log_types = {}, {}
    for commit in commits:
        date = _d(commit["date"])
        if date:
            by_month.setdefault(_month(date), {}).setdefault("commits", 0)
            by_month[_month(date)]["commits"] += 1
    for entry in log:
        date = _d(entry["date"])
        if not date:
            continue
        month = _month(date)
        by_month.setdefault(month, {}).setdefault("log_entries", 0)
        by_month[month]["log_entries"] += 1
        types = log_types.setdefault(month, {})
        types[entry["type"]] = types.get(entry["type"], 0) + 1
    for task in tasks:
        date = _d(task["closed_at"])
        if date:
            month = _month(date)
            by_month.setdefault(month, {}).setdefault("tasks_closed", 0)
            by_month[month]["tasks_closed"] += 1
    for decision in record["decisions"]:
        date = _d(decision["date"])
        if date:
            month = _month(date)
            by_month.setdefault(month, {}).setdefault("decisions", 0)
            by_month[month]["decisions"] += 1

    months = sorted(by_month)
    by_month_out = [
        {
            "month": month,
            "commits": by_month[month].get("commits", 0),
            "log_entries": by_month[month].get("log_entries", 0),
            "tasks_closed": by_month[month].get("tasks_closed", 0),
            "decisions": by_month[month].get("decisions", 0),
        }
        for month in months
    ]
    log_types_out = [
        {
            "month": month,
            "types": log_types.get(month, {}),
            "total": sum(log_types.get(month, {}).values()),
        }
        for month in months
    ]

    code_volume = []
    for week in weeks:
        stop = week + datetime.timedelta(days=7)
        ins = dele = count = 0
        for commit in commits:
            date = _d(commit["date"])
            if date and week <= date < stop:
                ins += commit["insertions"]
                dele += commit["deletions"]
                count += 1
        code_volume.append({
            "period": _week_label(week),
            "start": _iso(week),
            "insertions": ins,
            "deletions": dele,
            "commits": count,
        })

    areas = {}
    for commit in commits:
        for area in commit["areas"]:
            areas[area] = areas.get(area, 0) + 1
    top_areas = sorted(
        ({"area": a, "commits": c} for a, c in areas.items()),
        key=lambda x: (-x["commits"], x["area"]),
    )

    return {
        "calendar": calendar,
        "by_month": by_month_out,
        "log_types": log_types_out,
        "code_volume": code_volume,
        "top_areas": top_areas,
    }


# ---------------------------------------------------------------------------
# debt and risk
# ---------------------------------------------------------------------------


def _debt(record, periods, today, cycle, dependencies):
    adhoc = record["adhoc"]

    trend = []
    resolved_dates = sorted(
        d for d in (_d(i["resolved_at"]) for i in adhoc if i["state"] == "resolved") if d
    )
    found_dates = sorted(d for d in (_d(i["found_at"]) for i in adhoc) if d)
    for anchor in periods:
        found = sum(1 for d in found_dates if d <= anchor)
        closed = sum(1 for d in resolved_dates if d <= anchor)
        trend.append({
            "date": _iso(anchor),
            "open": max(0, found - closed),
            "resolved_cumulative": closed,
        })

    cadence = {}
    for decision in record["decisions"]:
        date = _d(decision["date"])
        if date:
            cadence[_month(date)] = cadence.get(_month(date), 0) + 1
    adr_cadence = [{"month": m, "count": cadence[m]} for m in sorted(cadence)]

    open_items = sorted(
        (i for i in adhoc if i["state"] == "open"),
        key=lambda i: (i["found_at"] or "9999-99-99", i["number"]),
    )

    index = {t["id"]: t for t in record["tasks"]}
    risks = []

    for task in record["tasks"]:
        for gate in task["prose_gates"]:
            risks.append({
                "id": task["id"], "kind": "prose_gate", "severity": "high",
                "label": task["id"],
                "detail": "Gated on: %s" % gate,
            })
        if task["state"] == "pending" and task["blocked_by_unmet"]:
            risks.append({
                "id": task["id"], "kind": "unmet_dependency", "severity": "medium",
                "label": task["id"],
                "detail": "Waiting on %s, %s not closed."
                          % (
                              ", ".join(task["blocked_by_unmet"]),
                              "which is" if len(task["blocked_by_unmet"]) == 1
                              else "which are",
                          ),
            })
        if task["state"] == "unparseable":
            risks.append({
                "id": task["id"], "kind": "unparseable_status", "severity": "high",
                "label": task["id"],
                "detail": "Status %r matches neither the pending nor the done "
                          "vocabulary, so the queue cannot classify it."
                          % task["status_raw"][:80],
            })
        if task["state"] == "pending" and task["lane"] == "operator":
            # Not itself a defect, but it is the reason a task can sit in the
            # ready frontier forever, so it belongs on the risk list at low
            # severity rather than being invisible.
            risks.append({
                "id": task["id"], "kind": "operator_gated", "severity": "low",
                "label": task["id"],
                "detail": "In the operator lane: needs a human action no agent "
                          "can perform.",
            })
        if not task["created_at"]:
            risks.append({
                "id": task["id"], "kind": "undated_task", "severity": "low",
                "label": task["id"],
                "detail": "No arrival date could be resolved, so this task is "
                          "absent from every time series.",
            })

    if cycle["usable"] and cycle["p85"] is not None:
        for task in record["tasks"]:
            if task["state"] != "pending":
                continue
            created = _d(task["created_at"])
            if not created:
                continue
            age = (today - created).days
            if age > cycle["p85"]:
                risks.append({
                    "id": task["id"], "kind": "stale_wip", "severity": "medium",
                    "label": task["id"],
                    "detail": "Open %d days against a historical p85 of %d "
                              "(n=%d)." % (age, cycle["p85"], cycle["n"]),
                })

    for item in open_items:
        age = item.get("age_days")
        severity = "low"
        if age is not None and age > 60:
            severity = "high"
        elif age is not None and age > 30:
            severity = "medium"
        risks.append({
            "id": "adhoc-%d" % item["number"], "kind": "open_adhoc",
            "severity": severity, "label": "ad-hoc item %d" % item["number"],
            "detail": item["title"][:200],
        })

    for cycle_path in dependencies.get("cycles", []):
        risks.append({
            "id": "-".join(cycle_path[:2]), "kind": "cycle", "severity": "high",
            "label": " → ".join(cycle_path),
            "detail": "These briefs declare a dependency loop, so none of them "
                      "can ever become ready. One declaration is wrong.",
        })

    order = {"high": 0, "medium": 1, "low": 2}
    risks.sort(key=lambda r: (order.get(r["severity"], 3), r["kind"], r["label"]))
    _ = index
    return {
        "adhoc_trend": trend,
        "open_items": open_items,
        "adr_cadence": adr_cadence,
        "risks": risks,
    }


# ---------------------------------------------------------------------------
# KPIs
# ---------------------------------------------------------------------------


def _trend_over(series, key, days, today):
    """Change in `key` over the trailing `days`, or None if not computable."""
    if len(series) < 2:
        return None
    cutoff = today - datetime.timedelta(days=days)
    past = None
    for point in series:
        date = _d(point["date"])
        if date and date <= cutoff:
            past = point
    if past is None:
        return None
    return series[-1][key] - past[key]


def _kpis(record, totals, burnup, cycle, forecast, velocity, debt, today):
    kpis = []

    completion_trend = None
    if burnup:
        pct_series = [
            {
                "date": p["date"],
                "pct": round(100.0 * p["done"] / p["scope"], 2) if p["scope"] else 0.0,
            }
            for p in burnup
        ]
        completion_trend = _trend_over(pct_series, "pct", 14, today)

    kpis.append({
        "key": "completion", "label": "Scope complete",
        "value": totals["completion_pct"], "unit": "%",
        "sub": "%d of %d tasks" % (totals["done"], totals["tasks"]),
        "tone": "good" if totals["completion_pct"] >= 75 else
                "warn" if totals["completion_pct"] >= 40 else "bad",
        "trend": round(completion_trend, 1) if completion_trend is not None else None,
        "hint": "Closed briefs as a share of all briefs.",
    })

    kpis.append({
        "key": "remaining", "label": "Remaining",
        "value": totals["pending"], "unit": None,
        "sub": "%d in progress, %d blocked, %d not started"
               % (totals["in_progress"], totals["blocked"], totals["not_started"]),
        "tone": "neutral",
        "trend": _trend_over(
            [{"date": p["date"], "remaining": p["remaining"]} for p in burnup],
            "remaining", 14, today,
        ),
        "hint": "Open briefs, by the finer board state.",
    })

    avg = _mean([v["closed"] for v in velocity])
    kpis.append({
        "key": "velocity", "label": "Velocity",
        "value": round(avg, 1) if avg is not None else None, "unit": None,
        "sub": "tasks per sprint, n=%d" % len(velocity),
        "tone": "neutral", "trend": None,
        "hint": "Mean tasks closed per sprint that closed anything. Counts "
                "tasks, not points: this corpus records no estimates.",
    })

    kpis.append({
        "key": "cycle_p85", "label": "Cycle time p85",
        "value": cycle["p85"], "unit": "d",
        "sub": "n=%d, p50 %s d" % (cycle["n"], cycle["p50"]),
        "tone": "neutral", "trend": None,
        "hint": "85% of closed tasks finished within this many days of arriving.",
    })

    if forecast.get("usable"):
        kpis.append({
            "key": "forecast_p85", "label": "85% confident by",
            "value": None, "unit": None,
            "display": forecast["percentiles"]["p85"],
            "sub": "%d weeks at observed throughput" % forecast["weeks"]["p85"],
            "tone": "neutral", "trend": None,
            "hint": "Monte Carlo over observed weekly throughput. Not a "
                    "commitment and not a plan.",
        })

    high = sum(1 for r in debt["risks"] if r["severity"] == "high")
    kpis.append({
        "key": "risks", "label": "High risks",
        "value": high, "unit": None,
        "sub": "%d risks in total" % len(debt["risks"]),
        "tone": "bad" if high else "good", "trend": None,
        "hint": "Prose gates, unreadable statuses and dependency cycles.",
    })

    dated_pct = (
        100.0 * totals["tasks_with_dates"] / totals["tasks"] if totals["tasks"] else 0.0
    )
    kpis.append({
        "key": "data_quality", "label": "Tasks dated",
        "value": round(dated_pct, 1), "unit": "%",
        "sub": "%d of %d have a resolvable arrival date"
               % (totals["tasks_with_dates"], totals["tasks"]),
        "tone": "good" if dated_pct >= 95 else "warn" if dated_pct >= 80 else "bad",
        "trend": None,
        "hint": "Every date here is derived. See the Data & theme tab.",
    })

    return kpis


# ---------------------------------------------------------------------------
# backlog, phases, per-sprint burn, criteria, owners  (schema v2)
# ---------------------------------------------------------------------------

BACKLOG_GRADES = ("high", "medium", "low", "unrated")


def _backlog(backlog):
    """The priority×value matrix, the raised/closed mix, and the totals.

    The matrix counts **open items only**. A closed item's priority is a
    historical fact about a decision already taken; leaving it in would make a
    well-run backlog look exactly like a neglected one, since both accumulate
    closed high-priority rows forever.

    Grades outside the known four are kept under their own label rather than
    coerced into `unrated`: a project that writes `critical` means something by
    it, and silently renaming it would be the tool editing its input.
    """
    rows = [b for b in (backlog or []) if b]
    open_rows = [b for b in rows if b.get("state") == "open"]

    grades = list(BACKLOG_GRADES)
    for row in rows:
        for key in ("priority", "value"):
            grade = row.get(key) or "unrated"
            if grade not in grades:
                grades.append(grade)

    cells = {}
    for row in open_rows:
        key = (row.get("priority") or "unrated", row.get("value") or "unrated")
        cell = cells.setdefault(key, {"count": 0, "ids": []})
        cell["count"] += 1
        cell["ids"].append(row.get("id"))

    matrix = [
        {"priority": p, "value": v, "count": c["count"], "ids": sorted(c["ids"])}
        for (p, v), c in sorted(cells.items())
    ]

    mix = []
    for grade in grades:
        at_grade = [b for b in rows if (b.get("priority") or "unrated") == grade]
        if not at_grade:
            continue
        mix.append({
            "priority": grade,
            "open": sum(1 for b in at_grade if b.get("state") == "open"),
            "closed": sum(1 for b in at_grade if b.get("state") != "open"),
        })

    return {
        "matrix": matrix,
        "mix": mix,
        "grades": grades,
        "totals": {
            "total": len(rows),
            "open": len(open_rows),
            "closed": sum(1 for b in rows if b.get("state") == "done"),
            "cancelled": sum(1 for b in rows if b.get("state") == "cancelled"),
            "high_open": sum(1 for b in open_rows if b.get("priority") == "high"),
            "graded": sum(
                1 for b in open_rows if (b.get("priority") or "unrated") != "unrated"
            ),
        },
        "source": rows[0].get("source") if rows else None,
    }


def _phases(phases):
    """Roadmap phases as a timeline, each bar spanning from the previous one.

    A phase records only its completion date, so its *start* is taken to be the
    previous phase's completion — which is what sequential phases mean. The
    first phase has no predecessor and therefore no span; it is carried with
    `start: null` and rendered as a marker rather than given an invented
    beginning.

    A phase with no date of its own cannot be placed at all, and breaks the
    chain for the next one: its successor's start falls back to the last dated
    phase rather than to nothing, so one undated phase in the middle does not
    silently drop two bars.
    """
    out, previous = [], None
    for phase in phases or []:
        date = phase.get("date")
        record = {
            "number": phase.get("number"),
            "title": phase.get("title"),
            "state": phase.get("state"),
            "start": previous,
            "end": date,
            "dated": bool(date),
            "days": None,
        }
        if date and previous:
            start, end = _d(previous), _d(date)
            if start and end:
                record["days"] = max(0, (end - start).days)
        out.append(record)
        if date:
            previous = date
    return {"timeline": out, "dated": sum(1 for p in out if p["dated"])}


def _sprint_burn(tasks, sprints):
    """Per-sprint burn-down and burn-up, on the sprint's own day grid.

    The `ideal` line is a straight run from the sprint's opening scope to zero
    across its own window. It is arithmetic, not a commitment: no sprint in
    either corpus carries one, and nobody agreed to it. It is emitted so the
    front end can draw the reference people expect, and the front end is
    required to label it as such.

    Sprints shorter than two days, or with no members, produce no series rather
    than a one-point chart that reads as a flat line.
    """
    by_sprint = {}
    for task in tasks:
        by_sprint.setdefault(task["sprint_id"], []).append(task)

    out = {}
    for sprint in sprints:
        members = by_sprint.get(sprint["id"], [])
        if not members:
            continue
        start, end = _d(sprint.get("start")), _d(sprint.get("end"))
        if not start:
            dated = [_d(t["created_at"]) for t in members if t["created_at"]]
            start = min([d for d in dated if d], default=None)
        if not end:
            closed = [_d(t["closed_at"]) for t in members if t["closed_at"]]
            end = max([d for d in closed if d], default=None)
        if not start or not end or (end - start).days < 1:
            continue

        span = (end - start).days
        total = len(members)
        series = []
        for i in range(span + 1):
            day = start + datetime.timedelta(days=i)
            iso = day.isoformat()
            scope = sum(
                1 for t in members
                if t["created_at"] and t["created_at"] <= iso
            )
            done = sum(
                1 for t in members
                if t["state"] == "done" and t["closed_at"] and t["closed_at"] <= iso
            )
            series.append({
                "date": iso,
                "scope": scope,
                "done": done,
                "remaining": max(0, scope - done),
                "ideal": round(total * (1.0 - (i / float(span))), 2),
            })
        out[sprint["id"]] = series
    return out


def _criteria(tasks, sprints):
    """Acceptance-criteria checkbox coverage, per sprint and overall.

    Reported only where a corpus actually uses checkboxes. A project whose
    briefs carry none would otherwise get a chart of zeros, which reads as
    "nothing passed" rather than "this is not recorded here".
    """
    rows, total, checked = [], 0, 0
    order = [s["id"] for s in sprints]
    by_sprint = {}
    for task in tasks:
        crit = task.get("criteria") or {}
        t, c = crit.get("total") or 0, crit.get("checked") or 0
        total += t
        checked += c
        if t:
            slot = by_sprint.setdefault(task["sprint_id"], {"total": 0, "checked": 0})
            slot["total"] += t
            slot["checked"] += c

    for sprint_id in order:
        if sprint_id in by_sprint:
            rows.append(dict(by_sprint[sprint_id], sprint=sprint_id))
    for sprint_id in sorted(set(by_sprint) - set(order)):
        rows.append(dict(by_sprint[sprint_id], sprint=sprint_id))

    return {
        "by_sprint": rows,
        "total": total,
        "checked": checked,
        "recorded": total > 0,
        "tasks_with_criteria": sum(
            1 for t in tasks if (t.get("criteria") or {}).get("total")
        ),
    }


def _owners(tasks):
    """Briefs per recorded owner. Empty where the layout records no owner."""
    counts = {}
    for task in tasks:
        owner = task.get("owner")
        if not owner:
            continue
        slot = counts.setdefault(owner, {"owner": owner, "tasks": 0, "done": 0})
        slot["tasks"] += 1
        if task["state"] == "done":
            slot["done"] += 1
    return sorted(counts.values(), key=lambda o: (-o["tasks"], o["owner"]))


def _date_provenance(tasks):
    """How each closure date was obtained, for the Data tab's own donut.

    Strictly richer than a three-value `done_source`: this reports the full
    `closed_at_source` vocabulary, so "a commit said so" and "a status line said
    so" stay distinguishable rather than collapsing into "recorded".
    """
    counts = {}
    for task in tasks:
        if task["state"] != "done":
            continue
        source = task.get("closed_at_source") or "unknown"
        counts[source] = counts.get(source, 0) + 1
    return [
        {"source": source, "count": count}
        for source, count in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    ]


# ---------------------------------------------------------------------------
# entry point
# ---------------------------------------------------------------------------


def compute(record, trials=MONTE_CARLO_TRIALS, seed=None):
    """Build `SCHEMA.md` section 2 from a collected record."""
    all_tasks, sprints = record["tasks"], record["sprints"]
    # Every series below measures delivery, and cancelled work is not part of
    # it: a burn-up whose scope line includes work that was called off shows
    # scope that never has to be closed, and its gap never shuts. `all_tasks`
    # is kept for the totals, which report what is on disk.
    tasks = [t for t in all_tasks if t["state"] != "cancelled"]
    start, end, today = _window(record)
    span_days = (end - start).days

    granularity = "day" if span_days <= DAILY_WINDOW_LIMIT_DAYS else "week"
    periods = _periods(start, end, granularity)
    weeks = _weeks(start, end)

    burnup = _cumulative_series(tasks, periods)
    cycle = _cycle_time(tasks)
    lead = _lead_time(tasks)
    throughput = _throughput(tasks, weeks)
    velocity = _velocity(tasks, sprints)
    churn = _scope_churn(tasks, weeks)

    pending = [t for t in tasks if t["state"] == "pending"]
    forecast = _forecast(throughput, len(pending), today, trials, seed)
    burndown = _burndown(burnup, forecast, periods)
    cfd = _cfd(tasks, periods)

    state_counts = {state: 0 for state in WORKFLOW_STATES}
    for task in tasks:
        state_counts[task["workflow_state"]] = state_counts.get(
            task["workflow_state"], 0
        ) + 1

    lanes = {}
    for task in tasks:
        slot = lanes.setdefault(task["lane"], {
            "lane": task["lane"], "total": 0, "done": 0, "pending": 0,
            "explicit": 0, "defaulted": 0,
        })
        slot["total"] += 1
        slot["explicit" if task.get("lane_explicit") else "defaulted"] += 1
        if task["state"] == "done":
            slot["done"] += 1
        elif task["state"] == "pending":
            slot["pending"] += 1

    dated = sum(1 for t in tasks if t["created_at"])
    done_count = sum(1 for t in tasks if t["state"] == "done")
    cancelled_count = sum(1 for t in all_tasks if t["state"] == "cancelled")
    # Cancelled work leaves the denominator: it was neither delivered nor is it
    # outstanding. Counting it as done overstates delivery; counting it as
    # pending gives a burn-down that can never reach zero. `tasks` remains the
    # honest total on disk, and `in_scope` is what completion is measured over.
    in_scope = len(all_tasks) - cancelled_count
    totals = {
        "tasks": len(all_tasks),
        "in_scope": in_scope,
        "done": done_count,
        "pending": len(pending),
        "cancelled": cancelled_count,
        "unparseable": sum(1 for t in tasks if t["state"] == "unparseable"),
        "in_progress": state_counts.get("in_progress", 0),
        "blocked": state_counts.get("blocked", 0),
        "not_started": state_counts.get("not_started", 0),
        "sprints": len(sprints),
        "sprints_active": sum(1 for s in sprints if s["state"] == "active"),
        "sprints_closed": sum(1 for s in sprints if s["state"] == "closed"),
        "sprints_planned": sum(1 for s in sprints if s["state"] == "planned"),
        "decisions": len(record["decisions"]),
        "reviews": len(record["reviews"]),
        "adhoc_open": sum(1 for i in record["adhoc"] if i["state"] == "open"),
        "adhoc_resolved": sum(1 for i in record["adhoc"] if i["state"] == "resolved"),
        "log_entries": len(record["log"]),
        "commits": len(record["commits"]),
        "insertions": sum(c["insertions"] for c in record["commits"]),
        "deletions": sum(c["deletions"] for c in record["commits"]),
        "tasks_with_dates": dated,
        "tasks_without_dates": in_scope - dated,
        "completion_pct": (
            round(100.0 * done_count / in_scope, 1) if in_scope else 0.0
        ),
    }

    dependencies = _dependencies(tasks, record.get("_queue_ready", []))
    debt = _debt(record, periods, today, cycle, dependencies)
    activity = _activity(record, start, end, weeks)

    return {
        "as_of": _iso(today),
        "window": {
            "start": _iso(start), "end": _iso(end),
            "days": span_days, "weeks": len(weeks),
        },
        "series_granularity": granularity,
        "totals": totals,
        "kpis": _kpis(record, totals, burnup, cycle, forecast, velocity, debt, today),
        "burnup": burnup,
        "burndown": burndown,
        "cfd": cfd,
        "velocity": velocity,
        "velocity_avg": round(_mean([v["closed"] for v in velocity]) or 0.0, 2),
        "velocity_stddev": round(_stddev([v["closed"] for v in velocity]) or 0.0, 2),
        "throughput": throughput,
        "cycle_time": cycle,
        "lead_time": lead,
        "aging_wip": _aging_wip(tasks, today, cycle),
        "scope_churn": churn,
        "forecast": forecast,
        "dependencies": dependencies,
        "lanes": sorted(lanes.values(), key=lambda entry: -entry["total"]),
        "states": [
            {"state": state, "count": state_counts[state]}
            for state in WORKFLOW_STATES if state_counts.get(state)
        ],
        "activity": activity,
        "debt": debt,
        # schema v2
        "backlog": _backlog(record.get("backlog")),
        "phases": _phases(record.get("phases")),
        "sprint_burn": _sprint_burn(tasks, sprints),
        "criteria": _criteria(tasks, sprints),
        "owners": _owners(tasks),
        "closure_sources": _date_provenance(tasks),
    }


def main(argv=None):
    import argparse

    import pm_collect

    ap = argparse.ArgumentParser(
        description="Compute agile metrics over the project-workflow corpus."
    )
    ap.add_argument("--root", default=None)
    ap.add_argument("--today", default=None)
    ap.add_argument("--trials", type=int, default=MONTE_CARLO_TRIALS)
    ap.add_argument("--seed", type=int, default=None)
    args = ap.parse_args(argv)

    record = pm_collect.collect(args.root, args.today)
    print(json.dumps(
        compute(record, args.trials, args.seed), indent=2, sort_keys=True
    ))
    return 0


if __name__ == "__main__":
    sys.exit(main())
