import { expect, test } from 'claude-code/testing'
import type { AgentInfo } from 'claude-code'

import type { AgentRow, OrchTask } from '../types'
import {
  activityLine,
  agentKey,
  alertText,
  applyPlan,
  assignTones,
  callEnded,
  callStarted,
  endedBadly,
  iconOf,
  ledgerBadge,
  markAlerted,
  memberCaption,
  memberTone,
  mergeListed,
  nextTone,
  ORCH,
  outcomeOf,
  progressOf,
  recordRun,
  runKey,
  runningText,
  sessionTree,
  spawnedRow,
  summarizeCall,
  taskChange,
  tokensOf,
  toneToken,
  turnCounted,
  turnEnded,
  turnStarted,
} from './model'

const row = (id: string, status: string, more: Partial<AgentRow> = {}): AgentRow => ({
  id,
  type: 'Explore',
  description: id,
  status,
  startedAt: 0,
  calls: 0,
  tokens: 0,
  ...more,
})

const task = (id: string, status: OrchTask['status'], more: Partial<OrchTask> = {}): OrchTask => ({
  id,
  role: 'builder',
  objective: `do ${id}`,
  deps: [],
  status,
  requested: { model: 'sonnet', effort: 'medium' },
  createdAt: 0,
  ...more,
})

test('a spawn opens a running row, which a list merge keeps up to date', () => {
  const spawned = spawnedRow([row('a', 'completed')], { id: 'b', type: 'Plan', description: 'plan it', runId: 'wf_1' }, 10)
  expect(spawned[1]).toMatchObject({ id: 'b', status: 'running', startedAt: 10, runId: 'wf_1' })

  const listed: AgentInfo[] = [
    { id: 'b', type: 'Plan', description: 'plan it', status: 'completed' },
    { id: 'c', type: 'Explore', description: 'look', status: 'running', parentId: 'b', name: 'T1', spawnedBy: 'task-orchestrator' },
  ]
  const merged = mergeListed(spawned, listed, 25)
  expect(merged.find(one => one.id === 'b')).toMatchObject({ status: 'completed', startedAt: 10, endedAt: 25, runId: 'wf_1' })
  expect(merged.find(one => one.id === 'c')).toMatchObject({ status: 'running', startedAt: 25, parentId: 'b', name: 'T1', spawnedBy: 'task-orchestrator' })
  // A row the list no longer names stays, and an end time is kept once set.
  expect(mergeListed(merged, [], 99).map(one => one.id)).toEqual(['a', 'b', 'c'])
  expect(mergeListed(merged, [listed[0]!], 99).find(one => one.id === 'b')?.endedAt).toBe(25)
})

test('a session and a subagent each have one icon; it pulses only while it runs, and an unfinished end is a badge', () => {
  expect(iconOf('agent', 'completed', 0)).toBe('■')
  expect(iconOf('session', 'completed', 0)).toBe('⬢')
  // Running: solid on an even frame, hollow on an odd one.
  expect(iconOf('agent', 'running', 0)).toBe('■')
  expect(iconOf('agent', 'running', 1)).toBe('□')
  expect(iconOf('session', 'running', 1)).toBe('⬡')
  // Waiting to run: hollow and still. Ended: solid and still.
  expect(iconOf('agent', 'pending', 1)).toBe('□')
  expect(iconOf('agent', 'pending', 2)).toBe('□')
  expect(iconOf('agent', 'completed', 1)).toBe('■')
  expect(iconOf('agent', 'failed', 1)).toBe('■')
  expect([outcomeOf('completed'), outcomeOf('failed'), outcomeOf('killed'), outcomeOf('running')]).toEqual([
    undefined,
    { status: 'critical', word: 'FAILED' },
    { status: 'offline', word: 'STOPPED' },
    undefined,
  ])
  expect([ledgerBadge('blocked'), ledgerBadge('partial'), ledgerBadge('failed'), ledgerBadge('cancelled'), ledgerBadge('completed')]).toEqual([
    { status: 'caution', word: 'BLOCKED' },
    { status: 'caution', word: 'PARTIAL' },
    { status: 'critical', word: 'FAILED' },
    { status: 'offline', word: 'CANCELLED' },
    undefined,
  ])
})

