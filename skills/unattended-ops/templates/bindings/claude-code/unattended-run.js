export const meta = {
  name: 'unattended-run',
  description: 'Drive a queue of settled, committed tasks through loops/unattended-run/ with no human present; parks what it cannot prove and stops before push',
  whenToUse: 'An unattended session over tasks whose design and scope are settled and whose task files are committed. Requires a clean tree and no other session writing to the repository.',
  phases: [
    { title: 'Preflight', detail: 'loop steps 1-3: one writer, the lock on every task, the run opened' },
    { title: 'Plan', detail: 'loop step 5: task-planner, read-only' },
    { title: 'Implement', detail: 'loop step 6: implementer, working tree only' },
    { title: 'Gate', detail: 'loop step 7: gate-runner, through the one entry point' },
    { title: 'Refute', detail: 'loop step 8: refuter; a silent refuter is an objection' },
    { title: 'Adjudicate', detail: 'loop step 9: adjudicator, exactly one of five verdicts' },
    { title: 'Close', detail: 'loop steps 10-11: closer on accept, park-steward otherwise' },
    { title: 'Long gates', detail: 'loop step 13: batched, one at a time' },
    { title: 'Handover', detail: 'loop steps 12 and 14: journal and handover, even on a halt' },
  ],
}

// ---------------------------------------------------------------------------
// The Claude Code binding for loops/unattended-run/loop.md — A TEMPLATE.
//
// De-domained from asset-management's .claude/workflows/arm-autopilot.js
// (A119). A consuming repository copies this file into its own
// .claude/workflows/ and passes every project-specific value in `args`; this
// file carries NO RULE OF ITS OWN (ADR-0022 clause 1.2). The sequence and its
// exit conditions are loop.md's, the method and vocabulary are the
// unattended-ops skill's, and each block below cites the loop step it
// implements. The binding declaration beside it is binding.md.
//
// WEAKER BY CONSTRUCTION THAN THE OPENCODE BINDING, and not to be described as
// equivalent (ADR-0022, "the capability asymmetry"). A Workflow script has no
// shell and no filesystem, so every git read, every journal line and every
// gate goes through an agent, and seven of the nine roles run as default
// workflow subagents with their boundaries stated in the prompt rather than
// enforced. binding.md's "which rules this client enforces" table is the
// honest account.
//
// Run it with a stamped run id — a workflow script may not call Date.now():
//   Workflow({ name: 'unattended-run', args: { runId: '20260924-0100', ... } })
// The full `args` shape is in binding.md.
// ---------------------------------------------------------------------------

const A = args || {}
const B = A.binding || {}

// The five verdicts: the unattended-ops skill owns the enum.
const VERDICTS = ['accept', 'retry', 'park', 'raise-adhoc', 'halt-run']
// loop.md, "Exit conditions": 2 acceptance attempts, 3 mechanical retries.
const ATTEMPT_BOUND = 2
const MECHANICAL_BOUND = 3

// The binding slots this template reads from args.binding (templates/binding.md).
const SLOTS = ['task_file_glob', 'tracker_path', 'gate_map', 'gate_entry_point', 'watchdog_timeout',
  'evidence_file', 'journal_file', 'handover_path', 'commit_shape', 'stash_namespace', 'task_cap']

// The two roles with a Claude Code emission (ADR-0022 Consequences: "the two
// that only think") run as their own agent definitions. The other seven have
// none and run as default workflow subagents.
const AGENT_TYPES = Object.assign({ 'task-planner': 'task-planner', adjudicator: 'adjudicator' }, A.agentTypes || {})

class Halt extends Error {}
class Park extends Error {}
class Mechanical extends Error {}

// --- Refuse before any agent runs ------------------------------------------
// templates/binding.md: every unfilled slot reads unknown, and unknown is a stop.

function unanswered(v) {
  if (v === undefined || v === null) return true
  const s = String(v).trim()
  return s === '' || s.toLowerCase() === 'unknown' || /^<.*>$/.test(s)
}

function seconds(text) {
  const m = /^\s*(\d+)\s*([smh])\s*$/.exec(String(text || ''))
  return m ? Number(m[1]) * { s: 1, m: 60, h: 3600 }[m[2]] : null
}

