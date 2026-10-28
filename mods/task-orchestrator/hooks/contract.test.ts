import { expect, test } from 'claude-code/testing'

import { COORDINATOR_PROTOCOL, assignmentId, buildContract, parseReport } from './contract'
import { DEFAULT_LIMITS } from './routing'

test('the contract carries the assignment, its bounds and the stop condition', () => {
  const text = buildContract(
    { id: 'T2', role: 'builder', taskClass: 'implementation', objective: 'Add the flag', allowedFiles: ['src/cli.ts'], isWriter: true, isolated: true, requested: { model: 'sonnet', effort: 'medium' }, deps: ['T1'] },
    { inputs: ['src/cli.ts'], prohibited: ['the network'], deliverables: ['the flag parsed'], acceptance: ['npm test green'], tools: 'the session\'s tools' },
    DEFAULT_LIMITS,
    60,
    ['- T1 (scout, completed): the parser is in src/cli.ts'],
  )
  for (const line of ['# Assignment T2 — role builder (implementation)', '- src/cli.ts', '- the network', '- the flag parsed', '- npm test green', '- model sonnet, effort medium (requested;', 'at most 60 turns; retries 2, escalations 1', 'T1 (scout, completed): the parser', 'git worktree of your own at HEAD', 'committing, pushing, merging', 'updating the person\'s task board or task list (a Compass story']) {
    expect(text).toContain(line)
  }
  const readOnly = buildContract(
    { id: 'T1', role: 'scout', taskClass: 'lookup', objective: 'Find it', allowedFiles: [], isWriter: false, isolated: false, requested: { model: 'haiku', effort: 'low' }, deps: [] },
    { inputs: [], prohibited: [], deliverables: [], acceptance: [], tools: 'read-only tools' },
    DEFAULT_LIMITS,
    20,
    [],
  )
  expect(readOnly).toContain('read-only assignment')
})

test('the protocol puts a model or effort the person names on every dispatch, over the table', () => {
  expect(COORDINATOR_PROTOCOL).toContain('a model or an effort the person names for the run')
  expect(COORDINATOR_PROTOCOL).toContain('goes on every dispatch')
  expect(COORDINATOR_PROTOCOL).toContain('decides only what the person left open')
  expect(COORDINATOR_PROTOCOL).toContain('following the person does not')
  expect(COORDINATOR_PROTOCOL).toContain('Workers are subagents, not sessions')
  expect(COORDINATOR_PROTOCOL).toContain('keep the person\'s task board and task list current yourself')
  expect(COORDINATOR_PROTOCOL).not.toContain('pass model or effort yourself only with a reason')
})

test('the task id is read from an assignment header, and from nothing else', () => {
  expect(assignmentId('# Assignment T2 — role builder (implementation)\n\n## Objective')).toBe('T2')
  expect(assignmentId('  # Assignment review-2 — role reviewer (review)')).toBe('review-2')
  expect(assignmentId('Please do # Assignment T2 — role builder')).toBeUndefined()
  expect(assignmentId(undefined)).toBeUndefined()
})

test('the report parser reads the labelled lines, continuation lines included, and an unknown status', () => {
  const report = parseReport(['I looked around.', 'Status: completed (all good)', '**Findings:** two call sites', '  in src/a.ts and src/b.ts', 'Files: src/a.ts', 'Checks: npm test → 12 pass', 'Evidence: the grep output above', 'Risks: none', 'Next: review it'].join('\n'))
  expect(report.status).toBe('completed')
  expect(report.findings).toBe('two call sites\nin src/a.ts and src/b.ts')
  expect(report.checks).toBe('npm test → 12 pass')
  expect(report.next).toBe('review it')
  expect(parseReport('Status: done\nNext: nothing').status).toBe('unknown')
  expect(parseReport('no report at all')).toMatchObject({ status: 'unknown', findings: '', next: '' })
})
