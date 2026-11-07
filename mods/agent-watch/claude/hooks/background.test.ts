import { expect, test } from 'claude-code/testing'

import type { AgentRow, BackgroundTask } from '../types'
import {
  agentKey,
  backgroundAdded,
  backgroundEnded,
  backgroundLinked,
  backgroundOwnerEnded,
  backgroundReconciled,
  backgroundStarted,
  backgroundStepped,
  memberCaption,
  monitorEventsOf,
  notificationOf,
  stepOf,
  sessionTree,
} from './model'
import { arcs, chartAgents, chartBackground, chartFailed, chartRunning } from './sunburst'

// Background shells and monitors (ADR-0049): opened from the tool's result,
// ended by a notification, a stop, the owner's end or the in-flight list.

const shell = (id: string, more: Partial<BackgroundTask> = {}): BackgroundTask => ({
  id,
  kind: 'shell',
  description: `Run ${id}`,
  command: `python3 ${id}.py`,
  status: 'running',
  startedAt: 1_000,
  ...more,
})

const agent = (id: string, more: Partial<AgentRow> = {}): AgentRow => ({ id, type: 'Explore', description: id, status: 'running', startedAt: 0, calls: 0, tokens: 0, ...more })

test('a Bash or Monitor result that names a task opens it; a foreground call opens none', () => {
  const bash = backgroundStarted('Bash', { command: 'python3  driver.py\n --run', description: 'Run the driver', run_in_background: true }, { backgroundTaskId: 'b1' }, undefined, 5_000)
  expect(bash).toEqual({ id: 'b1', kind: 'shell', description: 'Run the driver', command: 'python3 driver.py --run', ownerId: undefined, status: 'running', startedAt: 5_000 })
  // No description: the command, cut short, is the name.
  expect(backgroundStarted('Bash', { command: 'sleep 60' }, { backgroundTaskId: 'b2' }, 'a1', 0)?.description).toBe('sleep 60')
  // Moved to the background at its timeout: it started that long ago.
  expect(backgroundStarted('Bash', { command: 'make' }, { backgroundTaskId: 'b3', timedOutAfterMs: 120_000 }, undefined, 200_000)?.startedAt).toBe(80_000)
  // A subagent's command that dies with its final answer says so.
  expect(backgroundStarted('Bash', { command: 'x' }, { backgroundTaskId: 'b4', backgroundEndsWithFinalResponse: true }, 'a1', 0)?.endsWithOwner).toBe(true)
  expect(backgroundStarted('Monitor', { description: 'Watch the log', command: 'tail -f log', timeout_ms: 1 }, { taskId: 'm1', timeoutMs: 1 }, undefined, 0)).toMatchObject({ id: 'm1', kind: 'monitor', description: 'Watch the log' })
  expect(backgroundStarted('Bash', { command: 'ls' }, { stdout: '', stderr: '', interrupted: false }, undefined, 0)).toBeUndefined()
  expect(backgroundStarted('Read', { file_path: 'x' }, { backgroundTaskId: 'b5' }, undefined, 0)).toBeUndefined()
})

test('a PowerShell call moved to the background at its timeout opens a running shell, ended by its notification', () => {
  // The result a live PowerShell call gave when its 600 s timeout passed.
  const ps = backgroundStarted('PowerShell', { command: 'wsl -d AlmaLinux-10  bash -lc ./gates.sh', description: 'Run the gates', timeout: 600_000 }, { stdout: '', stderr: '', interrupted: false, backgroundTaskId: 'b0xa8rys0', timedOutAfterMs: 600_000 }, undefined, 700_000)
  expect(ps).toEqual({ id: 'b0xa8rys0', kind: 'shell', description: 'Run the gates', command: 'wsl -d AlmaLinux-10 bash -lc ./gates.sh', ownerId: undefined, status: 'running', startedAt: 100_000 })
  expect(backgroundStarted('PowerShell', { command: 'Start-Sleep 60' }, { backgroundTaskId: 'b6' }, 'a1', 0)?.description).toBe('Start-Sleep 60')
  expect(backgroundStarted('PowerShell', { command: 'x' }, { backgroundTaskId: 'b8', backgroundEndsWithFinalResponse: true }, 'a1', 0)?.endsWithOwner).toBe(true)
  expect(backgroundStarted('PowerShell', { command: 'Get-ChildItem' }, { stdout: '', stderr: '', interrupted: false }, undefined, 0)).toBeUndefined()
  const said = notificationOf('<task-notification>\n<task-id>b0xa8rys0</task-id>\n<status>completed</status>\n<summary>Background command "Run the gates" completed (exit code 0)</summary>\n</task-notification>')!
  const ended = backgroundEnded([ps!], said.id, said.word, said.exitCode, 900_000)
  expect(ended[0]).toMatchObject({ id: 'b0xa8rys0', status: 'completed', exitCode: 0, endedAt: 900_000 })
})