const problems = []
if (unanswered(A.runId) || !/^[A-Za-z0-9._-]+$/.test(String(A.runId))) problems.push('args.runId (passed in; a script may not generate one)')
for (const k of SLOTS) if (unanswered(B[k])) problems.push('args.binding.' + k)
if (!Array.isArray(A.queue) || !A.queue.length) problems.push('args.queue')
if (!A.gatesByKind || typeof A.gatesByKind !== 'object') problems.push('args.gatesByKind')
if (B.watchdog_timeout && seconds(B.watchdog_timeout) === null) problems.push('args.binding.watchdog_timeout (e.g. 90m)')
for (const t of (Array.isArray(A.queue) ? A.queue : [])) {
  if (!t || unanswered(t.id)) { problems.push('args.queue entry without an id'); continue }
  if (A.gatesByKind && !Array.isArray(A.gatesByKind[t.kind || 'default'])) problems.push('args.gatesByKind.' + (t.kind || 'default') + ' (for ' + t.id + ')')
}
if (problems.length) {
  log('REFUSED before any agent ran: ' + problems.join('; '))
  return { refused: true, problems }
}

const RUN_ID = String(A.runId)
const DRY_RUN = !!A.dryRun
const sub = p => String(p).replace(/<run-id>/g, RUN_ID)
const EVIDENCE = sub(B.evidence_file)
const JOURNAL = sub(B.journal_file)
const HANDOVER = sub(B.handover_path)
const WATCHDOG = seconds(B.watchdog_timeout)
const TRACKER = B.tracker_path
const QUEUE = A.queue.slice(0, Number(B.task_cap))
const LONG_GROUPS = A.longGroups || {}

// --- Plumbing ---------------------------------------------------------------

function header(role, step) {
  return `You are the \`${role}\` role of an unattended run (loops/unattended-run/loop.md step ${step}; the unattended-ops skill owns the method and the "Division of labour" table states your job). No human is present: where you would ask, report instead — asking is parking, never guessing (ADR-0022 clause 2). Run ${RUN_ID}.\n\n`
}

// One role call. A thrown agent() — an unresolvable agentType, a budget
// ceiling — is a halt: it will fail the same way every time.
async function call(role, step, phaseName, body, schema, labelSuffix) {
  const opts = { label: role + (labelSuffix ? ':' + labelSuffix : ''), phase: phaseName }
  if (schema) opts.schema = schema
  if (AGENT_TYPES[role]) opts.agentType = AGENT_TYPES[role]
  try {
    return await agent(header(role, step) + body, opts)
  } catch (e) {
    throw new Halt(`role ${role} could not be run (${AGENT_TYPES[role] ? 'agentType ' + AGENT_TYPES[role] : 'workflow subagent'}): ${e && e.message}`)
  }
}

// loop.md "A step fails mechanically": a null return is retried, bound 3.
async function ask(role, step, phaseName, body, schema, labelSuffix) {
  for (let i = 1; i <= MECHANICAL_BOUND; i++) {
    const got = await call(role, step, phaseName, body, schema, labelSuffix)
    if (got !== null && got !== undefined) return got
    log(`${role} returned nothing (mechanical ${i}/${MECHANICAL_BOUND})`)
  }
  throw new Mechanical(`${role} returned nothing ${MECHANICAL_BOUND} times`)
}

const JOURNAL_SCHEMA = { type: 'object', properties: { appended: { type: 'string' } }, required: ['appended'] }

// Step 12 — run-scribe appends; a script has no filesystem (loop.md step 12).
async function journal(event) {
  const line = JSON.stringify(Object.assign({ run: RUN_ID }, event))
  try {
    await ask('run-scribe', 12, 'Handover',
      `Append exactly this one line to ${JOURNAL} (create its directory if needed; never truncate or rewrite the file), then return it:\n\n${line}`,
      JOURNAL_SCHEMA, 'journal:' + event.event)
  } catch (e) {
    if (e instanceof Mechanical) throw new Halt('the journal could not be written: ' + e.message)
    throw e
  }
}

