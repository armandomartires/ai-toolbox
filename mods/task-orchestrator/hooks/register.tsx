import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { COORDINATOR_PROTOCOL, assignmentId, buildContract, parseReport } from './contract'
import type { Assignment } from './contract'
import { ENDED, activeCount, addTask, auditRow, blockers, byAgent, byId, isNoVerdict, line, overall, retryTask, runnable, setTask, stallText, stalledBy, startBlocker, summary, WRITE_TOOLS, writeBlocker } from './ledger'
import type { Ledger, Task } from './ledger'
import { detectOverrides, effortOverridesFor, OVERRIDE_ENV, overridesText } from './overrides'
import { enableBlocker, providerById, providersText } from './providers'
import { gate, isBlocked, route } from './router'
import type { Decision } from './router'
import { DEFAULT_CONFIG, EFFORTS, POLICIES, READ_ONLY_TOOLS, ROLE_PROFILES, TASK_CLASSES, WORKER_DENIED_TOOLS, mergeConfig, profileName, roleOfProfile, routesUnder } from './routing'
import type { Config, Effort, Policy, Role, TaskClass } from './routing'
import { remember, syncTheme, watchTheme } from './sigma'
import { renderOutput, statusLineText } from './view'
import type { OrchestrateOutput } from './view'

// The engine lists a module's $.state reads and writes from the atoms declared
// in that same file, so each module declares the atoms it uses.
const enabled = atom({ plugin: 'task-orchestrator', key: 'enabled' } as const, false)
const policy = atom({ plugin: 'task-orchestrator', key: 'policy' } as const, 'balanced')
const ledger = atom({ plugin: 'task-orchestrator', key: 'ledger' } as const, [])
const overrides = atom({ plugin: 'task-orchestrator', key: 'overrides' } as const, [])
const unavailable = atom({ plugin: 'task-orchestrator', key: 'unavailable' } as const, [])

const PLUGIN = 'task-orchestrator'
const TOOL = {
  dispatch: `mcp__${PLUGIN}__dispatch`,
  collect: `mcp__${PLUGIN}__collect`,
  status: `mcp__${PLUGIN}__status`,
  cancel: `mcp__${PLUGIN}__cancel`,
} as const
const STORE_SETTINGS = `${PLUGIN}:settings`
const STORE_AUDIT = `${PLUGIN}:audit`
const AUDIT_ROWS = 200
const CONFIG_FILE = `.claude/${PLUGIN}.json`
const POLL_MS = 1_000

/** The config in force: defaults, then the override files, then the person's live choices. */
let config: Config = DEFAULT_CONFIG
/** What each profile was last registered with, so a dispatch re-registers only on a change. */
const registered = new Map<string, string>()
/** Resolved aliases seen from spawns this session, alias → id. */
const resolved = new Map<string, string>()

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((one): one is string => typeof one === 'string').map(one => one.trim()).filter(Boolean) : [])

const readJson = async ($: EngineInterface, path: string): Promise<unknown> => {
  try {
    const text = await $.fs.read(path)
    return typeof text === 'string' ? JSON.parse(text) : undefined
  } catch {
    return undefined
  }
}

const envOf = async ($: EngineInterface): Promise<Record<string, string | undefined>> => {
  const out: Record<string, string | undefined> = {}
  // Each name a literal, as `claude plugin validate` lists them.
  out.CLAUDE_CODE_SUBAGENT_MODEL = await $.env.get('CLAUDE_CODE_SUBAGENT_MODEL')
  out.CLAUDE_EFFORT = await $.env.get('CLAUDE_EFFORT')
  out.ANTHROPIC_MODEL = await $.env.get('ANTHROPIC_MODEL')
  out.ANTHROPIC_SMALL_FAST_MODEL = await $.env.get('ANTHROPIC_SMALL_FAST_MODEL')
  out.CLAUDE_CODE_EFFORT_LEVEL = await $.env.get('CLAUDE_CODE_EFFORT_LEVEL')
  out.HOME = await $.env.get('HOME')
  out.OPENAI_API_KEY = (await $.env.get('OPENAI_API_KEY')) ? 'set' : undefined
  out.XAI_API_KEY = (await $.env.get('XAI_API_KEY')) ? 'set' : undefined
  return out
}

/** Defaults ← `~/.claude/task-orchestrator.json` ← `<cwd>/.claude/task-orchestrator.json` ← the store. */
const loadConfig = async ($: EngineInterface, env: Record<string, string | undefined>): Promise<string[]> => {
  const refused: string[] = []
  let next: Config = DEFAULT_CONFIG
  const home = env.HOME
  const cwd = await $.session.cwd().catch(() => '')
  for (const path of [home ? `${home}/${CONFIG_FILE}` : undefined, cwd ? `${cwd}/${CONFIG_FILE}` : undefined]) {
    if (!path) continue
    const file = await readJson($, path)
    if (file === undefined) continue
    const merged = mergeConfig(next, file)
    next = merged.config
    refused.push(...merged.refused.map(one => `${path}: ${one}`))
  }
  const stored = await $.store.get(STORE_SETTINGS).catch(() => undefined)
  if (isRecord(stored)) {
    const merged = mergeConfig(next, { policy: stored.policy, optIn: stored.optIn, providers: stored.providers })
    next = merged.config
    if (stored.enabled === true) await update($, enabled, () => true)
  }
  config = next
  await update($, policy, () => config.policy)
  return refused
}

