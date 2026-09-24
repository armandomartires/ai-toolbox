// Tests for unattended-run.js, against a stub of the Workflow runtime.
//
// Run:  node --test skills/unattended-ops/templates/bindings/claude-code/tests/
//
// The template is evaluated as an async function body with fake `agent`,
// `phase`, `log` and `args`, and with `Date` / `Math.random` that throw as the
// real runtime's do. This proves CONTROL FLOW against a MODEL of the runtime;
// it is not a Workflow run and proves nothing about one. NOT run from
// tests/validate.sh.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const DIR = dirname(HERE)
const SRC = readFileSync(join(DIR, 'unattended-run.js'), 'utf8')
const BODY = SRC.replace(/^export const meta =/m, 'const meta =')
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

const ThrowingDate = new Proxy(Date, {
  get(t, k) { if (k === 'now') return () => { throw new Error('Date.now() is unavailable in a workflow') }; return t[k] },
  construct(t, a) { if (!a.length) throw new Error('argless new Date() is unavailable'); return new t(...a) },
})
const ThrowingMath = Object.assign(Object.create(Math), { random() { throw new Error('Math.random() is unavailable') } })

const BINDING = {
  task_file_glob: '.ai/tasks/{id}-*.md', tracker_path: 'TODO.md', gate_map: 'gates.json',
  gate_entry_point: './run-gate.sh', watchdog_timeout: '90m',
  evidence_file: '.run/<run-id>/evidence.txt', journal_file: '.run/<run-id>/journal.jsonl',
  handover_path: '.run/<run-id>/handover.md', commit_shape: 'TASK-ID: imperative subject',
  stash_namespace: 'unattended/<run-id>/<task-id>', task_cap: '5',
}
const baseArgs = (over = {}) => Object.assign({
  runId: 'r1', binding: Object.assign({}, BINDING, over.binding || {}),
  queue: [{ id: 'TASK-0001' }], gatesByKind: { default: ['unit'] },
  longGroups: { build: { gates: ['build'], paths: ['src/*'] } },
}, Object.fromEntries(Object.entries(over).filter(([k]) => k !== 'binding')))

// A scripted runtime. `over[role]` replaces the default reply for that role;
// it may be a value or a function (prompt, opts, state) -> value.
function runtime(over = {}) {
  const state = { head: 'h0000000000000000', n: 0, calls: [], journal: [], logs: [], verify: 0 }
  const role = l => l.split(':')[0]
  const defaults = {
    preflight(prompt, opts) {
      if (opts.label === 'preflight:verify') {
        return { head: state.head, parent: state.parent || 'none', porcelain: '', message: state.message || '' }
      }
      const ids = /Tasks: (.*)$/m.exec(prompt)[1].split(', ')
      return { branch: 'master', head: state.head.slice(0, 7), porcelain: '', verdict: 'proceed', reason: '',
        tasks: ids.map(id => ({ id, globMatches: 1, taskFile: `.ai/tasks/${id}-x.md`, criteriaPresent: true, statusTaskFile: 'planned', statusTracker: 'planned', agree: true })) }
    },
    'task-planner': () => ({ files: ['src/a.txt'], reused: [], order: ['edit'], verification: ['unit'] }),
    implementer: () => ({ status: 'done', filesChanged: ['src/a.txt'], unsatisfiedCriteria: [], reason: '' }),
    'gate-runner': prompt => ({ gates: [...prompt.matchAll(/^  (\S+)  \(gate (\S+)\)$/gm)].map(m => ({
      handle: m[1], state: 'PASSED', exitCode: 0, elapsed: '1s',
      evidenceLine: `GATE ${m[1]} NAME=${m[2]} STATE=PASSED EXIT=0 ELAPSED=1s LOG=x`, figures: [] })) }),
    refuter: () => ({ refuted: false, unevidencedCriteria: [], undeclaredChanges: [], breachedInvariants: [] }),
    adjudicator: () => ({ verdict: 'accept', reasoning: 'evidenced', overrides: [], adhocTitles: [], guidance: '' }),
    closer(prompt) {
      const id = /Close task (\S+);/.exec(prompt)[1]
      state.parent = state.head
      state.head = 'c' + String(++state.n).padStart(15, '0')
      state.message = `${id}: change`
      return { commit: state.head, refused: '' }
    },
    'park-steward': () => ({ porcelain: '', stashEntry: 'stash@{0}', paths: ['src/a.txt'] }),
    'run-scribe'(prompt, opts) {
      if (opts.label.startsWith('run-scribe:journal')) {
        const line = prompt.split('\n\n').slice(-1)[0]
        state.journal.push(JSON.parse(line))
        return { appended: line }
      }
      return { appended: 'handover written' }
    },
  }
  const agent = async (prompt, opts) => {
    state.calls.push({ role: role(opts.label), prompt, opts })
    const r = role(opts.label)
    const h = r in over ? over[r] : defaults[r]
    return typeof h === 'function' ? h(prompt, opts, state, defaults) : h
  }
  return { state, agent }
}

