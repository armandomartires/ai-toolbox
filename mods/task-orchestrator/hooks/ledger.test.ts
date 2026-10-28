import { expect, test } from 'claude-code/testing'

import { addTask, blockers, isNoVerdict, mayEscalate, mayRetry, overall, overlap, retryTask, runnable, setTask, stalledBy, startBlocker, writeBlocker } from './ledger'
import type { Ledger, Task } from './ledger'
import { DEFAULT_LIMITS } from './routing'

const task = (id: string, patch: Partial<Task> = {}): Task => ({
  id,
  taskClass: 'lookup',
  role: 'scout',
  objective: 'look',
  description: `${id} scout`,
  deps: [],
  allowedFiles: [],
  isWriter: false,
  isolated: false,
  status: 'queued',
  requested: { model: 'haiku', effort: 'low' },
  retries: 0,
  escalations: 0,
  createdAt: 0,
  notes: [],
  prompt: '',
  ...patch,
})

const running = (id: string, patch: Partial<Task> = {}) => task(id, { status: 'running', agentId: `a-${id}`, ...patch })

test('at most three workers run; the fourth waits and starts once one ends', () => {
  const ledger: Ledger = [running('T1'), running('T2'), running('T3'), task('T4')]
  expect(startBlocker(ledger, ledger[3]!, DEFAULT_LIMITS)).toBe('3 workers already running')
  expect(runnable(ledger, DEFAULT_LIMITS)).toEqual([])
  const after = setTask(ledger, 'T1', { status: 'completed' })
  expect(runnable(after, DEFAULT_LIMITS).map(one => one.id)).toEqual(['T4'])
  // runnable hands out only as many as the free slots.
  const many = [running('T1'), running('T2'), task('T3'), task('T4')]
  expect(runnable(many, DEFAULT_LIMITS).map(one => one.id)).toEqual(['T3'])
})

test('dependencies serialize work and a failed dependency blocks its dependants', () => {
  const ledger: Ledger = [running('build', { role: 'builder', isWriter: true }), task('review', { deps: ['build'], role: 'reviewer' })]
  expect(startBlocker(ledger, ledger[1]!, DEFAULT_LIMITS)).toBe('waiting on build')
  const failed = setTask(ledger, 'build', { status: 'failed' })
  expect(startBlocker(failed, failed[1]!, DEFAULT_LIMITS)).toBe('dependency build (failed) did not complete')
  expect(addTask(ledger, task('x', { deps: ['nope'] })).refused).toContain('unknown task(s) nope')
  expect(addTask(ledger, task('build')).refused).toBe('task build already exists')
})

test('two writers never share a checkout, and isolated writers never share files', () => {
  const builder = running('B1', { role: 'builder', isWriter: true, allowedFiles: ['src/a.ts'] })
  const second = task('B2', { role: 'builder', isWriter: true, allowedFiles: ['src/b.ts'] })
  expect(startBlocker([builder, second], second, DEFAULT_LIMITS)).toContain('one writer at a time without isolation')
  const isolatedA = running('B1', { role: 'builder', isWriter: true, isolated: true, allowedFiles: ['src/a.ts', 'docs/'] })
  const isolatedB = task('B2', { role: 'builder', isWriter: true, isolated: true, allowedFiles: ['src/b.ts'] })
  expect(startBlocker([isolatedA, isolatedB], isolatedB, DEFAULT_LIMITS)).toBeUndefined()
  const overlapping = task('B3', { role: 'builder', isWriter: true, isolated: true, allowedFiles: ['docs/guide.md'] })
  expect(startBlocker([isolatedA, overlapping], overlapping, DEFAULT_LIMITS)).toBe('files overlap with writer B1: docs/guide.md ~ docs')
  expect(overlap([], ['x'])).toEqual(['*'])
  expect(overlap(['a/b/'], ['./a/b'])).toEqual(['a/b'])
  // A reader beside a writer is fine.
  expect(startBlocker([builder, task('S1')], task('S1'), DEFAULT_LIMITS)).toBeUndefined()
})

test('a worker writes only inside its allowed files, never a read-only one, never another writer\'s', () => {
  const builder = running('B1', { role: 'builder', isWriter: true, allowedFiles: ['src/a.ts', 'docs'] })
  const ledger: Ledger = [builder, running('S1')]
  expect(writeBlocker(ledger, builder, '/p/src/a.ts', '/p')).toBeUndefined()
  expect(writeBlocker(ledger, builder, '/p/docs/x.md', '/p')).toBeUndefined()
  expect(writeBlocker(ledger, builder, 'src/b.ts', '/p')).toContain('outside its allowed files')
  expect(writeBlocker(ledger, builder, undefined, '/p')).toContain('no path')
  expect(writeBlocker(ledger, ledger[1]!, 'src/a.ts', '/p')).toContain('read-only')
  const other = running('B2', { role: 'builder', isWriter: true, isolated: true, allowedFiles: ['src/b.ts'] })
  const mine = running('B3', { role: 'builder', isWriter: true, allowedFiles: [] })
  expect(writeBlocker([other, mine], mine, 'src/b.ts', '/p')).toBe('B3 may not write src/b.ts: writer B2 owns it')
  expect(writeBlocker([other, mine], mine, 'src/c.ts', '/p')).toBeUndefined()
})