const saveSettings = async ($: EngineInterface) => {
  const on = await read($, enabled)
  await $.store.set(STORE_SETTINGS, { enabled: on, policy: config.policy, optIn: config.optIn, providers: config.providers }).catch(() => undefined)
}

const audit = async ($: EngineInterface, task: Task) => {
  const rows = await $.store.get(STORE_AUDIT).catch(() => undefined)
  const kept = Array.isArray(rows) ? rows : []
  await $.store.set(STORE_AUDIT, [...kept.filter(row => !(isRecord(row) && row.id === task.id && row.agentId === task.agentId)), auditRow(task)].slice(-AUDIT_ROWS)).catch(() => undefined)
}

const statusLine = async ($: EngineInterface) => {
  const on = await read($, enabled)
  if (!on) return $.ui.status(undefined)
  const rows = await read($, ledger)
  const queued = rows.filter(task => task.status === 'queued').length
  $.ui.status(statusLineText(config.policy, activeCount(rows), queued))
}

/** The profile a task runs under (`profileName`): its role's own, or one for its settings. */
const profileOf = (task: Pick<Task, 'role' | 'requested' | 'isolated'>): string => profileName(config, task.role, task.requested.model, task.requested.effort as Effort, task.isolated)

/** A role's profile under the settings a dispatch asks for, by its name; registered again only when they changed. */
const ensureProfile = async ($: EngineInterface, name: string, role: Role, model: string, effort: Effort, isolated: boolean): Promise<string | undefined> => {
  const signature = JSON.stringify({ model, effort, isolated })
  if (registered.get(name) === signature) return undefined
  const profile = ROLE_PROFILES[role]
  try {
    await $.agent.register({
      name,
      description: profile.description,
      prompt: profile.prompt,
      model,
      effort,
      maxTurns: profile.maxTurns,
      disallowedTools: [...WORKER_DENIED_TOOLS],
      ...(profile.readOnly ? { tools: [...READ_ONLY_TOOLS] } : {}),
      ...(isolated ? { isolation: 'worktree' as const } : {}),
    })
    registered.set(name, signature)
    return undefined
  } catch (error) {
    return `profile ${name} could not be registered: ${error instanceof Error ? error.message : String(error)}`
  }
}

const registerProfiles = async ($: EngineInterface): Promise<string[]> => {
  const problems: string[] = []
  const routes = routesUnder(config)
  for (const taskClass of TASK_CLASSES) {
    const { role, model, effort } = routes[taskClass]
    if (gate(model, effort, config)) continue
    const problem = await ensureProfile($, profileName(config, role, model, effort, false), role, model, effort, false)
    if (problem) problems.push(problem)
  }
  return problems
}

/** The routing table as `/orchestrate` draws it. */
const routingView = (): OrchestrateOutput['routes'] =>
  Object.entries(routesUnder(config)).map(([taskClass, routeOf]) => {
    const gated = gate(routeOf.model, routeOf.effort, config)
    const seen = resolved.get(routeOf.model)
    return { taskClass, role: routeOf.role, settings: `${routeOf.model}/${routeOf.effort}${seen ? ` (${seen})` : ''}`, ...(gated ? { gated } : {}) }
  })

const limitsText = () =>
  `limits: ${config.limits.maxConcurrent} concurrent, nesting ${config.limits.maxNesting}, ${config.limits.maxRetries} retries, ${config.limits.maxEscalations} escalation(s)`

const routingTable = (): string =>
  [
    `policy ${config.policy} (${POLICIES.join('|')}); opt-in: high-effort ${config.optIn.highEffort ? 'on' : 'off'}, frontier ${config.optIn.frontier ? 'on' : 'off'}`,
    limitsText(),
    ...Object.entries(routesUnder(config)).map(([taskClass, routeOf]) => {
      const gated = gate(routeOf.model, routeOf.effort, config)
      const seen = resolved.get(routeOf.model)
      return `- ${taskClass}: ${routeOf.role} → ${routeOf.model}/${routeOf.effort}${seen ? ` (resolved ${seen})` : ''}${gated ? ` [gated: ${gated}]` : ''}`
    }),
  ].join('\n')