const S = (props, req) => ({ type: 'object', properties: props, required: req || Object.keys(props) })
const STR = { type: 'string' }
const STRS = { type: 'array', items: { type: 'string' } }
const BOOL = { type: 'boolean' }

// --- State ------------------------------------------------------------------

const closed = []
const parked = []
const adhoc = []
const overrides = []
let halted = null
let startHead = null

// --- Steps 1-3 ----------------------------------------------------------------

const PREFLIGHT_SCHEMA = S({
  branch: STR, head: STR, porcelain: STR,
  tasks: { type: 'array', items: S({ id: STR, globMatches: { type: 'number' }, taskFile: STR, criteriaPresent: BOOL, statusTaskFile: STR, statusTracker: STR, agree: BOOL }) },
  verdict: { type: 'string', enum: ['proceed', 'halt'] }, reason: STR,
})

async function preflight() {
  // Steps 1 and 2. A missing or unparseable preflight is `halt`, never
  // retried (references/return-schemas.md).
  const got = await call('preflight', '1-2', 'Preflight',
    `Read-only: edit, stage, stash and commit nothing.\n\n` +
    `Step 1: run \`git rev-parse --abbrev-ref HEAD\`, \`git rev-parse --short HEAD\` and \`git status --porcelain\`; report the porcelain verbatim. Any output is a halt naming the paths — do not work out whose they are and do not clean them (rule 5).\n\n` +
    `Step 2: for each task below, glob \`${B.task_file_glob}\` with {id} replaced, report the match count and the one path, whether it has acceptance criteria, and its status verbatim from both its own file and ${TRACKER === 'not-applicable' ? 'no tracker (not-applicable)' : TRACKER}. Match nothing against a fixed literal.\n\n` +
    `Tasks: ${QUEUE.map(t => t.id).join(', ')}`,
    PREFLIGHT_SCHEMA)
  if (!got) throw new Halt('preflight returned nothing')
  startHead = got.head
  if (got.verdict !== 'proceed') throw new Halt('preflight: ' + got.reason)
  if (got.porcelain && got.porcelain.trim()) throw new Halt('working tree is dirty:\n' + got.porcelain)
  const byId = {}
  for (const t of got.tasks || []) byId[t.id] = t
  for (const t of QUEUE) {
    const p = byId[t.id]
    // ADR-0022 clause 3: the committed task file is the lock; the tracker
    // threshold is zero here (binding.md, deviation 3).
    if (!p) throw new Halt('preflight did not report ' + t.id)
    if (p.globMatches !== 1) throw new Halt(`${t.id}: task_file_glob matches ${p.globMatches} files`)
    if (!p.criteriaPresent || !p.agree) throw new Halt(`${t.id}: lock not verified (${JSON.stringify(p)})`)
    t.file = p.taskFile
  }
}

// --- Steps 4-11 -----------------------------------------------------------------

const PLAN_SCHEMA = S({ files: STRS, reused: STRS, order: STRS, verification: STRS })
const IMPL_SCHEMA = S({ status: { type: 'string', enum: ['done', 'blocked'] }, filesChanged: STRS, unsatisfiedCriteria: STRS, reason: STR })
const GATE_SCHEMA = S({ gates: { type: 'array', items: S({ handle: STR, state: STR, exitCode: { type: 'number' }, elapsed: STR, evidenceLine: STR, figures: STRS }) } })
const REFUTE_SCHEMA = S({ refuted: BOOL, unevidencedCriteria: STRS, undeclaredChanges: STRS, breachedInvariants: STRS })
const VERDICT_SCHEMA = S({
  verdict: { type: 'string', enum: VERDICTS }, reasoning: STR,
  overrides: { type: 'array', items: S({ finding: STR, reason: STR }) },
  adhocTitles: STRS, guidance: STR,
})
const CLOSE_SCHEMA = S({ commit: STR, refused: STR })
const VERIFY_SCHEMA = S({ head: STR, parent: STR, porcelain: STR, message: STR, files: STRS })
const PARK_SCHEMA = S({ porcelain: STR, stashEntry: STR, paths: STRS })

