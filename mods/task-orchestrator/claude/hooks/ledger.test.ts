import { expect, test } from 'claude-code/testing'

import { TURN_CAP_NOTE, activeWriters, addTask, admit, blockerFor, blockers, statusSummary, escalationOf, handoffRoot, isNoVerdict, mayEscalate, mayRetry, overall, overlap, retryTask, runnable, setTask, stalledBy, startBlocker, stallText, writeBlocker } from './ledger'
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

test('a queued session task reserves no slot when sessions may not be handed off', () => {
  const ledger: Ledger = [running('T1'), running('T2'), task('S1', { runAs: 'session' }), task('T4')]
  expect(runnable(ledger, DEFAULT_LIMITS).map(one => one.id)).toEqual(['S1'])
  expect(runnable(ledger, DEFAULT_LIMITS, false).map(one => one.id)).toEqual(['T4'])
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

test('a cancelled task neither fails nor blocks the run', () => {
  expect(overall([task('b', { status: 'completed' }), task('c', { status: 'cancelled' })]).word).toBe('done')
  expect(overall([task('c', { status: 'cancelled' })]).word).toBe('idle')
  expect(overall([task('b', { status: 'completed' }), task('c', { status: 'cancelled' }), task('f', { status: 'failed' })]).word).toBe('failed')
  expect(overall([task('c', { status: 'cancelled' }), task('q', { status: 'queued' })]).word).toBe('running')
  expect(overall([task('c', { status: 'cancelled' }), task('p', { status: 'partial' })]).word).toBe('partial')
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
    'T2: waits on T1 (blocked): dispatch T1 again under its id to retry it (retry 1 of 2), or cancel T2',
    'T3: waits on T1 (blocked): dispatch T1 again under its id to retry it (retry 1 of 2), or cancel T3',
    'T5: waiting on T4',
  ])
})

test('a session writer has no write fence and no one-writer rule: two share a checkout, and a subagent writer is not held by them', () => {
  const session = (id: string, patch: Partial<Task> = {}) => task(id, { role: 'builder', isWriter: true, runAs: 'session', status: 'running', ...patch })
  const ledger: Ledger = [session('S1'), session('S2')]
  expect(activeWriters(ledger)).toEqual([])
  // A third session writer, and a subagent writer, start beside them; the cap still counts them.
  expect(startBlocker(ledger, session('S3', { status: 'queued' }), DEFAULT_LIMITS)).toBeUndefined()
  expect(startBlocker(ledger, task('B1', { role: 'builder', isWriter: true, status: 'queued' }), DEFAULT_LIMITS)).toBeUndefined()
  expect(startBlocker([...ledger, session('S3')], session('S4', { status: 'queued' }), DEFAULT_LIMITS)).toBe('3 workers already running')
  // A subagent writer's own writes are not blocked by a session's claim on the checkout.
  expect(writeBlocker([...ledger, task('B1', { role: 'builder', isWriter: true, status: 'running' })], task('B1', { role: 'builder', isWriter: true, status: 'running' }), '/p/a.ts', '/p')).toBeUndefined()
})

test('a queued task behind a session task handed off is waiting on its start_session call, not stalled and not failed-behind', () => {
  const handed = task('T1', { runAs: 'session', role: 'reviewer', status: 'blocked', handoff: true })
  const behind = task('D1', { deps: ['T1'] })
  const ledger: Ledger = [handed, behind]
  expect(stalledBy(ledger, behind)).toBeUndefined()
  expect(handoffRoot(ledger, behind)?.id).toBe('T1')
  expect(startBlocker(ledger, behind, DEFAULT_LIMITS)).toBe('waiting on T1 (handed off, awaiting start_session)')
  expect(blockers(ledger, DEFAULT_LIMITS)).toEqual(['D1: waits on T1 (handed off): its start_session call is not made yet; make the call its hand-off names, or cancel D1'])
  // Through a second dependant too.
  const deeper = task('D2', { deps: ['D1'] })
  expect(handoffRoot([...ledger, deeper], deeper)?.id).toBe('T1')
  // A subagent hand-off waits for the coordinator's Agent call the same way (TASK-0239); a session that failed stays a stall to retry.
  const subHanded: Ledger = [task('H1', { status: 'blocked', handoff: true }), task('D3', { deps: ['H1'] })]
  expect(stalledBy(subHanded, subHanded[1]!)).toBeUndefined()
  expect(handoffRoot(subHanded, subHanded[1]!)?.id).toBe('H1')
  expect(startBlocker(subHanded, subHanded[1]!, DEFAULT_LIMITS)).toBe('waiting on H1 (handed off, awaiting the Agent call)')
  expect(blockers(subHanded, DEFAULT_LIMITS)).toEqual(['D3: waits on H1 (handed off): its Agent call is not made yet; make the call its hand-off names, or cancel D3'])
  expect(stalledBy([task('T2', { runAs: 'session', status: 'failed' }), task('D4', { deps: ['T2'] })], task('D4', { deps: ['T2'] }))?.id).toBe('T2')
})