test('each new session takes the least used tone, this session holding cyan; none is amber or red', () => {
  expect(nextTone({})).toBe(1)
  expect(nextTone({ a: 1 })).toBe(2)
  expect(nextTone({ a: 1, b: 2, c: 3, d: 4 })).toBe(0)
  expect(toneToken({}, 'main')).toBe('cyan')
  expect(toneToken({ x: 1 }, 'x')).toBe('violet')
  expect(['amber', 'red', 'status-caution', 'status-critical'].some(token => [0, 1, 2, 3, 4].map(i => toneToken({ x: i }, 'x')).includes(token as never))).toBe(false)
})

test('a run, the orchestrator and a delegating agent become sessions in start order; a worker never does', () => {
  const rows = [
    row('lead', 'running', { startedAt: 30, tasks: [{ id: '1', text: 's', status: 'pending' }] }),
    row('parent', 'running', { startedAt: 40 }),
    row('kid', 'running', { startedAt: 41, parentId: 'parent' }),
    row('w1', 'running', { startedAt: 5, tasks: [{ id: '1', text: 's', status: 'pending' }] }),
    row('plain', 'running', { startedAt: 1 }),
  ]
  const tones = assignTones({}, rows, [{ id: 'wf_1', name: 'review', startedAt: 20 }], [task('T1', 'running', { agentId: 'w1', createdAt: 10 })])
  expect(tones).toEqual({ [ORCH]: 1, [runKey('wf_1')]: 2, [agentKey('lead')]: 3, [agentKey('parent')]: 4 })
  // Kept once given, and the same object when nothing changed.
  expect(assignTones(tones, rows, [{ id: 'wf_1', name: 'review', startedAt: 20 }], [task('T1', 'running', { agentId: 'w1' })])).toBe(tones)
})

