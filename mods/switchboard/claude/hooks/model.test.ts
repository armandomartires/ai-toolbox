import { expect, test } from 'claude-code/testing'

import { EMPTY, STANDALONE, addSeen, groupRows, listData, listText, modTopic, skillTopic, asNames, isProtected, shownName, toolHints, dropSkills, isOff, listedSkills, offName, parseArgs, pendingNote, pluginDirs, refusal, serverOfTool, toggle, samePath, repoModDir, versionRow, versionRows, versionLine, versionProblems } from './model'

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
  expect(parseArgs('on')).toEqual({ kind: 'open' })
  expect(parseArgs('on mod')).toEqual({ kind: 'open' })
  expect(parseArgs('skills')).toEqual({ kind: 'open' })
})

test('the plugin folders split by the separator the value uses', () => {
  expect(pluginDirs('/a/mods/x:/b/y/')).toEqual(['/a/mods/x', '/b/y'])
  expect(pluginDirs('\\\\wsl.localhost\\d\\x;C:\\mods\\y\\')).toEqual(['\\\\wsl.localhost\\d\\x', 'C:\\mods\\y'])
  expect(pluginDirs(undefined)).toEqual([])
  expect(pluginDirs('C:\\work\\mods\\x\\claude')).toEqual(['C:\\work\\mods\\x\\claude'])
  expect(pluginDirs('/a/x:C:/b/y')).toEqual(['/a/x', 'C:/b/y'])
})

test('a mod toggle waits for the next session only when the session differs from it', () => {
  const off = { ...EMPTY, mod: ['agent-watch'] }
  expect(pendingNote(off, [], 'agent-watch')).toBe('off from the next session')
  expect(pendingNote(off, ['agent-watch'], 'agent-watch')).toBeUndefined()
  expect(pendingNote(EMPTY, ['agent-watch'], 'agent-watch')).toBe('on from the next session')
  expect(pendingNote(EMPTY, [], 'agent-watch')).toBeUndefined()
})


test('only an id-named server gets a tool hint, of at most three tools', () => {
  const id = '1a59c906-04da-521d-bda7-7f71b9f9e01c'
  const hints = toolHints(['a', 'b', 'c', 'd'].map(t => ({ name: `mcp__${id}__${t}`, serverName: id })))
  expect(hints[id]).toBe('a, b, c')
  expect(shownName('connector', id, hints)).toBe('1a59c906… (a, b, c)')
  expect(shownName('connector', 'figma', { figma: 'x' })).toBe('figma')
})

test('a ccd_ server is protected and never seen', () => {
  expect(isProtected('ccd_turn')).toBe(true)
  expect(isProtected('figma')).toBe(false)
  expect(addSeen(EMPTY, 'connector', ['ccd_turn', 'figma']).connector).toEqual(['figma'])
  expect(isOff({ ...EMPTY, connector: ['ccd_turn'] }, 'connector', 'ccd_turn')).toBe(false)
})

test('a skill is grouped by its plugin prefix; one with none is standalone', () => {
  expect(skillTopic('legal:brief')).toBe('legal')
  expect(skillTopic('sales:call:prep')).toBe('sales')
  expect(skillTopic('loop')).toBe(STANDALONE)
  expect(skillTopic(':odd')).toBe(STANDALONE)
})

test('mods group by category, Other last, rows alphabetical; switchboard sits in its own group', () => {
  const topics = { 'task-compass': 'planning', 'agent-watch': 'observability', 'task-orchestrator': 'planning', switchboard: 'configuration' }
  const groups = groupRows('mod', ['task-orchestrator', 'zeta', 'switchboard', 'task-compass', 'agent-watch'], topics)
  expect(groups).toEqual([
    { topic: 'configuration', names: ['switchboard'] },
    { topic: 'observability', names: ['agent-watch'] },
    { topic: 'planning', names: ['task-compass', 'task-orchestrator'] },
    { topic: 'Other', names: ['zeta'] },
  ])
  // With no manifest read for it, switchboard still has its own group.
  expect(modTopic('switchboard', {})).toBe('configuration')
  expect(modTopic('x', {})).toBe('Other')
})

test('skills group by prefix with Standalone last; connectors stay one flat group', () => {
  expect(groupRows('skill', ['review', 'sales:call-prep', 'legal:brief', 'legal:review-contract', 'loop'])).toEqual([
    { topic: 'legal', names: ['legal:brief', 'legal:review-contract'] },
    { topic: 'sales', names: ['sales:call-prep'] },
    { topic: 'Standalone', names: ['loop', 'review'] },
  ])
  expect(groupRows('connector', ['figma', 'alpha'])).toEqual([{ topic: '', names: ['alpha', 'figma'] }])
  expect(groupRows('mod', [])).toEqual([])
})

test('the list answers the same groups as text and as data', () => {
  const seen = { mod: ['agent-watch', 'zeta'], skill: ['legal:brief', 'loop'], connector: ['figma'] }
  const off = { ...EMPTY, mod: ['zeta'] }
  const topics = { 'agent-watch': 'observability' }
  const text = listText(off, seen, {}, topics)
  expect(text).toContain('  observability:\n    on   agent-watch')
  expect(text).toContain('  other:\n    off  zeta')
  expect(text).toContain('  legal:\n    on   legal:brief')
  expect(text).toContain('  standalone:\n    on   loop')
  expect(text).toContain('connectors (')
  expect(text).toContain('\n  on   figma')
  const data = listData(off, seen, {}, topics)
  expect(data[0]?.groups.map(group => group.topic)).toEqual(['observability', 'Other'])
  expect(data[0]?.rows.map(row => row.name)).toEqual(['agent-watch', 'zeta'])
  expect(data[2]?.groups).toEqual([{ topic: '', rows: [{ name: 'figma', isOn: true, isSelf: false }] }])
})