test('a hand-off of either kind holds its slot and the writer lock, and the run is running, not blocked (TASK-0239)', () => {
  const handed = [task('H1', { status: 'blocked', handoff: true }), task('H2', { status: 'blocked', handoff: true }), task('H3', { runAs: 'session', status: 'blocked', handoff: true })]
  expect(startBlocker(handed, task('T4'), DEFAULT_LIMITS)).toBe('3 workers already running')
  expect(overall(handed)).toEqual({ word: 'running', why: 'H1 handed off, H2 handed off, H3 handed off' })
  const writer = [task('W1', { role: 'builder', isWriter: true, status: 'blocked', handoff: true })]
  expect(startBlocker(writer, task('W2', { role: 'builder', isWriter: true }), DEFAULT_LIMITS)).toBe('writer W1 is running in the same checkout; one writer at a time without isolation')
  // Adopting the hand-off itself is not blocked by its own row.
  expect(startBlocker(writer, { ...writer[0]!, status: 'queued' }, DEFAULT_LIMITS)).toBeUndefined()
})

test('a retry on a bigger model or effort is an escalation, refused past its limit (TASK-0224)', () => {
  const failed = task('T1', { status: 'failed', requested: { model: 'haiku', effort: 'low' } })
  const same = retryTask([failed], task('T1', { requested: { model: 'haiku', effort: 'low' } }), DEFAULT_LIMITS)
  expect(same.ledger[0]?.escalations).toBe(0)
  const up = retryTask([failed], task('T1', { requested: { model: 'sonnet', effort: 'low' } }), DEFAULT_LIMITS)
  expect(up.ledger[0]?.escalations).toBe(1)
  expect(up.ledger[0]?.notes.join(' ')).toContain('escalation 1 of 1: model haiku → sonnet')
  const spent = { ...up.ledger[0]!, status: 'failed' as const }
  const again = retryTask([spent], task('T1', { requested: { model: 'sonnet', effort: 'high' } }), DEFAULT_LIMITS)
  expect(again.refused).toContain('used its 1 escalation(s)')
  expect(again.refused).toContain('effort low → high')
  expect(retryTask([spent], task('T1', { requested: { model: 'sonnet', effort: 'low' } }), DEFAULT_LIMITS).refused).toBeUndefined()
})

test('a dependant of a cancelled task makes the run blocked, naming it; an all-cancelled ledger is idle', () => {
  const stalled: Ledger = [task('T1', { status: 'cancelled' }), task('D1', { deps: ['T1'] })]
  const word = overall(stalled)
  expect(word.word).toBe('blocked')
  expect(word.why).toContain('T1')
  expect(word.why).toContain('D1')
  expect(overall([task('T1', { status: 'cancelled' }), task('T2', { status: 'cancelled' })]).word).toBe('idle')
  // A cancelled task beside a completed one is still a finished run.
  expect(overall([task('T1', { status: 'cancelled' }), task('T2', { status: 'completed' })]).word).toBe('done')
  // Its dependant waiting on a running task is running, not blocked.
  expect(overall([running('T1'), task('D1', { deps: ['T1'] })]).word).toBe('running')
})

const builderOf = (allowedFiles: string[], patch: Partial<Task> = {}) => running('B1', { role: 'builder', isWriter: true, allowedFiles, ...patch })

test('the write fence resolves .. and refuses a path that climbs out of an allowed directory', () => {
  const builder = builderOf(['src'])
  expect(writeBlocker([builder], builder, 'src/../secret.txt', '/p')).toContain('B1 may not write secret.txt')
  expect(writeBlocker([builder], builder, '/p/src/../secret.txt', '/p')).toContain('outside its allowed files')
  expect(writeBlocker([builder], builder, 'src/./a/../b.ts', '/p')).toBeUndefined()
})