async function run(args, over) {
  const rt = runtime(over)
  const fn = new AsyncFunction('agent', 'phase', 'log', 'args', 'parallel', 'pipeline', 'budget', 'Date', 'Math', BODY)
  const result = await fn(rt.agent, () => {}, m => rt.state.logs.push(m), args,
    () => { throw new Error('unused') }, () => { throw new Error('unused') }, { total: null }, ThrowingDate, ThrowingMath)
  const s = rt.state
  return {
    result, s,
    calls: r => s.calls.filter(c => c.role === r),
    events: e => s.journal.filter(j => j.event === e),
  }
}

// --- Parse --------------------------------------------------------------------
// `node --check` is NOT evidence here: it exits 0 on a file with an `export`
// and a top-level `return`, and on a plainly broken one (observed, node 22).
// Building the body as an async function is the shape the runtime runs.

test('the template parses as a workflow body, and the check can fail', () => {
  assert.doesNotThrow(() => new AsyncFunction('agent', 'phase', 'log', 'args', BODY))
  assert.throws(() => new AsyncFunction('agent', BODY + '\nconst x = ('), SyntaxError)
})

// --- Refusal ------------------------------------------------------------------

test('refuses before any agent runs without a run id or with an unanswered slot', async () => {
  for (const args of [baseArgs({ runId: undefined }), baseArgs({ binding: { task_cap: 'unknown' } }),
    baseArgs({ binding: { gate_entry_point: '<FILL: path>' } }), baseArgs({ gatesByKind: { other: [] } })]) {
    const r = await run(args)
    assert.equal(r.result.refused, true)
    assert.equal(r.s.calls.length, 0)
  }
})

// --- Happy path -----------------------------------------------------------------

test('closes a task, and only the closer is asked to stage or commit', async () => {
  const r = await run(baseArgs())
  assert.equal(r.result.halted, null)
  assert.deepEqual(r.result.closed.map(c => c.id), ['TASK-0001'])
  for (const c of r.s.calls) {
    if (c.role !== 'closer') assert.doesNotMatch(c.prompt, /git add|git commit/, `${c.role} was asked to stage or commit`)
    assert.doesNotMatch(c.prompt, /git push/, `${c.role} was asked to push`)
  }
  assert.match(r.calls('closer')[0].prompt, /git add -- <path>/)
  assert.equal(r.result.pushed, false)
})

test('the two thinking roles run as their own agent types, the rest as workflow subagents', async () => {
  const r = await run(baseArgs())
  for (const c of r.s.calls) {
    const want = ['task-planner', 'adjudicator'].includes(c.role) ? c.role : undefined
    assert.equal(c.opts.agentType, want, c.role)
  }
})

