import { expect, test } from 'claude-code/testing'

import { COORDINATOR_PROTOCOL, assignmentId, buildContract, parseReport, turnReserve } from './contract'
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

test('the contract tells a worker to write its report before the turn cap, keeping turns in reserve (TASK-0260)', () => {
  expect(turnReserve(120)).toBe(12)
  expect(turnReserve(60)).toBe(6)
  expect(turnReserve(10)).toBe(2)
  const text = buildContract(
    { id: 'T2', role: 'builder', taskClass: 'implementation', objective: 'Add the flag', allowedFiles: ['src/cli.ts'], isWriter: true, isolated: true, requested: { model: 'sonnet', effort: 'medium' }, deps: [] },
    { inputs: [], prohibited: [], deliverables: [], acceptance: [], tools: "the session's tools" },
    DEFAULT_LIMITS,
    120,
    [],
  )
  expect(text).toContain('at most 120 turns')
  expect(text).toContain('the engine stops you mid-step at the cap, with no report')
  expect(text).toContain('keep 12 turns in reserve: by turn 108')
  expect(text).toContain('write your report with Status partial')
  expect(text).toContain('what is done, what is left and where your edits are')
  // The coordinator resumes such a worker rather than retrying it.
  expect(COORDINATOR_PROTOCOL).toContain('except a worker collect says stopped at its turn cap: resume that agent with SendMessage to its agent id')
  expect(COORDINATOR_PROTOCOL).toContain('resume the same way a worker whose partial or blocked report asks for it') // TASK-0289
  // The stop list names it too.
  expect(text).toContain('- you reach turn 108 (the cap less the reserve), done or not.')
})

test('the protocol puts a model or effort the person names on every dispatch, over the table', () => {
  expect(COORDINATOR_PROTOCOL).toContain('a model or an effort the person names for the run')
  expect(COORDINATOR_PROTOCOL).toContain('goes on every dispatch')
  expect(COORDINATOR_PROTOCOL).toContain('decides only what the person left open')
  expect(COORDINATOR_PROTOCOL).toContain('following the person does not')
  expect(COORDINATOR_PROTOCOL).toContain('Workers are subagents unless the person asks for sessions')
  expect(COORDINATOR_PROTOCOL).toContain('runAs "session"')
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

test('the report parser takes bullets, headings, bold labels and dash separators', () => {
  expect(parseReport('- Status: completed\n- Findings: it works').status).toBe('completed')
  const heading = parseReport('## Status\ncompleted\n\n## Findings\nthe flag parses')
  expect(heading.status).toBe('completed')
  expect(heading.findings).toBe('the flag parses')
  const bold = parseReport('Status: partial\n**Checks actually run:** npm test → 3 pass\n**Evidence:** the log')
  expect(bold.checks).toBe('npm test → 3 pass')
  expect(bold.evidence).toBe('the log')
  expect(parseReport('Checks run: tsc → clean').checks).toBe('tsc → clean')
  expect(parseReport('Status — completed').status).toBe('completed')
  expect(parseReport('Status – blocked\nNext – ask the person').next).toBe('ask the person')
  expect(parseReport('* **Status**: failed').status).toBe('failed')
})

test('the report parser keeps what follows the status as findings when none are given, and keeps the vocabulary strict', () => {
  const report = parseReport('Status: completed\nThe parser now reads bullets.\nTwo tests added.\nFiles: a.ts')
  expect(report.status).toBe('completed')
  expect(report.findings).toBe('The parser now reads bullets.\nTwo tests added.')
  expect(report.files).toBe('a.ts')
  // Findings the report gave are not overwritten.
  expect(parseReport('Status: completed\nextra line\nFindings: real').findings).toBe('real')
  expect(parseReport('Status: done').status).toBe('unknown')
  expect(parseReport('## Status\nsuccess').status).toBe('unknown')
})

test('a bullet or bare label inside a section does not cut it short; a plain label always wins', () => {
  const report = parseReport('Status: completed\nFindings: the parser is fixed\n- Next: wire it\nRisks\nNext: y')
  expect(report.findings).toBe('the parser is fixed\n- Next: wire it\nRisks')
  expect(report.next).toBe('y')
  expect(report.risks).toBe('')
  // A report written wholly in bullets still reads, and a bare heading names an empty field.
  const bullets = parseReport('- Status: completed\n- Findings: ok\n- Next: ship')
  expect(bullets.findings).toBe('ok')
  expect(bullets.next).toBe('ship')
  expect(parseReport('Status: completed\n## Findings\nok\n## Next\nship').next).toBe('ship')
})

test('the first strong Status line wins: a later one in a findings echo is findings text (D11)', () => {
  const echoed = parseReport('Status: completed\nFindings: the run printed this:\nStatus: failed\n**Status:** blocked\nFiles: none\nChecks: ran it\nEvidence: the read\nRisks: none\nNext: review it')
  expect(echoed.status).toBe('completed')
  expect(echoed.findings).toContain('Status: failed')
  expect(echoed.findings).toContain('**Status:** blocked')
  expect(echoed.files).toBe('none')
  expect(echoed.next).toBe('review it')
  // Other labels keep their behaviour: a later `Next:` still replaces an earlier one.
  expect(parseReport('Status: partial\nNext: first\nNext: second').next).toBe('second')
  // A heading and its word on the next line still read as the status.
  expect(parseReport('## Status\nfailed\nFindings: broke').status).toBe('failed')
})