test('the write fence refuses an absolute path outside the checkout, with an empty list and with a list', () => {
  const open = builderOf([])
  const listed = builderOf(['src'])
  expect(writeBlocker([open], open, '/etc/passwd', '/p')).toContain('outside the checkout')
  expect(writeBlocker([listed], listed, '/etc/passwd', '/p')).toContain('outside the checkout')
  expect(writeBlocker([open], open, '../x.txt', '/p')).toContain('outside the checkout')
  expect(writeBlocker([open], open, '/p2/a.ts', '/p')).toContain('outside the checkout')
  expect(writeBlocker([open], open, '/p/any/where.ts', '/p')).toBeUndefined()
})

test('the write fence treats a drive letter case-insensitively and a backslash as a separator', () => {
  const builder = builderOf(['src'])
  expect(writeBlocker([builder], builder, 'c:/p/src/a.ts', 'C:\\p')).toBeUndefined()
  expect(writeBlocker([builder], builder, 'C:\\p\\src\\a.ts', 'C:\\p')).toBeUndefined()
  expect(writeBlocker([builder], builder, 'C:\\P\\SRC\\a.ts', 'c:/p')).toBeUndefined()
  expect(writeBlocker([builder], builder, 'src\\..\\x.ts', 'C:\\p')).toContain('outside its allowed files')
  expect(writeBlocker([builder], builder, 'D:\\p\\src\\a.ts', 'C:\\p')).toContain('outside the checkout')
  // Case-sensitive on a POSIX root.
  expect(writeBlocker([builder], builder, '/p/SRC/a.ts', '/p')).toContain('outside its allowed files')
})

test('the fence and overlap compare whole segments after normalising both sides', () => {
  const builder = builderOf(['src'])
  expect(writeBlocker([builder], builder, 'srcx/a.ts', '/p')).toContain('outside its allowed files')
  expect(writeBlocker([builder], builder, 'src', '/p')).toBeUndefined()
  expect(writeBlocker([builder], builder, 'src/a.ts', '/p')).toBeUndefined()
  expect(overlap(['./src'], ['src'])).toEqual(['src'])
  expect(overlap(['.'], ['src'])).toEqual(['. ~ src'])
  expect(overlap(['src'], ['srcx/a.ts'])).toEqual([])
  expect(overlap(['src/../docs'], ['docs'])).toEqual(['docs'])
})

test('a write with no path is still refused, and the other-writer rule uses the resolved target', () => {
  const builder = builderOf(['src'])
  expect(writeBlocker([builder], builder, '', '/p')).toContain('no path')
  const other = running('B2', { role: 'builder', isWriter: true, isolated: true, allowedFiles: ['src/b.ts'] })
  const mine = running('B3', { role: 'builder', isWriter: true, allowedFiles: [] })
  expect(writeBlocker([other, mine], mine, 'src/x/../b.ts', '/p')).toBe('B3 may not write src/b.ts: writer B2 owns it')
  expect(writeBlocker([other, mine], mine, '/p/./src/b.ts', '/p')).toBe('B3 may not write src/b.ts: writer B2 owns it')
  expect(writeBlocker([other, mine], mine, 'srcx/b.ts', '/p')).toBeUndefined()
})

test('escalationOf ranks by model family, so full ids count', () => {
  const at = (model: string, effort = 'medium') => ({ model, effort }) as Task['requested']
  expect(escalationOf(at('claude-haiku-5-5'), at('claude-sonnet-5-5'))).toBe('model claude-haiku-5-5 → claude-sonnet-5-5')
  expect(escalationOf(at('Haiku'), at('claude-opus-5'))).toContain('model')
  expect(escalationOf(at('claude-sonnet-5-5'), at('sonnet'))).toBeUndefined()
  expect(escalationOf(at('claude-opus-5'), at('claude-haiku-5-5'))).toBeUndefined()
  expect(escalationOf(at('mystery'), at('opus'))).toBeUndefined()
})