test('a notification names its task, its status and the exit code its summary gives', () => {
  const text = [
    '<task-notification>',
    '<task-id>b1</task-id>',
    '<tool-use-id>toolu_1</tool-use-id>',
    '<status>failed</status>',
    '<summary>Background command "Run the driver" failed with exit code 2</summary>',
    '</task-notification>',
  ].join('\n')
  expect(notificationOf(text)).toEqual({ id: 'b1', word: 'failed', exitCode: 2 })
  expect(notificationOf('<task-id>b2</task-id><status>completed</status><summary>done (exit code 0)</summary>')).toEqual({ id: 'b2', word: 'completed', exitCode: 0 })
  expect(notificationOf('<task-id>b3</task-id><status>killed</status>')).toEqual({ id: 'b3', word: 'killed', exitCode: undefined })
  expect(notificationOf('a prompt with no task')).toBeUndefined()
})

test('a task ends with its word, a non-zero exit fails it, and its first end time stays', () => {
  const list = [shell('b1'), shell('b2'), shell('b3'), shell('b4')]
  const ended = backgroundEnded(backgroundEnded(backgroundEnded(list, 'b1', 'completed', 0, 9_000), 'b2', 'completed', 3, 9_000), 'b3', 'killed', undefined, 9_000)
  expect(ended.map(one => one.status)).toEqual(['completed', 'failed', 'killed', 'running'])
  expect(ended[1]!.exitCode).toBe(3)
  // The in-flight list ended b4 first; its notification, later, gives the real word and keeps the first end.
  const reconciled = backgroundReconciled(ended, [], 10_000)
  expect(reconciled[3]).toMatchObject({ status: 'completed', endedAt: 10_000 })
  expect(backgroundEnded(reconciled, 'b4', 'failed', 1, 12_000)[3]).toMatchObject({ status: 'failed', exitCode: 1, endedAt: 10_000 })
  // An unknown id changes nothing.
  expect(backgroundEnded(list, 'nope', 'failed', 1, 0)).toEqual(list)
})

test('the in-flight list adds an untracked shell or monitor, never a subagent or workflow, and ends what it no longer names', () => {
  const list = [shell('b1'), shell('b2', { status: 'failed', endedAt: 2_000 })]
  const next = backgroundReconciled(
    list,
    [
      { id: 'b3', type: 'shell', description: 'Build', command: 'make' },
      { id: 'm1', type: 'monitor', description: 'Watch' },
      { id: 'a9', type: 'subagent', description: 'Explore' },
      { id: 'w1', type: 'workflow', description: 'review' },
    ],
    7_000,
  )
  expect(next.map(one => [one.id, one.status])).toEqual([['b1', 'completed'], ['b2', 'failed'], ['b3', 'running'], ['m1', 'running']])
  expect(next[2]).toMatchObject({ kind: 'shell', description: 'Build', startedAt: 7_000 })
  // A task the list names stays running; one already known is not added twice.
  expect(backgroundReconciled([shell('b1')], [{ id: 'b1', type: 'shell' }], 7_000)).toEqual([shell('b1')])
  // A task the tool result opens after the list did keeps the earlier start.
  expect(backgroundAdded([shell('b1', { startedAt: 500 })], shell('b1', { startedAt: 900 }))[0]!.startedAt).toBe(500)
})

test("a subagent's end stops only its own commands that die with it", () => {
  const list = [shell('b1', { ownerId: 'a1', endsWithOwner: true }), shell('b2', { ownerId: 'a1' }), shell('b3', { ownerId: 'a2', endsWithOwner: true })]
  expect(backgroundOwnerEnded(list, 'a1', 4_000).map(one => one.status)).toEqual(['killed', 'running', 'running'])
})