/** `/orchestrate status`'s text, kept with its panels' data. */
const statusAnswer = async ($: EngineInterface): Promise<string> => {
  const text = await statusText($)
  const rows = await read($, ledger)
  const settings = (one?: { model: string; effort: string }) => (one ? `${one.model}/${one.effort}` : '?')
  const out: OrchestrateOutput = {
    isOn: await read($, enabled),
    policy: config.policy,
    coordinator: await $.session.model().catch(() => 'unknown'),
    run: overall(rows),
    tasks: rows.map(task => ({
      id: task.id,
      role: task.role,
      status: task.status,
      requested: settings(task.requested),
      observed: task.observed ? settings(task.observed) : task.resolvedModel ? `${task.resolvedModel}, effort unverified` : 'unverified',
      next: task.report?.next?.trim() || task.reason || '',
    })),
    overrides: overridesText(await read($, overrides)).split('\n').map(one => one.replace(/^- /, '')),
  }
  return remember(text, out)
}

/** A routing table answer, kept with its panel's data. */
const routingAnswer = async ($: EngineInterface, text: string): Promise<string> =>
  remember(text, { isOn: await read($, enabled), policy: config.policy, routes: routingView(), limits: limitsText() } satisfies OrchestrateOutput)

const statusText = async ($: EngineInterface): Promise<string> => {
  const on = await read($, enabled)
  const rows = await read($, ledger)
  const found = await read($, overrides)
  const refused = await read($, unavailable)
  const coordinator = await $.session.model().catch(() => 'unknown')
  const word = overall(rows)
  return [
    `task-orchestrator ${on ? 'on' : 'off'}, policy ${config.policy}; coordinator model ${coordinator} (its effort is the session's, which this mod never changes)`,
    `run: ${word.word} (${word.why})`,
    'tasks:',
    summary(rows),
    ...(rows.some(task => task.status === 'queued') ? ['blockers:', ...blockers(rows, config.limits).map(one => `- ${one}`)] : []),
    ...(refused.length ? [`models refused this session: ${refused.join(', ')}`] : []),
    'overrides in force (disclosed, not changed):',
    overridesText(found),
  ].join('\n')
}

const settle = async ($: EngineInterface, task: Task, patch: Partial<Task>) => {
  await update($, ledger, rows => setTask(rows, task.id, patch))
  const now = byId(await read($, ledger), task.id)
  if (now) await audit($, now)
  await statusLine($)
}

/** The assignment a task carries until it starts, when the dependencies' findings join it. */
const assignments = new Map<string, Assignment>()

const contractOf = (rows: Ledger, task: Task): string => {
  const assignment = assignments.get(task.id) ?? { inputs: [], prohibited: [], deliverables: [], acceptance: [], tools: ROLE_PROFILES[task.role].readOnly ? `read-only tools (${READ_ONLY_TOOLS.join(', ')}); no shell` : 'the session\'s tools under its permission mode, minus agents, workflows and messaging; writes only inside the allowed files' }
  const results = task.deps
    .map(dep => byId(rows, dep))
    .filter((dep): dep is Task => dep !== undefined && dep.report !== undefined)
    .map(dep => `- ${dep.id} (${dep.role}, ${dep.status}): ${dep.report!.findings || '(no findings line)'}`)
  return buildContract(task, assignment, config.limits, ROLE_PROFILES[task.role].maxTurns, results)
}

/** HEAD, for an isolated worker: what its worktree holds. */
const baseOf = async ($: EngineInterface, task: Task): Promise<string | undefined> => {
  if (!task.isolated) return undefined
  const git = await $.process.run(['git', 'rev-parse', 'HEAD']).catch(() => undefined)
  return git && git.exitCode === 0 ? git.stdout.trim() : undefined
}

/** The Agent call that starts a handed-off task, as the coordinator makes it. */
const handoffCall = (task: Task): string =>
  `subagent_type "${PLUGIN}:${profileOf(task)}", model "${task.requested.model}", effort "${task.requested.effort}", description "${task.description}", prompt: the assignment below, unchanged`

const handoffReason = (task: Task): string =>
  `auto mode gave the orchestrator's spawn no verdict, twice: a plugin's spawn has no model request behind it. Start it yourself with the Agent tool (${handoffCall(task)}); the orchestrator adopts that spawn into ${task.id} by the prompt's header, under the same limits. Or cancel ${task.id}`

/** A handed-off task's assignment, for the coordinator to pass as the Agent prompt. */
const handoffText = (task: Task): string[] => (task.handoff && task.status === 'blocked' ? [`assignment for ${task.id} (the Agent call's prompt, unchanged):`, task.prompt] : [])