function step4Deps(task) {
  // Step 4: a dependency named in `after` must have closed in this run.
  const blockers = (task.after || []).filter(d => !closed.some(c => c.id === d))
  if (blockers.length) throw new Park('dependency not satisfied: ' + blockers.join(', '))
}

async function step5Plan(task, guidance) {
  const plan = await ask('task-planner', 5, 'Plan',
    `Plan task ${task.id}. Its task file, ${task.file}, is the specification; scope comes from it, and a plan that adds a requirement is out of scope.` +
    (guidance ? `\n\nThis is attempt 2. The adjudicator's guidance, to be addressed specifically:\n${guidance}` : ''),
    PLAN_SCHEMA, task.id)
  if (!plan.files || !plan.files.length) throw new Mechanical('task-planner returned no files')
  return plan
}

async function step6Implement(task, plan) {
  // return-schemas.md: a missing implementer return is `blocked`.
  let impl
  try {
    impl = await ask('implementer', 6, 'Implement',
      `Implement task ${task.id} (task file ${task.file}) against this plan, leaving the change in the working tree:\n${JSON.stringify(plan, null, 1)}\n\n` +
      `Your boundary (agents/implementer/, stated here because this client cannot enforce it — rule 1): no git write, no tracker edit, no edit to the task file's status row, no ticked criterion. Report every unsatisfied acceptance criterion by name.`,
      IMPL_SCHEMA, task.id)
  } catch (e) {
    if (e instanceof Mechanical) throw new Park('implementer blocked: no return')
    throw e
  }
  if (impl.status !== 'done') throw new Park('implementer blocked: ' + impl.reason)
  return impl
}

function gateEnv() {
  return `GATE_MAP=${JSON.stringify(B.gate_map)} GATE_REPO_ROOT=. GATE_RUN_ROOT=${JSON.stringify(EVIDENCE.replace(/\/[^/]*$/, ''))} EVIDENCE_FILE=${JSON.stringify(EVIDENCE)} GATE_TIMEOUT_SECONDS=${WATCHDOG}`
}

// Step 7 / 13 — the gate-runner is handed the entry point, gate NAMES and
// handles; never a gate command (rule 2, references/gate-map.md). Here that is
// instructed, not structural: the agent has file tools and could open the map.
async function runGates(pairs, step, phaseName, label) {
  const lines = pairs.map(p => `  ${p.handle}  (gate ${p.gate})`).join('\n')
  let report
  try {
    report = await ask('gate-runner', step, phaseName,
      `Run each gate below through the one entry point and nothing else (references/long-gates.md). For each, in order and never concurrently:\n` +
      `  ${gateEnv()} ${B.gate_entry_point} start <handle> <gate>\n` +
      `  then repeat \`${gateEnv()} ${B.gate_entry_point} wait <handle> 420\` while it exits 2.\n` +
      `Do not open the gate map and do not run any gate command yourself (rule 2). A gate that times out is retried at most once, under the handle suffixed .retry.\n\n` +
      `Then report each handle from ${EVIDENCE}: the line beginning \`GATE <handle> \`, verbatim, and any figure the task's criteria want, quoted from the gate's log (references/evidence.md). You are a runner, not a judge.\n\n${lines}`,
      GATE_SCHEMA, label)
  } catch (e) {
    if (e instanceof Mechanical) return pairs.map(p => ({ handle: p.handle, state: 'NOT-RUN', evidenceLine: '' }))
    throw e
  }
  // evidence.md: a gate whose own line was not reported did not run.
  return pairs.map(p => {
    const row = (report.gates || []).find(g => g.handle === p.handle || g.handle === p.handle + '.retry')
    const m = row && /^GATE (\S+) NAME=\S+ STATE=([A-Z]+) /.exec(row.evidenceLine || '')
    return m && (m[1] === p.handle || m[1] === p.handle + '.retry')
      ? Object.assign({}, row, { state: m[2] })
      : { handle: p.handle, state: 'NOT-RUN', evidenceLine: '' }
  })
}