test('retries and escalations stop at their limits, and the run is done only when nothing failed', () => {
  expect(mayRetry(task('T', { retries: 1 }), DEFAULT_LIMITS)).toBeUndefined()
  expect(mayRetry(task('T', { retries: 2 }), DEFAULT_LIMITS)).toContain('used its 2 retries')
  expect(mayEscalate(task('T', { escalations: 1 }), DEFAULT_LIMITS)).toContain('used its 1 escalation')
  expect(overall([]).word).toBe('idle')
  expect(overall([task('b', { status: 'completed' }), task('r', { status: 'failed', role: 'reviewer' })])).toEqual({ word: 'failed', why: 'r (reviewer) failed' })
  expect(overall([task('b', { status: 'completed' }), task('t', { status: 'partial', role: 'tester' })]).word).toBe('partial')
  expect(overall([task('b', { status: 'completed' }), task('r', { status: 'queued' })]).word).toBe('running')
  expect(overall([task('b', { status: 'completed' }), task('r', { status: 'completed' })]).word).toBe('done')
})

const NO_VERDICT = 'The server-side auto mode classifier gave no verdict for Agent: the request that produced this action did not ask for one. Issue the action again once, as-is; if it is denied again, continue with other tasks that don\'t require it and tell the user that auto mode could not evaluate it.'

test('auto mode\'s no-verdict deny is told from every other refusal', () => {
  expect(isNoVerdict(NO_VERDICT)).toBe(true)
  expect(isNoVerdict('model haiku is not available')).toBe(false)
  expect(isNoVerdict('3 workers are already running')).toBe(false)
})

test('a re-dispatch under the id of a task that ended without completing is its next retry, within the limit', () => {
  const ledger: Ledger = [task('T1', { status: 'blocked', reason: 'spawn refused', handoff: true, createdAt: 5 }), task('T2', { deps: ['T1'] })]
  const again = retryTask(ledger, task('T1', { objective: 'look harder', createdAt: 9 }), DEFAULT_LIMITS)
  expect(again.refused).toBeUndefined()
  const row = again.ledger[0]!
  expect(row).toMatchObject({ id: 'T1', status: 'queued', retries: 1, objective: 'look harder', createdAt: 5 })
  expect(row.handoff).toBeUndefined()
  expect(row.reason).toBeUndefined()
  expect(row.notes).toContain('retry 1 of 2 after blocked')
  // Its dependant keeps waiting on it, in the same place.
  expect(again.ledger.map(one => one.id)).toEqual(['T1', 'T2'])
  expect(runnable(again.ledger, DEFAULT_LIMITS).map(one => one.id)).toEqual(['T1'])
  for (const status of ['failed', 'partial'] as const) expect(retryTask([task('T1', { status })], task('T1'), DEFAULT_LIMITS).refused).toBeUndefined()
  for (const status of ['completed', 'cancelled', 'queued', 'running'] as const)
    expect(retryTask([task('T1', { status })], task('T1'), DEFAULT_LIMITS).refused).toBe(`task T1 already exists and is ${status}; only a blocked, failed, partial task is retried under its id`)
  expect(retryTask([task('T1', { status: 'failed', retries: 2 })], task('T1'), DEFAULT_LIMITS).refused).toContain('used its 2 retries')
  // A retry may not wait on itself or on a task that waits on it.
  expect(retryTask(ledger, task('T1', { deps: ['T2'] }), DEFAULT_LIMITS).refused).toBe('task T1 may not depend on T2: it waits on T1')
  expect(retryTask(ledger, task('T1', { deps: ['T1'] }), DEFAULT_LIMITS).refused).toContain('may not depend on T1')
  // A new id is an ordinary add.
  expect(retryTask(ledger, task('T3'), DEFAULT_LIMITS).ledger.map(one => one.id)).toEqual(['T1', 'T2', 'T3'])
})

test('a dependant stuck behind a task that ended without completing says so, through every level', () => {
  const ledger: Ledger = [task('T1', { status: 'blocked' }), task('T2', { deps: ['T1'] }), task('T3', { deps: ['T2'] }), running('T4'), task('T5', { deps: ['T4'] })]
  expect(stalledBy(ledger, ledger[1]!)?.id).toBe('T1')
  expect(stalledBy(ledger, ledger[2]!)?.id).toBe('T1')
  expect(stalledBy(ledger, ledger[4]!)).toBeUndefined()
  expect(stalledBy(setTask(ledger, 'T1', { status: 'completed' }), ledger[1]!)).toBeUndefined()
  expect(blockers(ledger, DEFAULT_LIMITS)).toEqual([
    'T2: waits on T1 (blocked): dispatch T1 again under its id to retry it, or cancel T2',
    'T3: waits on T1 (blocked): dispatch T1 again under its id to retry it, or cancel T3',
    'T5: waiting on T4',
  ])
})