/** Starts one queued task: its contract, its profile, its base revision, the spawn. */
const start = async ($: EngineInterface, task: Task): Promise<void> => {
  const name = profileOf(task)
  const problem = await ensureProfile($, name, task.role, task.requested.model, task.requested.effort as Effort, task.isolated)
  if (problem) return settle($, task, { status: 'blocked', reason: problem, endedAt: await $.clock.now() })
  task = { ...task, prompt: contractOf(await read($, ledger), task) }
  const baseRevision = await baseOf($, task)
  const at = await $.clock.now()
  await update($, ledger, rows => setTask(rows, task.id, { status: 'running', startedAt: at, baseRevision, prompt: task.prompt }))
  const spawn = () => $.agent.spawn({ subagentType: `${PLUGIN}:${name}`, prompt: task.prompt, description: task.description, model: task.requested.model, name: task.id }).catch(error => ({ deny: error instanceof Error ? error.message : String(error) }) as { deny: string })
  let ran = await spawn()
  // Auto mode's no-verdict deny asks for the action again once, as-is: the
  // same call through the same check, nothing added to it.
  if (ran.deny !== undefined && isNoVerdict(ran.deny)) ran = await spawn()
  if (ran.deny !== undefined) {
    if (isNoVerdict(ran.deny)) return settle($, task, { status: 'blocked', handoff: true, reason: handoffReason(task), endedAt: await $.clock.now() })
    if (/model/i.test(ran.deny)) await update($, unavailable, list => (list.includes(task.requested.model) ? list : [...list, task.requested.model]))
    return settle($, task, { status: 'blocked', reason: `spawn refused: ${ran.deny}`, endedAt: await $.clock.now() })
  }
  if (ran.model && ran.model !== task.requested.model) resolved.set(task.requested.model, ran.model)
  await settle($, task, { agentId: ran.agentId, resolvedModel: ran.model })
}

/** Starts whatever may run now, one after the other; returns the tasks whose start was refused. */
const tick = async ($: EngineInterface): Promise<Task[]> => {
  const refused: Task[] = []
  if (!(await read($, enabled))) return refused
  for (;;) {
    const next = runnable(await read($, ledger), config.limits)[0]
    if (!next) return refused
    await start($, next)
    const now = byId(await read($, ledger), next.id)
    if (now?.status === 'blocked') refused.push(now)
  }
}

/** Tells the coordinator, in a hidden note, what it did not ask for: a task that ended or could not start. */
const note = async ($: EngineInterface, text: string) =>
  $.session.append({ message: { type: 'user', content: [{ type: 'text', text: `[task-orchestrator] ${text}` }] } }).catch(() => undefined)

type DispatchInput = Record<string, unknown>

const answerDispatch = async ($: EngineInterface, input: DispatchInput): Promise<{ result: string }> => {
  if (!(await read($, enabled))) return { result: 'task-orchestrator is off: nothing was dispatched. Turn it on with /orchestrate on.' }
  const id = String(input.id ?? '').trim()
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,31}$/.test(id)) return { result: 'blocked: id must be 1 to 32 characters of letters, digits, "_", "." or "-"' }
  const objective = String(input.objective ?? '').trim()
  if (!objective) return { result: `blocked: ${id} has no objective` }
  const refused = await read($, unavailable)
  const decision = route(
    { taskClass: String(input.class ?? ''), role: typeof input.role === 'string' ? input.role : undefined, model: typeof input.model === 'string' ? input.model : undefined, effort: typeof input.effort === 'string' ? input.effort : undefined },
    config,
    { unavailable: refused },
  )
  if (isBlocked(decision)) return { result: `blocked: ${id}: ${decision.blocked}${decision.notes.length ? `\nnotes: ${decision.notes.join('; ')}` : ''}` }
  const rows = await read($, ledger)
  const deps = strings(input.deps)
  const isWriter = input.isWriter === true || !ROLE_PROFILES[decision.role].readOnly
  const assignment: Assignment = {
    inputs: strings(input.inputs),
    prohibited: strings(input.prohibited),
    deliverables: strings(input.deliverables),
    acceptance: strings(input.acceptance),
    tools: ROLE_PROFILES[decision.role].readOnly ? `read-only tools (${READ_ONLY_TOOLS.join(', ')}); no shell` : 'the session\'s tools under its permission mode, minus agents, workflows and messaging; writes only inside the allowed files',
  }
  const task: Task = {
    id,
    taskClass: decision.taskClass,
    role: decision.role,
    objective,
    description: `${id} ${decision.role}`,
    deps,
    allowedFiles: strings(input.allowedFiles),
    isWriter,
    isolated: input.isolated === true,
    status: 'queued',
    requested: { model: decision.model, effort: decision.effort },
    retries: 0,
    escalations: 0,
    createdAt: await $.clock.now(),
    notes: [...decision.notes, ...effortOverridesFor(await read($, overrides), decision.model, decision.effort, resolved.get(decision.model)).map(one => `host setting ${one.key} = ${one.value} may replace the requested effort ${decision.effort} (disclosed, not changed)`)],
    prompt: '',
  }
  // Under the id of a task that ended without completing, a dispatch is its next retry.
  const added = retryTask(rows, task, config.limits)
  if (added.refused) return { result: `blocked: ${added.refused}` }
  assignments.set(id, assignment)
  await update($, ledger, () => added.ledger)
  await tick($)
  const now = byId(await read($, ledger), id) ?? task
  const after = await read($, ledger)
  const root = stalledBy(after, now)
  return { result: [line(now), ...now.notes.map(one => `note: ${one}`), ...(root ? [`stalled: ${stallText(now, root)}`] : []), ...handoffText(now)].join('\n') }
}