async function step7Gates(task, attempt) {
  const names = A.gatesByKind[task.kind || 'default']
  const gates = await runGates(names.map(g => ({ handle: `${task.id}.a${attempt}.${g}`, gate: g })), 7, 'Gate', task.id)
  await journal({ event: 'gates', task: task.id, attempt, states: gates.map(g => g.handle + '=' + g.state) })
  return gates
}

async function step8Refute(task, impl, gates) {
  const lists = ['unevidencedCriteria', 'undeclaredChanges', 'breachedInvariants']
  const got = await call('refuter', 8, 'Refute',
    `Try to refute the claim that task ${task.id} is complete. Read-only. Check every acceptance criterion in ${task.file} against the diff (\`git diff\`, \`git status --porcelain\`) or ${EVIDENCE}; check the implementer's claims against the real diff; check the invariants the task's own rules state. Uncertain means refuted: true.\n\n` +
    `Implementer reported: ${JSON.stringify(impl)}\nGates: ${JSON.stringify(gates)}`,
    REFUTE_SCHEMA, task.id)
  if (!got || typeof got.refuted !== 'boolean') {
    // references/return-schemas.md, "The null refuter": synthesised here,
    // not retried, and carried into adjudication as an objection.
    await journal({ event: 'refuter-synthesised', task: task.id })
    return { refuted: true, synthesised: true, reason: 'no refutation was returned', unevidencedCriteria: [], undeclaredChanges: [], breachedInvariants: [] }
  }
  // loop.md step 8: true when any list is non-empty.
  if (lists.some(k => (got[k] || []).length)) got.refuted = true
  return got
}

async function step9Adjudicate(task, attempt, impl, gates, refutation) {
  const body = `Decide task ${task.id}, attempt ${attempt} of ${ATTEMPT_BOUND}; retry is available on attempt 1 only. Judge against ${task.file}'s own acceptance criteria.\n\n` +
    `Implementer: ${JSON.stringify(impl)}\nGates (evidence ${EVIDENCE}): ${JSON.stringify(gates)}\nRefutation: ${JSON.stringify(refutation)}\n\n` +
    `Name every finding you downgrade to advisory in overrides, with its reason. raise-adhoc returns titles only — no identifier (rule 4).`
  let got = null
  for (let n = 1; n <= 2 && !got; n++) {
    got = await call('adjudicator', 9, 'Adjudicate', body, VERDICT_SCHEMA, task.id + (n > 1 ? ':reprompt' : ''))
    if (got && VERDICTS.indexOf(got.verdict) === -1) got = null
    if (!got) await journal({ event: n === 1 ? 'verdict-reprompt' : 'verdict-unparseable', task: task.id })
  }
  // loop.md: no verdict within the five after one reprompt is `park`, never `accept`.
  if (!got) return { verdict: 'park', reasoning: 'no verdict within the five after one reprompt' }
  for (const o of got.overrides || []) overrides.push(Object.assign({ task: task.id }, o))
  for (const t of got.adhocTitles || []) adhoc.push(t)
  await journal({ event: 'adjudication', task: task.id, attempt, verdict: got.verdict, overrides: got.overrides || [] })
  // references/verdicts.md: accept needs every objection answered or overridden.
  if (got.verdict === 'accept' && refutation.refuted && !(got.overrides || []).length) {
    return { verdict: 'park', reasoning: 'accept over a refutation with no overrides listed' }
  }
  if (got.verdict === 'retry' && attempt >= ATTEMPT_BOUND) {
    return { verdict: 'park', reasoning: `retry is not available on attempt ${attempt}` }
  }
  return got
}

async function verifyHead() {
  return ask('preflight', 10, 'Close',
    `Read-only. Report \`git rev-parse HEAD\`, \`git rev-parse HEAD~1\`, \`git status --porcelain\` (verbatim), \`git log -1 --format=%B\`, and as files every line of \`git show --name-only --format= HEAD\`.`,
    VERIFY_SCHEMA, 'verify')
}

