import { expect, test } from 'claude-code/testing'

import { ORCH, iconOf, ledgerBadge, memberCaption, memberTone, outcomeOf, runKey, agentKey, sessionTree, toneToken } from './sessions'
import type { AgentRow, OrchTask } from './sessions'
import { headCaption, trimTree } from './model'

// agent-watch's tree tests, run against this mod's copy of the shared module
// (ADR-0045): the copy is byte-identical, so they pass in both or in neither.
// The tones agent-watch's `assignTones` would hand out are written out: a run,
// the orchestrator and a delegating agent, in start order.

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
  const tones = { [ORCH]: 1, [agentKey('parent')]: 2, [runKey('wf_1')]: 3 }
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
  // The session is open while it has no running member: idle, never done.
  expect(plain[0]?.status).toBe('running')
  expect(sessionTree({ rows: [row('a', 'completed')], runs: [], tones: {}, tasks: [], ledger: [] })[0]?.status).toBe('idle')
  expect(sessionTree({ rows: [], runs: [], tones: {}, tasks: [], ledger: [] })[0]?.status).toBe('idle')
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


test('a tree too tall for its budget loses members, never a head or a ledger task, and says how many', () => {
  const rows = Array.from({ length: 6 }, (_, i) => row(`m${i}`, 'completed', { startedAt: i, endedAt: i + 1, description: `m${i}` }))
  const ledger = [task('T1', 'queued'), task('T2', 'queued')]
  const tree = sessionTree({ rows, runs: [], tones: { [ORCH]: 1 }, tasks: [], ledger })
  const { shown, lines } = trimTree(tree, 10, 0)
  // Two heads at 2 lines and two ledger tasks at 2 (a queued task has a caption): 8 fixed, 2 left: one member and its "+N more".
  expect(shown.get(ORCH)?.members.map(m => m.key)).toEqual(['task-T1', 'task-T2'])
  expect(shown.get('main')).toEqual({ members: [expect.objectContaining({ key: 'm5' })], hidden: 5 })
  expect(lines).toBe(10)
  // A budget below the fixed lines still draws every head and task.
  expect(trimTree(tree, 0, 0).shown.get('main')?.hidden).toBe(6)
  expect(trimTree(tree, 0, 0).shown.get(ORCH)?.members.length).toBe(2)
})

test('the budget is shared: a long session does not starve a run\'s running member, and "+N more" is paid for', () => {
  const rows = [
    ...Array.from({ length: 8 }, (_, i) => row(`m${i}`, 'completed', { startedAt: i, endedAt: i + 1, description: `m${i}` })),
    row('f1', 'running', { startedAt: 20, runId: 'wf_1', description: 'f1' }),
  ]
  const runs = [{ id: 'wf_1', name: 'review', startedAt: 20 }]
  const tree = sessionTree({ rows, runs, tones: {}, tasks: [], ledger: [] })
  // Two heads: 4 lines fixed; 6 left. The running member comes first, then ended ones, one line each.
  const { shown, lines } = trimTree(tree, 10, 0)
  expect(shown.get(runKey('wf_1'))?.members.map(m => m.key)).toEqual(['f1'])
  expect(shown.get(runKey('wf_1'))?.hidden).toBe(0)
  // 6 left, 1 for the running member, 1 held for "+N more": 4 ended members drawn, 4 hidden.
  expect(shown.get('main')?.members.length).toBe(4)
  expect(shown.get('main')?.hidden).toBe(4)
  expect(lines).toBe(10)
})

test('ledger tasks interleaved with agent members are all kept, and the other members fill what is left', () => {
  const rows = [row('r1', 'running', { startedAt: 1, spawnedBy: 'task-orchestrator' }), row('e1', 'completed', { startedAt: 1, endedAt: 2, spawnedBy: 'task-orchestrator' })]
  const ledger = [task('T1', 'queued'), task('T2', 'queued')]
  const tree = sessionTree({ rows, runs: [], tones: { [ORCH]: 1 }, tasks: [], ledger })
  const orch = tree.find(node => node.kind === 'orch')!
  expect(orch.running.map(m => m.taskId)).toEqual(['T1', 'T2', undefined])
  const roomy = trimTree(tree, 20, 0).shown.get(ORCH)!
  expect(roomy.members.map(m => m.key)).toEqual(['task-T1', 'task-T2', 'r1', 'e1'])
  const tight = trimTree(tree, 0, 0).shown.get(ORCH)!
  expect(tight.members.map(m => m.key)).toEqual(['task-T1', 'task-T2'])
  expect(tight.hidden).toBe(2)
})

test('a head is charged a caption line only when it draws one', () => {
  const tree = sessionTree({ rows: [row('p', 'running', { calls: 3, type: 'general-purpose' })], runs: [], tones: {}, tasks: [], ledger: [] })
  const lines = trimTree(tree, 99, 0).lines
  // The main head (2) and the member (1 + its caption line): the member is the only row.
  expect(lines).toBe(2 + 2)
  expect(headCaption(tree[0]!, 0)).toBe('')
})