test('the tree: this session, its sub-sessions under their owners, each with its members and progress', () => {
  const rows = [
    row('a', 'completed', { startedAt: 1, endedAt: 4 }),
    row('b', 'running', { startedAt: 2 }),
    row('parent', 'running', { startedAt: 3, type: 'general-purpose', description: 'split it' }),
    row('kid', 'completed', { startedAt: 4, parentId: 'parent', endedAt: 9 }),
    row('wfa', 'running', { startedAt: 5, runId: 'wf_1' }),
    row('wfb', 'failed', { startedAt: 6, runId: 'wf_1', endedAt: 8 }),
    row('w1', 'running', { startedAt: 7, spawnedBy: 'task-orchestrator' }),
    row('old', 'failed', { startedAt: 6, spawnedBy: 'task-orchestrator', endedAt: 7 }),
  ]
  const runs = [{ id: 'wf_1', name: 'review', ownerId: 'parent', startedAt: 5 }]
  const ledger = [
    task('T1', 'running', { agentId: 'w1', observed: { model: 'sonnet', effort: 'high', at: 8 } }),
    task('T2', 'blocked', { agentId: 'gone', endedAt: 9 }),
    task('T3', 'queued', { deps: ['T1', 'T2'] }),
  ]
  const tones = assignTones({}, rows, runs, ledger)
  const tree = sessionTree({ rows, runs, tones, tasks: [], ledger, policy: 'balanced', isOrchOn: true })
  expect(tree.map(node => [node.name, node.depth])).toEqual([
    ['THIS SESSION', 0],
    ['general-purpose · split it', 1],
    ['WF review', 2],
    ['ORCH BALANCED', 1],
  ])
  const [main, parent, run, orch] = tree
  expect(main?.running.map(m => m.key)).toEqual(['b'])
  expect(main?.completed.map(m => m.key)).toEqual(['a'])
  expect(main?.progress).toEqual({ done: 1, total: 2, unit: 'AGENTS' })
  expect(main?.status).toBe('running')
  expect(parent?.completed.map(m => m.key)).toEqual(['kid'])
  expect(parent?.progress).toEqual({ done: 1, total: 1, unit: 'AGENTS' })
  expect(run?.progress).toEqual({ done: 1, total: 2, unit: 'AGENTS' })
  expect(run?.completed[0]?.badge).toEqual({ status: 'critical', word: 'FAILED' })
  // The orchestrator's members are its ledger tasks, in ledger order, then earlier attempts.
  expect(orch?.progress).toEqual({ done: 1, total: 3, unit: 'TASKS' })
  expect(orch?.running.map(m => m.label)).toEqual(['T1 · builder · do T1', 'T3 · builder · do T3'])
  expect(orch?.running[0]).toMatchObject({ agentId: 'w1', status: 'running', settings: 'sonnet/high' })
  expect(orch?.running[1]).toMatchObject({ agentId: undefined, status: 'pending', waits: ['T1', 'T2'] })
  expect(orch?.completed.map(m => [m.label, m.badge?.word])).toEqual([
    ['T2 · builder · do T2', 'BLOCKED'],
    ['Explore · old', 'FAILED'],
  ])
  // A worker's row moved under the orchestrator: it is not also under this session.
  expect(tree.flatMap(node => [...node.running, ...node.completed]).filter(m => m.agentId === 'w1').length).toBe(1)
  expect(memberTone({ rows, runs, tones, tasks: [], ledger }, 'w1')).toBe(toneToken(tones, ORCH))
  expect(memberTone({ rows, runs, tones, tasks: [], ledger }, 'b')).toBe('cyan')

  // This session's own task list is its progress; an empty ledger draws no orchestrator.
  const plain = sessionTree({ rows: [row('a', 'running')], runs: [], tones: {}, tasks: [{ id: '1', text: 'x', status: 'completed' }, { id: '2', text: 'y', status: 'pending' }], ledger: [] })
  expect(plain.map(node => node.name)).toEqual(['THIS SESSION'])
  expect(plain[0]?.progress).toEqual({ done: 1, total: 2, unit: 'STEPS' })
  expect(sessionTree({ rows, runs, tones, tasks: [], ledger, isOrchOn: false }).find(node => node.kind === 'orch')?.name).toBe('ORCH BALANCED · OFF')
})

test('a member caption says its own steps, what it is doing, its settings, or what it waits on', () => {
  const runner = row('w', 'running', { calls: 2, tasks: [{ id: '1', text: 'a', status: 'completed' }, { id: '2', text: 'b', status: 'in_progress' }] })
  expect(memberCaption({ key: 'w', label: '', status: 'running', isActive: true, row: runner, settings: 'sonnet/high' }, 0)).toBe('1/2 STEPS · 2 CALLS · sonnet/high')
  expect(memberCaption({ key: 'q', label: '', status: 'pending', isActive: true, waits: ['T1'] }, 0)).toBe('WAITS ON T1')
  expect(memberCaption({ key: 'q', label: '', status: 'pending', isActive: true, waits: [] }, 0)).toBe('QUEUED')
  expect(memberCaption({ key: 'd', label: '', status: 'completed', isActive: false, row: row('d', 'completed', { calls: 3, tokens: 1200 }) }, 0)).toBe('3 CALLS · 1.2k TOK')
  expect(memberCaption({ key: 'd', label: '', status: 'completed', isActive: false, row: row('d', 'completed') }, 0)).toBe('')
})