async function step10Close(task, impl) {
  const before = await verifyHead()
  const declared = Array.from(new Set((impl.filesChanged || []).concat([task.file], TRACKER === 'not-applicable' ? [] : [TRACKER])))
  const got = await call('closer', 10, 'Close',
    `Close task ${task.id}; the adjudicator accepted it. In order, stopping if any part cannot be done honestly (agents/closer/):\n` +
    `1. \`git status --porcelain\`; refuse on any path not in ${JSON.stringify(declared)}.\n` +
    `2. Update ${task.file}'s status and criteria, copying every figure from ${EVIDENCE} (rule 4).\n` +
    (TRACKER === 'not-applicable' ? '' : `3. Update ${task.id}'s row in ${TRACKER} and nothing else there.\n`) +
    `4. Stage each path with \`git add -- <path>\`, by name (ADR-0022 clause 5.4); commit in this shape: ${B.commit_shape}. The message must contain ${task.id}.\n` +
    `5. Push nothing (ADR-0022 clause 4.1). Return the full commit hash, or refused with what you found.`,
    CLOSE_SCHEMA, task.id)
  const after = await verifyHead()
  if (got && got.refused) {
    // loop.md: a refusal is the boundary working — park, never retry.
    if (after.head !== before.head) throw new Halt(`closer refused but HEAD moved ${before.head} -> ${after.head}`)
    throw new Park('closer refused: ' + got.refused)
  }
  if (after.head === before.head) throw new Park('closer made no commit')
  // Cross-checked by a second agent, since the script cannot run git. The
  // task id in the message is loop.md step 12's `git log --grep` guard.
  if (!got || !got.commit || after.head.indexOf(got.commit) !== 0 || after.parent !== before.head ||
      (after.porcelain || '').trim() || (after.message || '').indexOf(task.id) === -1) {
    throw new Halt(`closer's commit for ${task.id} does not verify (claimed ${got && got.commit}, HEAD ${after.head})`)
  }
  // The closer's glob boundary admits `git add -- .` (TASK-0092 finding 18),
  // so the commit's own files are checked against the declared paths, as the
  // OpenCode driver does (TASK-0097). Halt, not park: the commit exists, and
  // undoing it is a history rewrite (loop.md, "Escalate without retrying").
  const undeclared = (after.files || []).filter(f => f && !declared.includes(f))
  if (!Array.isArray(after.files) || undeclared.length) {
    throw new Halt(`closer's commit for ${task.id} contains undeclared paths: ${undeclared.join(', ') || '(no file list reported)'}`)
  }
  closed.push({ id: task.id, commit: after.head.slice(0, 12), files: declared })
  await journal({ event: 'close', task: task.id, commit: after.head.slice(0, 12) })
}