const answerCollect = async ($: EngineInterface, input: DispatchInput): Promise<{ result: string }> => {
  const ids = strings(input.ids)
  const timeoutMs = typeof input.timeoutMs === 'number' && input.timeoutMs > 0 ? Math.min(input.timeoutMs, config.limits.collectTimeoutMs) : config.limits.collectTimeoutMs
  const deadline = (await $.clock.now()) + timeoutMs
  const targets = (rows: Ledger) => (ids.length ? rows.filter(task => ids.includes(task.id)) : rows)
  for (;;) {
    const rows = await read($, ledger)
    // A task stuck behind one that ended without completing would wait out the timeout.
    const pending = targets(rows).filter(task => !ENDED.includes(task.status) && !stalledBy(rows, task))
    if (!pending.length || (await $.clock.now()) >= deadline) break
    // A `$` call: the wait is free of the hook's budget, which a plain
    // promise would exhaust after ten seconds.
    await $.clock.sleep(POLL_MS)
  }
  const rows = await read($, ledger)
  const chosen = targets(rows)
  if (!chosen.length) return { result: ids.length ? `no task named ${ids.join(', ')}` : 'No task in the ledger.' }
  const word = overall(rows)
  return {
    result: [
      ...chosen.map(task =>
        [
          line(task),
          ...(task.report ? [`  findings: ${task.report.findings || '-'}`, `  files: ${task.report.files || '-'}`, `  checks run: ${task.report.checks || '-'}`, `  evidence: ${task.report.evidence || '-'}`, `  risks: ${task.report.risks || '-'}`] : []),
          ...(task.status === 'running' ? ['  still running when collect timed out'] : []),
          ...(() => {
            const root = stalledBy(rows, task)
            return root ? [`  stalled: ${stallText(task, root)}`] : []
          })(),
          ...handoffText(task),
        ].join('\n'),
      ),
      `run: ${word.word} (${word.why})`,
    ].join('\n'),
  }
}

const cancelTask = async ($: EngineInterface, task: Task): Promise<string> => {
  if (ENDED.includes(task.status)) return `${task.id} already ${task.status}`
  if (task.status === 'running' && task.agentId) {
    const stopped = await $.tool.call({ tool: 'TaskStop', task_id: task.agentId }).catch(error => ({ deny: error instanceof Error ? error.message : String(error) }))
    if ('deny' in stopped && stopped.deny !== undefined) return `${task.id}: stop refused (${stopped.deny}); the worker keeps running`
  }
  await settle($, task, { status: 'cancelled', reason: 'cancelled by the person', endedAt: await $.clock.now() })
  return `${task.id} cancelled`
}

const answerCancel = async ($: EngineInterface, which: string): Promise<string> => {
  const rows = await read($, ledger)
  const chosen = which === 'all' || which === '' ? rows.filter(task => !ENDED.includes(task.status)) : rows.filter(task => task.id === which)
  if (!chosen.length) return which === 'all' || which === '' ? 'nothing to cancel' : `no task named ${which}`
  const lines: string[] = []
  for (const task of chosen) lines.push(await cancelTask($, task))
  return lines.join('\n')
}

const setOptIn = async ($: EngineInterface, args: string[]): Promise<string> => {
  const [what, state] = args
  const key = what === 'high-effort' ? 'highEffort' : what === 'frontier' ? 'frontier' : undefined
  if (!key) return 'usage: /orchestrate opt-in high-effort|frontier [off]'
  config = { ...config, optIn: { ...config.optIn, [key]: state !== 'off' } }
  await saveSettings($)
  return `${what} ${state !== 'off' ? 'enabled' : 'disabled'} for this project's sessions (stored). ${key === 'frontier' ? 'A frontier worker costs the most of any; dispatch one only when a task demonstrably needs it.' : 'xhigh and max are never the default; escalate to them one step at a time.'}`
}

const setProvider = async ($: EngineInterface, args: string[], env: Record<string, string | undefined>): Promise<string> => {
  const [action, id] = args
  if (!action) return providersText(config, env)
  const provider = id ? providerById(id) : undefined
  if (!provider) return `usage: /orchestrate providers enable|disable <${['openai', 'grok'].join('|')}>`
  if (action === 'disable') {
    config = { ...config, providers: { ...config.providers, [provider.id]: { enabled: false } } }
    await saveSettings($)
    return `${provider.id} disabled`
  }
  if (action !== 'enable') return providersText(config, env)
  const blocker = enableBlocker(provider, env)
  if (blocker) return `not enabled: ${blocker}\nDisclosure, for when an adapter exists: ${provider.disclosure}`
  config = { ...config, providers: { ...config.providers, [provider.id]: { enabled: true } } }
  await saveSettings($)
  return `${provider.id} enabled. ${provider.disclosure}`
}

