import { expect, test } from 'claude-code/testing'

import { buildContract, parseReport } from './contract'
import { DEFAULT_LIMITS } from './routing'

test('the contract carries the assignment, its bounds and the stop condition', () => {
  const text = buildContract(
    { id: 'T2', role: 'builder', taskClass: 'implementation', objective: 'Add the flag', allowedFiles: ['src/cli.ts'], isWriter: true, isolated: true, requested: { model: 'sonnet', effort: 'medium' }, deps: ['T1'] },
    { inputs: ['src/cli.ts'], prohibited: ['the network'], deliverables: ['the flag parsed'], acceptance: ['npm test green'], tools: 'the session\'s tools' },
    DEFAULT_LIMITS,
    60,
    ['- T1 (scout, completed): the parser is in src/cli.ts'],
  )
  for (const line of ['# Assignment T2 — role builder (implementation)', '- src/cli.ts', '- the network', '- the flag parsed', '- npm test green', '- model sonnet, effort medium (requested;', 'at most 60 turns; retries 2, escalations 1', 'T1 (scout, completed): the parser', 'git worktree of your own at HEAD', 'committing, pushing, merging']) {
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

test('the report parser reads the labelled lines, continuation lines included, and an unknown status', () => {
  const report = parseReport(['I looked around.', 'Status: completed (all good)', '**Findings:** two call sites', '  in src/a.ts and src/b.ts', 'Files: src/a.ts', 'Checks: npm test → 12 pass', 'Evidence: the grep output above', 'Risks: none', 'Next: review it'].join('\n'))
  expect(report.status).toBe('completed')
  expect(report.findings).toBe('two call sites\nin src/a.ts and src/b.ts')
  expect(report.checks).toBe('npm test → 12 pass')
  expect(report.next).toBe('review it')
  expect(parseReport('Status: done\nNext: nothing').status).toBe('unknown')
  expect(parseReport('no report at all')).toMatchObject({ status: 'unknown', findings: '', next: '' })
})
