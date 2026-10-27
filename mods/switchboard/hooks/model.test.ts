import { expect, test } from 'claude-code/testing'

import { EMPTY, asNames, dropSkills, isOff, listedSkills, offName, parseArgs, refusal, serverOfTool, toggle } from './model'

const LISTING = [
  'The following skills are available for use with the Skill tool:',
  '',
  '- ansible-ops: How to change Ansible content safely.',
  '- claude-api: Reference for the Claude API.',
  'TRIGGER — read BEFORE opening the target file.',
  'SKIP only when another provider is being worked on.',
  '- plugin:review: Review a diff.',
  '- loop: Run a prompt on an interval.',
].join('\n')

test('the listing names each skill once, a plugin skill by its full name', () => {
  expect(listedSkills(LISTING)).toEqual(['ansible-ops', 'claude-api', 'plugin:review', 'loop'])
})

test('an off skill is dropped with its continuation lines; the rest stays', () => {
  const text = dropSkills(LISTING, ['claude-api', 'loop'])
  expect(text).not.toContain('claude-api')
  expect(text).not.toContain('TRIGGER')
  expect(text).not.toContain('- loop:')
  expect(text).toContain('The following skills are available')
  expect(text).toContain('- ansible-ops:')
  expect(text).toContain('- plugin:review:')
  expect(dropSkills(LISTING, [])).toBe(LISTING)
})

test('switchboard is never off, stored or toggled', () => {
  const stored = asNames({ mod: ['switchboard', 'agent-watch'], skill: 'junk' })
  expect(stored).toEqual({ mod: ['agent-watch'], skill: [], connector: [] })
  expect(isOff({ ...EMPTY, mod: ['switchboard'] }, 'mod', 'switchboard')).toBe(false)
  expect(toggle(EMPTY, 'mod', 'switchboard')).toBe(EMPTY)
  expect(parseArgs('off mod switchboard').kind).toBe('usage')
})

test('an off plugin is refused as it loads; switchboard and the others are not', () => {
  const off = { ...EMPTY, mod: ['agent-watch'] }
  expect(refusal(off, 'agent-watch')).toContain('switchboard')
  expect(refusal(off, 'task-compass')).toBeUndefined()
  expect(refusal({ ...EMPTY, mod: ['switchboard'] }, 'switchboard')).toBeUndefined()
})

test('a toggle turns off, then on again', () => {
  const off = toggle(EMPTY, 'skill', 'loop')
  expect(isOff(off, 'skill', 'loop')).toBe(true)
  expect(isOff(toggle(off, 'skill', 'loop'), 'skill', 'loop')).toBe(false)
})

test('a server matches by its own name or its tool-name spelling', () => {
  const off = toggle(EMPTY, 'connector', 'claude.ai Gmail')
  expect(serverOfTool('mcp__claude_ai_Gmail__create_draft')).toBe('claude_ai_Gmail')
  expect(serverOfTool('Bash')).toBeUndefined()
  expect(isOff(off, 'connector', 'claude_ai_Gmail')).toBe(true)
  expect(isOff(toggle(off, 'connector', 'claude_ai_Gmail'), 'connector', 'claude.ai Gmail')).toBe(false)
  expect(offName(off, 'claude_ai_Gmail')).toBe('claude.ai Gmail')
})

test('the command reads list, on and off', () => {
  expect(parseArgs('')).toEqual({ kind: 'open' })
  expect(parseArgs('list')).toEqual({ kind: 'list' })
  expect(parseArgs('off skill loop')).toEqual({ kind: 'set', target: 'skill', name: 'loop', wantOff: true })
  expect(parseArgs('on mcp claude.ai Gmail')).toEqual({ kind: 'set', target: 'connector', name: 'claude.ai Gmail', wantOff: false })
  expect(parseArgs('off thing x').kind).toBe('usage')
})