test('topics group without case: Legal and legal share one group, a category of other joins Other', () => {
  expect(groupRows('skill', ['Legal:a', 'legal:b'])).toEqual([{ topic: 'legal', names: ['Legal:a', 'legal:b'] }])
  expect(groupRows('mod', ['x', 'y'], { x: 'other' })).toEqual([{ topic: 'Other', names: ['x', 'y'] }])
})

const CHECKOUT = 'C:\\work\\ai-toolbox'

test('samePath ignores separators, a trailing one and a drive letter\'s case', () => {
  expect(samePath('C:\\work\\ai-toolbox\\mods\\x\\claude\\', 'c:/work/ai-toolbox/mods/x/claude')).toBe(true)
  expect(samePath('/a/b', '/a/c')).toBe(false)
  expect(samePath('/a/B', '/a/b')).toBe(false)
})

test('samePath ignores case in a Windows path and collapses doubled or dot segments', () => {
  expect(samePath('C:\\Work\\AI-Toolbox\\mods\\x\\claude', 'c:\\work\\ai-toolbox\\mods\\x\\claude')).toBe(true)
  expect(samePath('C:/work//ai-toolbox/./mods/x', 'C:/work/ai-toolbox/mods/x')).toBe(true)
  expect(samePath('/a//b/./c', '/a/b/c')).toBe(true)
  expect(samePath('\\\\wsl.localhost\\D\\x', '//wsl.localhost/d/x')).toBe(true)
})

test('repoModDir is the checkout\'s mods/<name>/claude', () => {
  expect(repoModDir(`${CHECKOUT}\\`, 'switchboard')).toBe('C:/work/ai-toolbox/mods/switchboard/claude')
})

test('a mod loaded from this checkout at the manifest\'s version is the same', () => {
  const row = versionRow(CHECKOUT, 'switchboard', '0.8.0', { root: 'c:/work/ai-toolbox/mods/switchboard/claude', version: '0.8.0' })
  expect(row).toEqual({ name: 'switchboard', loaded: '0.8.0', manifest: '0.8.0', isLoaded: true, isElsewhere: false, isStale: false })
  expect(versionLine(row)).toEqual({ text: '0.8.0', note: undefined })
})

test('a loaded version that differs from the manifest is stale, and the note says both', () => {
  const row = versionRow(CHECKOUT, 'agent-watch', '0.13.1', { root: `${CHECKOUT}/mods/agent-watch/claude`, version: '0.12.1' })
  expect(row.isStale).toBe(true)
  expect(row.isElsewhere).toBe(false)
  expect(versionLine(row)).toEqual({ text: 'loaded 0.12.1 · manifest 0.13.1', note: 'stale: restart or /reload-plugins to load 0.13.1' })
})

test('a mod loaded from another folder is marked with that folder, even at the same version', () => {
  const row = versionRow(CHECKOUT, 'task-compass', '1.0.0', { root: 'C:/Users/me/.claude/dev-mods/s1/task-compass', version: '1.0.0' })
  expect(row.isElsewhere).toBe(true)
  expect(row.isStale).toBe(false)
  expect(versionLine(row).note).toBe('loaded from elsewhere: C:/Users/me/.claude/dev-mods/s1/task-compass')
})

test('elsewhere and stale at once name both', () => {
  const row = versionRow(CHECKOUT, 'x', '2.0.0', { root: '/lib/x', version: '1.0.0' })
  expect(row).toMatchObject({ isElsewhere: true, isStale: true })
  expect(versionLine(row).note).toContain('stale')
  expect(versionLine(row).note).toContain('/lib/x')
})

test('a mod not loaded says so, and a loaded one with no version is stale against a manifest version', () => {
  const none = versionRow(CHECKOUT, 'y', '1.0.0', undefined)
  expect(none).toMatchObject({ isLoaded: false, isStale: false, isElsewhere: false })
  expect(versionLine(none)).toEqual({ text: 'manifest 1.0.0', note: 'not loaded in this session' })
  const bare = versionRow(CHECKOUT, 'z', '1.0.0', { root: `${CHECKOUT}/mods/z/claude` })
  expect(bare.isStale).toBe(true)
  expect(versionLine(bare).text).toBe('loaded ? · manifest 1.0.0')
})

test('versionRows lists the checkout\'s mods alphabetically and counts the ones to look at', () => {
  const rows = versionRows(
    CHECKOUT,
    { 'task-compass': '1.0.0', 'agent-watch': '0.13.1', switchboard: '0.8.0', idle: '0.1.0' },
    {
      switchboard: { root: `${CHECKOUT}/mods/switchboard/claude`, version: '0.8.0' },
      'agent-watch': { root: `${CHECKOUT}/mods/agent-watch/claude`, version: '0.12.1' },
      'task-compass': { root: '/lib/task-compass', version: '1.0.0' },
      other: { root: '/lib/other', version: '9' },
    },
  )
  expect(rows.map(row => row.name)).toEqual(['agent-watch', 'idle', 'switchboard', 'task-compass'])
  // A mod that is not in the checkout is not listed; a mod not loaded is not a problem.
  expect(versionProblems(rows)).toBe(2)
  expect(versionRows('', { a: '1' }, {})).toEqual([])
})