async function step11Park(task, reason) {
  parked.push({ id: task.id, reason })
  const message = String(B.stash_namespace).replace(/<run-id>/g, RUN_ID).replace(/<task-id>/g, task.id) + ' ' + reason.replace(/"/g, "'").slice(0, 160)
  let got
  try {
    got = await ask('park-steward', 11, 'Close',
      `Task ${task.id} is parked. If \`git status --porcelain\` is empty, report that and stop. Otherwise run \`git stash push -u -m "${message}"\`, then report the porcelain (it must be empty) and the \`git stash list\` entry. Never checkout --, reset --hard, clean or stash drop (references/park-and-recover.md).`,
      PARK_SCHEMA, task.id)
  } catch (e) {
    if (e instanceof Mechanical) throw new Halt(`park of ${task.id} could not be confirmed: ${e.message}`)
    throw e
  }
  // return-schemas.md: a park that cannot leave a clean tree ends the run.
  if ((got.porcelain || '').trim()) throw new Halt(`park of ${task.id} left a dirty tree:\n${got.porcelain}`)
  await journal({ event: 'park', task: task.id, reason, stash: got.stashEntry || null, paths: got.paths || [] })
}

async function cycle(task) {
  try {
    step4Deps(task)
    let guidance = null
    for (let attempt = 1; attempt <= ATTEMPT_BOUND; attempt++) {
      const plan = await step5Plan(task, guidance)
      if (DRY_RUN) {
        const gates = await step7Gates(task, attempt)
        await journal({ event: 'dry-run', task: task.id, files: plan.files, gates: gates.map(g => g.state) })
        return
      }
      const impl = await step6Implement(task, plan)
      const gates = await step7Gates(task, attempt)
      const refutation = await step8Refute(task, impl, gates)
      const v = await step9Adjudicate(task, attempt, impl, gates, refutation)
      if (v.verdict === 'accept') { await step10Close(task, impl); return }
      if (v.verdict === 'halt-run') {
        halted = `adjudicator halt-run on ${task.id}: ${v.reasoning}`
        await step11Park(task, 'halt-run')
        throw new Halt(halted)
      }
      if (v.verdict === 'retry') { guidance = v.guidance || v.reasoning; continue }
      // references/verdicts.md: raise-adhoc is orthogonal to done, so the task
      // is not closed on it (binding.md, deviation 4).
      if (v.verdict === 'raise-adhoc') throw new Park('raise-adhoc: ' + (v.adhocTitles || []).join('; '))
      throw new Park(v.reasoning || 'park')
    }
    throw new Park(`attempt bound ${ATTEMPT_BOUND} reached`)
  } catch (e) {
    if (e instanceof Park) return step11Park(task, e.message)
    if (e instanceof Mechanical) return step11Park(task, 'mechanical failure: ' + e.message)
    throw e
  }
}

// --- Steps 13-14 ------------------------------------------------------------------

async function step13LongGates() {
  // Once per group the run touched, one at a time (references/long-gates.md).
  const files = closed.reduce((acc, c) => acc.concat(c.files), [])
  const glob = pat => new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$')
  for (const name of Object.keys(LONG_GROUPS)) {
    const g = LONG_GROUPS[name]
    if (!files.some(f => (g.paths || []).some(p => glob(p).test(f)))) continue
    const gates = await runGates((g.gates || []).map(x => ({ handle: `${RUN_ID}.long.${x}`, gate: x })), 13, 'Long gates', 'long:' + name)
    await journal({ event: 'long-gates', group: name, states: gates.map(x => x.handle + '=' + x.state) })
  }
}

async function step14Handover() {
  // Runs even on a halt: a halted run with no handover is indistinguishable
  // from a crashed one (loop.md step 14).
  try {
    await ask('run-scribe', 14, 'Handover',
      `Re-derive the handover from ${JOURNAL} and ${EVIDENCE} — not from this message — and write it to ${HANDOVER}. Answer, in order: the repository's state now (\`git status --porcelain\` and \`git log --oneline ${startHead || 'HEAD~0'}..HEAD\`, verbatim); what closed, with hashes; what parked and exactly what a human must do to finish each; what timed out or was killed; every adjudicator override; ad-hoc proposals as titles only, stating that no identifier was allocated; and the push step, NOT taken. Halted: ${halted || 'no'}.`,
      JOURNAL_SCHEMA, 'handover')
  } catch (e) {
    log('HANDOVER NOT WRITTEN: ' + e.message)
  }
}

// --- The run ------------------------------------------------------------------

try {
  phase('Preflight')
  await preflight()
  await journal({ event: 'run-start', startHead, dryRun: DRY_RUN, queue: QUEUE.map(t => t.id) })   // step 3
  for (const task of QUEUE) {
    log(`--- ${task.id} ---`)
    await cycle(task)
  }
  if (!DRY_RUN && closed.length) { phase('Long gates'); await step13LongGates() }
} catch (e) {
  if (!(e instanceof Halt)) throw e
  halted = halted || e.message
  log('HALT: ' + halted)
  try { await journal({ event: 'halt', reason: halted }) } catch (e2) { log('journal failed during halt: ' + e2.message) }
}

phase('Handover')
try {
  await journal({ event: 'run-end', closed: closed.map(c => c.id), parked: parked.map(p => p.id), halted, adhocTitles: adhoc, overrides, pushed: false })
} catch (e) { log('journal failed at run end: ' + e.message) }
await step14Handover()
log(`Run ${RUN_ID}: ${closed.length} closed, ${parked.length} parked${halted ? ', HALTED' : ''}. Nothing pushed.`)

return { runId: RUN_ID, startHead, closed, parked, halted, adhocTitles: adhoc, overrides, pushed: false }