test('a background task is a member of the session owning its loop, coded B01, never counted as an agent', () => {
  const rows = [agent('a1'), agent('a2', { parentId: 'a1' })]
  const tones = { [agentKey('a1')]: 1 }
  const background = [
    shell('b1'),
    shell('b2', { status: 'failed', exitCode: 2, endedAt: 3_000 }),
    shell('b3', { ownerId: 'a1', startedAt: 2_000 }),
    shell('b4', { ownerId: 'a2', startedAt: 2_500 }),
  ]
  const tree = sessionTree({ rows, runs: [], tones, tasks: [], ledger: [], background })
  const main = tree[0]!
  const sub = tree.find(node => node.key === agentKey('a1'))!
  expect([...main.running, ...main.completed].map(member => member.key)).toEqual(['bg-b1', 'bg-b2'])
  // a2 is a1's member, so a2's command sits in a1's session too.
  expect([...sub.running, ...sub.completed].map(member => member.key).sort()).toEqual(['a2', 'bg-b3', 'bg-b4'])
  // This session runs while its background task does; its AGENTS count leaves the tasks out.
  expect(main.status).toBe('running')
  expect(main.progress).toEqual({ done: 0, total: 0, unit: 'AGENTS' })
  expect(sub.progress).toEqual({ done: 0, total: 1, unit: 'AGENTS' })

  const failed = main.completed.find(member => member.key === 'bg-b2')!
  expect(failed.label).toBe('shell · Run b2')
  expect(failed.badge?.word).toBe('FAILED')
  expect(memberCaption(failed, 5_000)).toBe('$ python3 b2.py · EXIT 2')

  const list = arcs(tree, { now: 5_000 })
  const code = (key: string) => list.find(arc => arc.key === key)?.code
  expect([code('bg-b1'), code('bg-b2'), code('a2'), code('bg-b3'), code('bg-b4')]).toEqual(['B01', 'B02', 'A01', 'B01', 'B02'])
  expect(list.find(arc => arc.key === 'bg-b1')?.duration).toBe(4_000)
  expect(chartAgents(list)).toBe(2)
  // Running members only, as before: a2; a1 is a session arc.
  expect(chartRunning(list)).toBe(1)
  expect(chartBackground(list)).toEqual({ total: 4, running: 3 })
  expect(chartFailed(list)).toBe(1)
})

test('past the member cap, a "+N" arc keeps background tasks out of the agent counts', () => {
  const background = Array.from({ length: 200 }, (_, i) => shell(`b${i}`, { startedAt: i }))
  const list = arcs(sessionTree({ rows: [agent('a1')], runs: [], tones: {}, tasks: [], ledger: [], background }))
  expect(chartAgents(list)).toBe(1)
  expect(chartRunning(list)).toBe(1)
  expect(chartBackground(list)).toEqual({ total: 200, running: 200 })
})

// ---- Step progress of a background run ------------------------------------

/** A Monitor's event notification as it arrived live (2.1.318): no <status>, the line in <event>. */
const event = (id: string, ...lines: string[]) =>
  `<task-notification>\n<task-id>${id}</task-id>\n<summary>Monitor event: "gate steps"</summary>\n<event>${lines.join('\n')}</event>\nIf this event is something the user would act on now, send a PushNotification.\n</task-notification>`

test('a step line is step n/m, an optional label, and ok or FAIL', () => {
  expect(stepOf('step 3/7 mypy ok')).toEqual({ n: 3, m: 7, label: 'mypy', isOk: true })
  expect(stepOf('  step 4/7 pytest unit FAIL ')).toEqual({ n: 4, m: 7, label: 'pytest unit', isOk: false })
  expect(stepOf('STEP 1 / 2 lint OK')).toEqual({ n: 1, m: 2, label: 'lint', isOk: true })
  // No label: the outcome alone.
  expect(stepOf('step 2/3 ok')).toEqual({ n: 2, m: 3, label: '', isOk: true })
})

test('a malformed step line, or one whose n is out of range, is no step', () => {
  for (const line of ['step 3 of 7 mypy ok', 'step 3/7 mypy', 'step 3/7 mypy passed', 'Step: 3/7 ok', 'mypy ok', 'step /7 ok', 'step 3/ ok', 'step x/7 ok', ''])
    expect(stepOf(line)).toBeUndefined()
  // n greater than m, zero, or an absurd total.
  expect(stepOf('step 8/7 extra ok')).toBeUndefined()
  expect(stepOf('step 0/7 setup ok')).toBeUndefined()
  expect(stepOf('step 1/0 ok')).toBeUndefined()
  expect(stepOf('step 1/5000 ok')).toBeUndefined()
})

test("a monitor's event is not an end; its lines are read, batched ones split", () => {
  expect(notificationOf(event('m1', 'step 1/3 lint ok'))).toBeUndefined()
  expect(monitorEventsOf(event('m1', 'step 1/3 lint ok', 'step 2/3 types FAIL'))).toEqual({ id: 'm1', lines: ['step 1/3 lint ok', 'step 2/3 types FAIL'] })
  // An end notice is no event.
  expect(monitorEventsOf('<task-id>m1</task-id><status>completed</status><summary>done</summary>')).toBeUndefined()
  expect(monitorEventsOf('a prompt with no task')).toBeUndefined()
  // The engine's expiry line, as it arrived live, is an end: the watch was killed at its deadline.
  const expired = event('m1', '[Monitor expired after 3m with 3 events delivered. Re-arm it if you still need the watch.]')
  expect(monitorEventsOf(expired)).toBeUndefined()
  expect(notificationOf(expired)).toEqual({ id: 'm1', word: 'killed', exitCode: undefined })
})