test('a subagent ends on its turn.complete, a lagging list does not reopen it, a new turn does; a teammate is left to the list', () => {
  const rows = [row('w', 'running', { runId: 'wf_1' }), row('x', 'running'), row('t', 'running', { isTeammate: true })]
  expect(turnEnded(rows, 'w', 'answer', 9)[0]).toMatchObject({ status: 'completed', endedAt: 9, isTurnEnded: true })
  expect(turnEnded(rows, 'w', 'aborted', 9)[0]?.status).toBe('killed')
  expect(turnEnded(rows, 'w', 'error', 9)[0]?.status).toBe('failed')
  expect(turnEnded(rows, 'x', 'answer', 9)[1]).toMatchObject({ status: 'completed', endedAt: 9 })
  expect(turnEnded(rows, 't', 'answer', 9)[2]?.status).toBe('running')

  const ended = turnEnded(rows, 'x', 'answer', 9)
  // The list still says running: kept ended, end time kept.
  const lagging = mergeListed(ended, [{ id: 'x', type: 'Explore', description: 'x', status: 'running', name: 'n' }], 20)
  expect(lagging[1]).toMatchObject({ status: 'completed', endedAt: 9, name: 'n' })
  // The list's own end word wins over the turn's, the end time stays the turn's.
  expect(mergeListed(ended, [{ id: 'x', type: 'Explore', description: 'x', status: 'killed' }], 20)[1]).toMatchObject({ status: 'killed', endedAt: 9 })
  // A new turn runs it again, and the list may then end it.
  const woken = turnStarted(lagging, 'x')
  expect(woken[1]).toMatchObject({ status: 'running', endedAt: undefined, isTurnEnded: undefined })
  expect(mergeListed(woken, [{ id: 'x', type: 'Explore', description: 'x', status: 'running' }], 30)[1]?.status).toBe('running')
  // A teammate is known from the list's teammateId.
  expect(mergeListed([], [{ id: 'm', type: 'teammate', description: 'm', status: 'idle', teammateId: 'm@team' }], 1)[0]?.isTeammate).toBe(true)

  let runs = recordRun([], { id: 'wf_1', startedAt: 3 })
  expect(runs).toEqual([{ id: 'wf_1', name: 'workflow', ownerId: undefined, startedAt: 3 }])
  runs = recordRun(runs, { id: 'wf_1', name: 'review', ownerId: 'lead', startedAt: 7 })
  expect(runs).toEqual([{ id: 'wf_1', name: 'review', ownerId: 'lead', startedAt: 3 }])
})

test('task tools change a loop\'s list: TodoWrite, TaskCreate/TaskUpdate, the plan tools', () => {
  const todo = taskChange('TodoWrite', { todos: [{ content: 'a', activeForm: 'doing a', status: 'in_progress' }, { content: 'b', status: 'pending' }] }, {})
  let list = todo!([])
  expect(list).toEqual([{ id: '1', text: 'doing a', status: 'in_progress' }, { id: '2', text: 'b', status: 'pending' }])
  list = taskChange('TaskCreate', { subject: 'c' }, { task: { id: '9' } })!(list)
  list = taskChange('TaskUpdate', { taskId: '9', status: 'completed' }, {})!(list)
  expect(list[2]).toEqual({ id: '9', text: 'c', status: 'completed' })
  list = taskChange('TaskUpdate', { taskId: '9', status: 'deleted' }, {})!(list)
  expect(list.length).toBe(2)
  expect(taskChange('mcp__x__update_plan', { items: [{ content: 'p', status: 'pending' }] }, {})!(list)).toEqual([{ id: '1', text: 'p', status: 'pending' }])
  expect(taskChange('mcp__x__wrap_up', {}, {})!(list).every(one => one.status === 'completed')).toBe(true)
  expect(taskChange('TaskCreate', { subject: 'c' }, {})).toBeUndefined()
  expect(taskChange('Bash', {}, {})).toBeUndefined()
})