test('stall advice follows the root: cancelled, turn-capped, or retryable (TASK-0265)', () => {
  const dependant = task('T2', { deps: ['T1'] })
  expect(stallText(dependant, task('T1', { status: 'cancelled' }), DEFAULT_LIMITS)).toBe('waits on T1 (cancelled): T1 was cancelled: cancel T2, or dispatch a new task with the same dependencies')
  const capped = task('T1', { status: 'partial', agentId: 'a-1', notes: [TURN_CAP_NOTE] })
  expect(stallText(dependant, capped, DEFAULT_LIMITS)).toBe('waits on T1 (partial): resume T1 with SendMessage to its agent id a-1; a re-dispatch would start fresh and lose its edits')
  expect(stallText(dependant, task('T1', { status: 'failed', retries: 1 }), DEFAULT_LIMITS)).toBe('waits on T1 (failed): dispatch T1 again under its id to retry it (retry 2 of 2), or cancel T2')
  // A partial root with no turn-cap note is the plain retry.
  expect(stallText(dependant, task('T1', { status: 'partial' }), DEFAULT_LIMITS)).toContain('to retry it (retry 1 of 2)')
  // The ledger's blockers say the same.
  expect(blockers([task('T1', { status: 'cancelled' }), dependant], DEFAULT_LIMITS)).toEqual(['T2: waits on T1 (cancelled): T1 was cancelled: cancel T2, or dispatch a new task with the same dependencies'])
})

test('admit moves a row to running only over the limits and only from the status it expects (TASK-0265)', () => {
  const ledger: Ledger = [running('T1'), running('T2'), task('T3')]
  const admitted = admit(ledger, ledger[2]!, { startedAt: 5 }, 'queued', DEFAULT_LIMITS)
  expect(admitted.refused).toBeUndefined()
  expect(admitted.ledger.find(one => one.id === 'T3')).toMatchObject({ status: 'running', startedAt: 5 })
  // The cap.
  const full: Ledger = [running('T1'), running('T2'), running('T4'), task('T3')]
  expect(admit(full, full[3]!, {}, 'queued', DEFAULT_LIMITS).refused).toBe('3 workers already running')
  // The compare-and-set: a cancelled row is not reopened.
  const gone = setTask(ledger, 'T3', { status: 'cancelled' })
  expect(admit(gone, ledger[2]!, {}, 'queued', DEFAULT_LIMITS).refused).toContain('cancelled')
  expect(admit(ledger, task('nope'), {}, 'queued', DEFAULT_LIMITS).refused).toContain('nope')
  // A resumed turn-capped writer meets the writer lock; a blocked row is admitted only while handed off.
  const writers: Ledger = [running('B2', { isWriter: true, role: 'builder' }), task('B1', { isWriter: true, role: 'builder', status: 'partial' })]
  expect(admit(writers, writers[1]!, {}, 'partial', DEFAULT_LIMITS).refused).toContain('one writer at a time')
  const blocked: Ledger = [task('H1', { status: 'blocked' })]
  expect(admit(blocked, blocked[0]!, {}, 'blocked', DEFAULT_LIMITS).refused).toContain('H1')
  const handed: Ledger = [task('H1', { status: 'blocked', handoff: true })]
  expect(admit(handed, handed[0]!, { handoff: undefined }, 'blocked', DEFAULT_LIMITS).ledger[0]).toMatchObject({ status: 'running' })
})

test('the status summary counts a hand-off as running, queued apart, with the policy (R5)', () => {
  const ledger: Ledger = [running('T1'), task('H1', { status: 'blocked', handoff: true }), task('B1', { status: 'blocked', reason: 'denied' }), task('Q1', { deps: ['T1'] }), task('Q2'), task('D1', { status: 'completed' })]
  expect(statusSummary(ledger, 'balanced')).toEqual({ policy: 'balanced', running: 2, queued: 2 })
  expect(statusSummary([], 'quality')).toEqual({ policy: 'quality', running: 0, queued: 0 })
})

test('blockerFor is the one task\'s line of blockers', () => {
  const ledger: Ledger = [running('T1'), task('Q1', { deps: ['T1'] })]
  expect(blockerFor(ledger, ledger[1]!, DEFAULT_LIMITS)).toBe('waiting on T1')
  expect(blockers(ledger, DEFAULT_LIMITS)).toEqual(['Q1: waiting on T1'])
  expect(blockerFor(ledger, ledger[0]!, DEFAULT_LIMITS)).toBeUndefined()
})

test('with no usable checkout path every write is refused, not resolved against an empty root (TASK-0265 review B2)', () => {
  const builder = running('B1', { role: 'builder', isWriter: true, allowedFiles: [] })
  for (const cwd of ['', 'p', 'relative/dir']) {
    for (const path of ['/etc/passwd', '../../src/x', 'src/x']) expect(writeBlocker([builder], builder, path, cwd)).toBe('B1: the checkout path is unknown, so the write is refused')
  }
  expect(writeBlocker([builder], builder, '/p/src/x', '/p')).toBeUndefined()
  expect(writeBlocker([builder], builder, 'C:/p/src/x', 'C:\p')).toBeUndefined()
})