test('the gate-runner is handed gate names and the entry point, never a gate map', async () => {
  const r = await run(baseArgs())
  const p = r.calls('gate-runner')[0].prompt
  assert.match(p, /\.\/run-gate\.sh start <handle> <gate>/)
  assert.match(p, /TASK-0001\.a1\.unit {2}\(gate unit\)/)
  assert.doesNotMatch(p, /argv/)
})

test('long gates run for a group the closed task touched', async () => {
  const r = await run(baseArgs())
  assert.equal(r.events('long-gates').length, 1)
  assert.match(r.calls('gate-runner')[1].prompt, /r1\.long\.build/)
})

// --- The refuter fails closed ---------------------------------------------------

test('a null, empty or malformed refuter return reaches adjudication as refuted: true, unretried', async () => {
  for (const reply of [null, {}, { refuted: 'no' }]) {
    const r = await run(baseArgs(), { refuter: reply })
    assert.equal(r.calls('refuter').length, 1, 'refuter was retried')
    const p = r.calls('adjudicator')[0].prompt
    assert.match(p, /"refuted":true,"synthesised":true/)
  }
})

test('a refutation with findings but refuted: false is forced true', async () => {
  const r = await run(baseArgs(), { refuter: { refuted: false, unevidencedCriteria: ['x'], undeclaredChanges: [], breachedInvariants: [] } })
  assert.match(r.calls('adjudicator')[0].prompt, /"refuted":true/)
})

// --- Verdict dispatch -----------------------------------------------------------

test('a null or out-of-enum verdict is reprompted once, then parked, never accepted', async () => {
  for (const reply of [null, { verdict: 'ship-it', reasoning: '', overrides: [], adhocTitles: [], guidance: '' }]) {
    const r = await run(baseArgs(), { adjudicator: reply })
    assert.equal(r.calls('adjudicator').length, 2)
    assert.equal(r.events('verdict-reprompt').length, 1)
    assert.equal(r.calls('closer').length, 0)
    assert.equal(r.result.parked.length, 1)
  }
})

test('retry on attempt 2 parks', async () => {
  const r = await run(baseArgs(), { adjudicator: { verdict: 'retry', reasoning: 'fix', overrides: [], adhocTitles: [], guidance: 'fix it' } })
  assert.equal(r.calls('implementer').length, 2)
  assert.match(r.calls('task-planner')[1].prompt, /fix it/)
  assert.match(r.result.parked[0].reason, /attempt 2/)
})

test('accept over a refutation with no overrides parks', async () => {
  const r = await run(baseArgs(), { refuter: { refuted: true, unevidencedCriteria: ['a'], undeclaredChanges: [], breachedInvariants: [] } })
  assert.equal(r.calls('closer').length, 0)
  assert.match(r.result.parked[0].reason, /no overrides/)
})

test('raise-adhoc parks and records the title only', async () => {
  const r = await run(baseArgs(), { adjudicator: { verdict: 'raise-adhoc', reasoning: 'x', overrides: [], adhocTitles: ['Gate predates task'], guidance: '' } })
  assert.deepEqual(r.result.adhocTitles, ['Gate predates task'])
  assert.equal(r.result.closed.length, 0)
})

test('halt-run parks the task and ends the run with a handover', async () => {
  const r = await run(baseArgs({ queue: [{ id: 'TASK-0001' }, { id: 'TASK-0002' }] }),
    { adjudicator: { verdict: 'halt-run', reasoning: 'needs a requirement change', overrides: [], adhocTitles: [], guidance: '' } })
  assert.match(r.result.halted, /halt-run/)
  assert.equal(r.calls('implementer').length, 1, 'the run continued after halt-run')
  assert.equal(r.s.calls.filter(c => c.opts.label === 'run-scribe:handover').length, 1)
})

// --- Close and park -------------------------------------------------------------

test('a closer refusal parks and is not retried', async () => {
  const r = await run(baseArgs(), { closer: { commit: '', refused: 'undeclared path x' } })
  assert.equal(r.calls('closer').length, 1)
  assert.match(r.result.parked[0].reason, /closer refused/)
})