test("a monitor naming a running shell's id is tied to it, and its steps fill that shell; untied, the monitor is the run", () => {
  const output = 'C:\\Temp\\claude\\tasks\\bgates01.output'
  const monitor = (more: Partial<BackgroundTask> = {}): BackgroundTask => ({ id: 'm1', kind: 'monitor', description: 'gate steps', command: `tail -f ${output} | grep --line-buffered "^step "`, status: 'running', startedAt: 2_000, ...more })
  const list = [shell('bgates01'), shell('bgates0', { startedAt: 1_500 })]
  // The id must stand alone: bgates0 is a prefix of bgates01, not named.
  expect(backgroundLinked(list, monitor()).linkedTo).toBe('bgates01')
  expect(backgroundLinked([shell('bgates01', { status: 'completed' })], monitor()).linkedTo).toBeUndefined()
  expect(backgroundLinked(list, monitor({ command: 'tail -f other.log' })).linkedTo).toBeUndefined()
  expect(backgroundLinked(list, shell('b9', { command: 'echo bgates01' })).linkedTo).toBeUndefined()

  const tied = [...list, monitor({ linkedTo: 'bgates01' })]
  const one = backgroundStepped(tied, 'm1', ['step 1/3 lint ok', 'noise', 'step 2/3 typecheck FAIL'])
  expect(one[0]!.steps).toEqual({ done: 2, total: 3, failed: 'typecheck', last: 'typecheck' })
  expect(one[2]!.steps).toBeUndefined()
  // A later ok keeps the first failure; done never goes back; a line that is not a step changes nothing.
  const two = backgroundStepped(backgroundStepped(one, 'm1', ['step 3/3 tests ok']), 'm1', ['step 1/3 lint ok', 'Traceback'])
  expect(two[0]!.steps).toEqual({ done: 3, total: 3, failed: 'typecheck', last: 'lint' })
  expect(backgroundStepped(tied, 'm1', ['nothing here'])).toEqual(tied)
  expect(backgroundStepped(tied, 'nope', ['step 1/3 ok'])).toEqual(tied)
  // Untied: the monitor carries its own steps.
  expect(backgroundStepped([monitor()], 'm1', ['step 1/2 build ok'])[0]!.steps).toEqual({ done: 1, total: 2, last: 'build' })
})

test('a run with steps shows n/m and its first failure, failed from that step on; its tied monitor is no row', () => {
  const background: BackgroundTask[] = [
    shell('b1', { description: 'Run the gates', command: './gates.sh', steps: { done: 2, total: 7, failed: 'pytest', last: 'pytest' } }),
    { id: 'm1', kind: 'monitor', description: 'gate steps', command: 'tail -f b1.output', status: 'running', startedAt: 1_100, linkedTo: 'b1' },
    shell('b2', { steps: { done: 3, total: 7, last: 'mypy' } }),
  ]
  const tree = sessionTree({ rows: [], runs: [], tones: {}, tasks: [], ledger: [], background })
  const members = [...tree[0]!.running, ...tree[0]!.completed]
  expect(members.map(member => member.key)).toEqual(['bg-b2', 'bg-b1'])
  const gates = members.find(member => member.key === 'bg-b1')!
  expect(gates.isActive).toBe(true)
  expect(gates.badge?.word).toBe('FAILED')
  expect(memberCaption(gates, 5_000)).toBe('$ ./gates.sh · 2/7 STEPS · FAIL pytest')
  expect(memberCaption(members.find(member => member.key === 'bg-b2')!, 5_000)).toBe('$ python3 b2.py · 3/7 STEPS · mypy')
  const list = arcs(tree, { now: 5_000 })
  expect(list.find(arc => arc.key === 'bg-b1')?.progress).toEqual({ done: 2, total: 7 })
  expect(list.find(arc => arc.key === 'bg-b2')?.progress).toEqual({ done: 3, total: 7 })
  expect(chartBackground(list)).toEqual({ total: 2, running: 2 })
  // A tied monitor whose shell is gone is drawn as itself.
  const alone = sessionTree({ rows: [], runs: [], tones: {}, tasks: [], ledger: [], background: [background[1]!] })
  expect(alone[0]!.running.map(member => member.key)).toEqual(['bg-m1'])
})