export const register: Register = on => {
  // SIGMAorbital's colours follow the host's theme setting (ADR-0043).
  watchTheme(on)

  on('session.start', async ($, e, next) => {
    await syncTheme($)
    const env = await envOf($)
    const refused = await loadConfig($, env)
    const settings = await $.settings.read().catch(() => undefined)
    await update($, overrides, () => detectOverrides(settings, env))
    for (const one of refused) $.ui.log(`${PLUGIN}: ${one}`)
    try {
      await $.command.register({ name: 'orchestrate', description: 'Lead-coordinator mode: on, off, status, policy, routing, models, opt-in, providers, cancel', argumentHint: 'on|off|status|policy <economy|balanced|quality>|routing|models|opt-in <high-effort|frontier> [off]|providers [enable|disable <id>]|cancel [<task>|all]' })
      await $.tool.register({
        name: 'dispatch',
        description: `Delegate one bounded task to a real isolated subagent chosen by the routing table (model and effort per task class), under the orchestrator's limits: ${config.limits.maxConcurrent} concurrent workers, workers never delegate, one non-isolated writer at a time, ${config.limits.maxRetries} retries and ${config.limits.maxEscalations} escalation per task. Returns the task's line (requested versus observed settings, status, next action); the worker's report arrives through collect. Only while /orchestrate is on.\n\n${COORDINATOR_PROTOCOL}`,
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'A short task id, unique in this run: T1, review-2.' },
            class: { type: 'string', enum: [...TASK_CLASSES], description: 'The task class the routing table keys on.' },
            objective: { type: 'string', description: 'What the worker must achieve, with the background it needs.' },
            inputs: { type: 'array', items: { type: 'string' }, description: 'Files, references and prior results to read.' },
            allowedFiles: { type: 'array', items: { type: 'string' }, description: 'Paths (files or directories) a writer may change; empty means the whole checkout, which also makes it the only writer.' },
            prohibited: { type: 'array', items: { type: 'string' }, description: 'Areas and actions the worker must not touch.' },
            deliverables: { type: 'array', items: { type: 'string' } },
            acceptance: { type: 'array', items: { type: 'string' }, description: 'Observable checks that say the task is done.' },
            deps: { type: 'array', items: { type: 'string' }, description: 'Ids of tasks that must complete first; their findings are passed on.' },
            isWriter: { type: 'boolean', description: 'True when the worker changes files (a writer role implies it).' },
            isolated: { type: 'boolean', description: 'Run the writer in its own git worktree at HEAD (the uncommitted changes are not there), so it may run beside another writer with disjoint allowed files.' },
            role: { type: 'string', description: 'Override the table\'s role, with a reason in the objective.' },
            model: { type: 'string', description: 'Override the table\'s model alias (haiku, sonnet, opus; fable needs opt-in), with a reason.' },
            effort: { type: 'string', enum: [...EFFORTS], description: 'Override the table\'s effort (xhigh and max need opt-in), with a reason.' },
          },
          required: ['id', 'class', 'objective'],
        },
        isDeferred: false,
      })
      await $.tool.register({
        name: 'collect',
        description: 'Wait for the named tasks (or every open one) to end, up to a timeout, and return their reports: status, findings, files, checks actually run, evidence, risks, next action. Call it after dispatching, instead of polling.',
        inputSchema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } }, timeoutMs: { type: 'number' } } },
        isDeferred: false,
      })
      await $.tool.register({
        name: 'status',
        description: 'The orchestrator\'s state: on or off, policy, the coordinator\'s model, every task with its requested and observed model/effort, blockers, and the overrides in force on this host.',
        inputSchema: { type: 'object', properties: {} },
        isDeferred: false,
      })
      await $.tool.register({
        name: 'cancel',
        description: 'Cancel queued work and stop a running worker (TaskStop) by task id, or all of them.',
        inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'A task id, or "all".' } } },
        isDeferred: false,
      })
    } catch (error) {
      $.ui.log(`${PLUGIN}: registration failed: ${error instanceof Error ? error.message : String(error)}`)
    }
    for (const problem of await registerProfiles($)) $.ui.log(`${PLUGIN}: ${problem}`)
    await statusLine($)

    return next(e)
  })

  on('command.run', { command: 'orchestrate' }, async ($, e) => {
    const [sub = 'status', ...args] = e.args.trim().split(/\s+/).filter(Boolean)
    switch (sub) {
      case 'on': {
        await update($, enabled, () => true)
        await saveSettings($)
        await statusLine($)
        await tick($)
        return { text: `task-orchestrator on (policy ${config.policy}). Dispatch through the dispatch tool; /orchestrate status shows the ledger.`, context: [COORDINATOR_PROTOCOL, await statusText($)] }
      }
      case 'off': {
        await update($, enabled, () => false)
        await saveSettings($)
        await statusLine($)
        const rows = await read($, ledger)
        const open = rows.filter(task => !ENDED.includes(task.status)).length
        return { text: `task-orchestrator off: no new dispatch starts. ${open} open task(s) stay in the ledger (${rows.filter(task => task.status === 'running').length} running finish on their own); nothing of yours was changed.`, context: ['task-orchestrator is off: do not call its dispatch tool; work directly or ask the person to turn it on.'] }
      }
      case 'status':
        return { text: await statusAnswer($) }
      case 'policy': {
        const next = args[0]
        if (!next || !(POLICIES as readonly string[]).includes(next)) return { text: `usage: /orchestrate policy <${POLICIES.join('|')}>\n${routingTable()}` }
        config = { ...config, policy: next as Policy }
        await update($, policy, () => config.policy)
        await saveSettings($)
        for (const problem of await registerProfiles($)) $.ui.log(`${PLUGIN}: ${problem}`)
        await statusLine($)
        return { text: await routingAnswer($, `policy ${next} (stored).\n${routingTable()}`), context: [`The orchestrator's policy is now ${next}; the routing table changed accordingly.`] }
      }
      case 'routing':
        return { text: await routingAnswer($, routingTable()) }
      case 'models': {
        const refused = await read($, unavailable)
        const seen = [...resolved.entries()].map(([alias, id]) => `- ${alias} → ${id}`)
        return { text: [`aliases resolved by spawns this session:`, ...(seen.length ? seen : ['- none yet: a resolution is known only once a worker started']), ...(refused.length ? [`refused: ${refused.join(', ')}`] : []), `coordinator: ${await $.session.model().catch(() => 'unknown')}`].join('\n') }
      }
      case 'opt-in':
        return { text: await setOptIn($, args) }
      case 'providers':
        return { text: await setProvider($, args, await envOf($)) }
      case 'cancel':
        return { text: await answerCancel($, args[0] ?? 'all') }
      default:
        return { text: 'usage: /orchestrate on|off|status|policy <name>|routing|models|opt-in <what> [off]|providers [enable|disable <id>]|cancel [<task>|all]' }
    }
  })

  on('ui.render', { component: 'CommandOutput', props: { command: 'orchestrate' } }, async ($, e, next) => renderOutput($, e) ?? next(e))

  // Spawns the model or another plugin makes: a worker never delegates, and a
  // worker profile taken through the Agent tool still counts and is fenced.
  on('agent.spawn', async ($, e, next) => {
    if (!(await read($, enabled))) return next(e)
    const rows = await read($, ledger)
    const parent = e.parentAgentId ? byAgent(rows, e.parentAgentId) : undefined
    if (parent) return { deny: `${parent.id} (${parent.role}) may not spawn agents: workers do not delegate (nesting limit ${config.limits.maxNesting})` }
    // The mod's own dispatch already applied the limits and holds the ledger row.
    if (next.origin.plugin === PLUGIN) return next(e)
    const type = String(e.subagentType ?? '')
    if (!type.startsWith(`${PLUGIN}:`) || e.resume) return next(e)
    const role = roleOfProfile(type.slice(PLUGIN.length + 1))
    const profile = role ? ROLE_PROFILES[role] : undefined
    if (!role || !profile) return next(e)
    if (e.model) {
      const gated = gate(e.model, 'low', config)
      if (gated) return { deny: gated }
    }
    // The coordinator's own Agent call for a task auto mode refused the mod: the
    // classifier judged this call; it is adopted into the task's row, unchanged.
    // The task is the one its prompt's header names (the desktop's Agent tool
    // takes no `name`), else the one `name` names.
    const named = assignmentId(e.prompt) ?? e.name
    const held = named ? byId(rows, named) : undefined
    if (held?.handoff && held.status === 'blocked') {
      // The exact profile, not only the role: the spawn carries no effort, its profile does.
      if (type !== `${PLUGIN}:${profileOf(held)}`) return { deny: `${held.id} waits for a hand-off as ${PLUGIN}:${profileOf(held)}, not ${type}` }
      const blocker = startBlocker(rows, { ...held, status: 'queued' }, config.limits)
      if (blocker) return { deny: `${held.id} cannot start now: ${blocker}` }
      const ran = await next(e)
      if (ran.deny !== undefined || !ran.agentId) return ran
      const at = await $.clock.now()
      await settle($, held, { status: 'running', handoff: undefined, reason: undefined, endedAt: undefined, startedAt: at, agentId: ran.agentId, resolvedModel: ran.model, baseRevision: await baseOf($, held), notes: [...held.notes, 'started by the coordinator\'s Agent call: auto mode gave the orchestrator\'s spawn no verdict'] })
      return ran
    }
    if (activeCount(rows) >= config.limits.maxConcurrent) return { deny: `${config.limits.maxConcurrent} workers are already running; dispatch it through the orchestrator's dispatch tool, which queues it` }
    const ran = await next(e)
    if (ran.deny !== undefined || !ran.agentId) return ran
    const at = await $.clock.now()
    const id = e.name && !byId(rows, e.name) ? e.name : `agent-${rows.length + 1}`
    const task: Task = {
      id,
      taskClass: (Object.entries(routesUnder(config)).find(([, routeOf]) => routeOf.role === role)?.[0] as TaskClass | undefined) ?? 'exploration',
      role,
      objective: e.description,
      description: e.description,
      deps: [],
      allowedFiles: [],
      isWriter: !profile.readOnly,
      isolated: false,
      status: 'running',
      requested: { model: e.model ?? 'profile', effort: 'profile' },
      resolvedModel: ran.model,
      agentId: ran.agentId,
      retries: 0,
      escalations: 0,
      createdAt: at,
      startedAt: at,
      notes: ['spawned through the Agent tool, not dispatch: no allowed-files list, settings from the profile'],
      prompt: '',
    }
    await update($, ledger, list => addTask(list, task).ledger)
    await statusLine($)
    return ran
  }).catch(($, e, next) => (next.called ? next(e) : { deny: `${PLUGIN}: the spawn guard failed, so the spawn is refused` }))

  // One tool.call hook for every tool: the mod's own tools, then the fence
  // around a worker's calls. A matcher naming an MCP tool would make
  // TypeScript expand every connected tool's type, past its depth.
  on('tool.call', async ($, e, next) => {
    const name = String(e.tool)
    if (name === TOOL.dispatch) return answerDispatch($, e as unknown as DispatchInput)
    if (name === TOOL.collect) return answerCollect($, e as unknown as DispatchInput)
    if (name === TOOL.status) return { result: await statusText($) }
    if (name === TOOL.cancel) return { result: await answerCancel($, String((e as unknown as DispatchInput).id ?? 'all')) }
    if (e.agentId && (await read($, enabled))) {
      const rows = await read($, ledger)
      const task = byAgent(rows, e.agentId)
      if (task && task.status === 'running') {
        if ((WORKER_DENIED_TOOLS as readonly string[]).includes(name)) return { deny: `${task.id} (${task.role}) may not call ${name}: workers do not delegate or stop others` }
        if (ROLE_PROFILES[task.role].readOnly && (name === 'Bash' || WRITE_TOOLS.includes(name))) return { deny: `${task.id} (${task.role}) is read-only: ${name} is refused` }
        if (WRITE_TOOLS.includes(name)) {
          const input = e as unknown as { file_path?: unknown; notebook_path?: unknown }
          const path = typeof input.file_path === 'string' ? input.file_path : typeof input.notebook_path === 'string' ? input.notebook_path : undefined
          const blocked = writeBlocker(rows, task, path, await $.session.cwd().catch(() => ''))
          if (blocked) return { deny: blocked }
        }
      }
    }
    return next(e)
  }).catch(($, e, next) => (next.called ? next(e) : e.agentId ? { deny: `${PLUGIN}: the worker fence failed, so the call is refused` } : next(e)))

  // The one place the effective settings are visible: a worker's model request.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId) {
      const task = byAgent(await read($, ledger), e.agentId)
      if (task && !task.observed) {
        const at = await $.clock.now()
        await update($, ledger, rows => setTask(rows, task.id, { observed: { model: e.model, effort: e.effort === undefined ? 'none (model takes no effort)' : String(e.effort), at } }))
      }
    }
    return yield* next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (!e.agentId) return done
    const task = byAgent(await read($, ledger), e.agentId)
    if (!task || task.status !== 'running') return done
    const report = parseReport(e.answer)
    const status: Task['status'] = e.reason !== 'answer' ? 'failed' : report.status === 'unknown' ? 'partial' : report.status
    const reason = e.reason !== 'answer' ? `the worker's turn ended by ${e.reason}` : report.status === 'unknown' ? 'the worker gave no Status line; read its report' : undefined
    await settle($, task, { status, report, reason, endedAt: await $.clock.now() })
    $.ui.toast(`${task.id} · ${task.role.toUpperCase()} · ${status.toUpperCase()}${report.next ? ` · ${report.next}` : ''}`)
    await note($, `${line(byId(await read($, ledger), task.id) ?? task)}. Call collect for the report.`)
    for (const refused of await tick($)) await note($, `${line(refused)}. Call collect for what to do.`)
    return done
  })
}