test("a commit that does not verify halts the run", async () => {
  const r = await run(baseArgs(), {
    closer: (p, o, state, d) => { d.closer(p, o); state.message = 'unrelated message'; return { commit: state.head, refused: '' } },
  })
  assert.match(r.result.halted, /does not verify/)
})

test('a park that leaves a dirty tree halts the run', async () => {
  const r = await run(baseArgs(), {
    implementer: { status: 'blocked', filesChanged: [], unsatisfiedCriteria: [], reason: 'ambiguous' },
    'park-steward': { porcelain: ' M src/a.txt', stashEntry: '', paths: [] },
  })
  assert.match(r.result.halted, /dirty tree/)
})

// --- Preflight and identity -----------------------------------------------------

test('a dirty tree halts at preflight, before any task role, and still hands over', async () => {
  const r = await run(baseArgs(), { preflight: (p, o, s, d) => Object.assign(d.preflight(p, o), { porcelain: '?? stray.txt' }) })
  assert.match(r.result.halted, /dirty/)
  assert.equal(r.calls('task-planner').length, 0)
  assert.equal(r.s.calls.filter(c => c.opts.label === 'run-scribe:handover').length, 1)
})

test('an agent type that cannot be resolved halts the run rather than falling back', async () => {
  const r = await run(baseArgs(), { 'task-planner': () => { throw new Error('unknown agent type') } })
  assert.match(r.result.halted, /agentType task-planner/)
  assert.equal(r.calls('implementer').length, 0)
})

test('a gate the runner did not report is NOT-RUN in adjudication', async () => {
  const r = await run(baseArgs(), { 'gate-runner': { gates: [] } })
  assert.match(r.calls('adjudicator')[0].prompt, /"state":"NOT-RUN"/)
})

// --- Queue ------------------------------------------------------------------------

test('an unsatisfied dependency parks and the run skips forward', async () => {
  const r = await run(baseArgs({ queue: [{ id: 'TASK-0001', after: ['TASK-0002'] }, { id: 'TASK-0002' }] }))
  assert.deepEqual(r.result.parked.map(p => p.id), ['TASK-0001'])
  assert.deepEqual(r.result.closed.map(c => c.id), ['TASK-0002'])
})

test('a dry run plans and gates but never implements or closes', async () => {
  const r = await run(baseArgs({ dryRun: true }))
  assert.equal(r.calls('implementer').length, 0)
  assert.equal(r.calls('closer').length, 0)
  assert.equal(r.events('dry-run').length, 1)
})

// --- De-domaining and the declaration -------------------------------------------

test('the template carries none of the source project\'s identifiers', () => {
  const code = SRC.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n')
  for (const pat of [/S02\d/, /\bA1\d\d\b/, /Invoke-Gate/, /excel/i, /workbook/i, /\.ps1/, /PowerQuery/i, /\bVBA\b/, /docs\/ai\//, /ARM-/]) {
    assert.doesNotMatch(code, pat)
  }
})

test('check-binding.sh accepts a filled binding.md and rejects the template', () => {
  const checker = join(DIR, '..', '..', '..', 'scripts', 'check-binding.sh')
  const template = join(DIR, 'binding.md')
  const filled = readFileSync(template, 'utf8').replace(/^([a-z_]+): <FILL:[^\n]*>$/gm, (_, k) => `${k}: filled-by-test`)
  const d = mkdtempSync(join(tmpdir(), 'cc-binding-'))
  try {
    writeFileSync(join(d, 'binding.md'), filled)
    const ok = spawnSync('bash', [checker, join(d, 'binding.md')], { encoding: 'utf8' })
    assert.equal(ok.status, 0, ok.stdout)
  } finally { rmSync(d, { recursive: true, force: true }) }
  assert.notEqual(spawnSync('bash', [checker, template]).status, 0)
})