test('update_plan items, advance, done and start follow the app', () => {
  let list = applyPlan([], {
    items: [
      { content: 'a', status: 'in_progress' },
      { content: 'b', status: 'pending' },
      { content: 'c', status: 'pending' },
    ],
  })
  expect(progressOf(list)).toEqual({ done: 0, total: 3, current: 'a' })
  list = applyPlan(list, { advance: true })
  expect(list.map(task => task.status)).toEqual(['completed', 'in_progress', 'pending'])
  list = applyPlan(list, { done: [2], start: 3 })
  expect(progressOf(list)).toEqual({ done: 2, total: 3, current: 'c' })
})

test('a call is summarized by its main argument, and the row counts it', () => {
  expect(summarizeCall('Bash', { command: 'ls  -la\n  /tmp' })).toEqual({ tool: 'Bash', detail: 'ls -la /tmp' })
  expect(summarizeCall('Read', { file_path: '/p/a.ts' })).toEqual({ tool: 'Read', detail: '/p/a.ts' })
  expect(summarizeCall('Grep', { pattern: 'x' }).detail).toBe('x')
  expect(summarizeCall('Agent', { description: 'look' }).detail).toBe('look')
  expect(summarizeCall('TodoWrite', { todos: [] }).detail).toBe('')
  expect(summarizeCall('Bash', { command: 'a'.repeat(50) }, 10).detail).toBe('aaaaaaaaa…')

  let rows = [row('a', 'running')]
  rows = callStarted(rows, 'a', { tool: 'Bash', detail: 'ls', since: 100 })
  expect(activityLine(rows[0]!, 1_000)).toBe('Bash: ls · 0 CALLS')
  expect(activityLine(rows[0]!, 9_100)).toBe('Bash: ls (9s) · 0 CALLS')
  rows = callEnded(rows, 'a')
  expect(rows[0]).toMatchObject({ calls: 1, activity: undefined })
  expect(callEnded(rows, 'zz')).toEqual(rows)
  expect(tokensOf({ input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 })).toBe(1200)
  expect(tokensOf({ input_tokens: 5 })).toBe(5)
  expect(tokensOf(undefined)).toBe(0)
  rows = turnCounted(rows, 'a', 1200, 'm1')
  expect(rows[0]).toMatchObject({ tokens: 1200, model: 'm1' })
  expect(activityLine(rows[0]!, 0)).toBe('1 CALL · 1.2k TOK')
  expect(activityLine(turnCounted(rows, 'a', 2_000_000)[0]!, 0)).toBe('1 CALL · 2M TOK')
  // The fields survive a list merge, and the activity leaves with the status.
  const merged = mergeListed(rows, [{ id: 'a', type: 'Explore', description: 'a', status: 'completed' }], 5)
  expect(merged[0]).toMatchObject({ calls: 1, tokens: 1200, model: 'm1', activity: undefined })
  expect(spawnedRow([], { id: 'b', type: 'Plan', description: 'p', model: 'm2' }, 1)[0]).toMatchObject({ model: 'm2', calls: 0, tokens: 0 })
})

test('a failed or stopped agent is alerted once', () => {
  const before = [row('a', 'running'), row('b', 'running'), row('c', 'completed')]
  const after = [row('a', 'failed'), row('b', 'killed'), row('c', 'failed'), row('d', 'failed')]
  expect(endedBadly(before, after).map(one => one.id)).toEqual(['a', 'b', 'd'])
  const marked = markAlerted(after, ['a', 'b', 'd'])
  expect(endedBadly(after, marked)).toEqual([])
  expect(alertText({ ...row('a', 'failed'), startedAt: 0, endedAt: 72_000 })).toBe('EXPLORE · a · FAILED 00:01:12')
  expect(alertText({ ...row('b', 'killed'), startedAt: 0, endedAt: 5_000 })).toBe('EXPLORE · b · STOPPED 00:00:05')
  expect([runningText(0), runningText(1), runningText(2)]).toEqual([undefined, '1 AGENT RUNNING', '2 AGENTS RUNNING'])
})
