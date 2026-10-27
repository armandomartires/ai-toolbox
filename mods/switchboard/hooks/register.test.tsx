import { expect, mock, test } from 'claude-code/testing'
import type { ConfigRow, On } from 'claude-code'
import type { Engine } from 'claude-code/testing'

import { TOKENS } from './sigma'

const DARK = TOKENS.dark

const PANE = {
  plugin: 'switchboard',
  component: 'Pane',
  requestId: 'switchboard',
  props: {
    title: 'Switchboard',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const LISTING = '- loop: Run a prompt on an interval.\n- review: Review a diff.'

/** The engine beneath the mod, in project `root.value`: what ran, and what was invalidated. */
const engine = (on: On, root: { value: string }) => {
  const ran: string[] = []
  const invalidated: string[] = []
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.invalidate', (_, e) => {
    invalidated.push(String(e.event))
    return { value: undefined }
  })
  on('session.root', () => ({ value: root.value }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.list', () => ({
    value: [
      { name: 'mcp__figma__get_screenshot', description: 'x', mcp: true },
      { name: 'mcp__ccd_turn__update_plan', description: 'x', mcp: true },
    ],
  }))
  // The context breakdown: two skills, a desktop connector named by its id.
  const ID = '1a59c906-04da-521d-bda7-7f71b9f9e01c'
  on('session.usage', () => ({
    value: {
      context: {
        breakdown: {
          skills: { skillFrontmatter: [{ name: 'deploy' }, { name: 'review' }] },
          mcpTools: ['batch', 'guide', 'update', 'read'].map(tool => ({ name: `mcp__${ID}__${tool}`, serverName: ID })),
        },
      },
    } as never,
  }))
  // One plugin folder, `/mods`, holding two mods with hooks and one plugin without.
  const files: Record<string, string> = {
    '/mods/agent-watch/.claude-plugin/plugin.json': '{"name":"agent-watch"}',
    '/mods/agent-watch/hooks/hooks.json': '{}',
    '/mods/task-compass/.claude-plugin/plugin.json': '{"name":"task-compass"}',
    '/mods/task-compass/hooks/hooks.json': '{}',
    '/mods/skills-only/.claude-plugin/plugin.json': '{"name":"skills-only"}',
  }
  mock.env(on, { CLAUDE_CODE_PLUGIN_DIRS: '/mods' })
  on('fs.exists', (_, e) => ({ value: e.path in files }))
  on('fs.read', (_, e) => (e.path in files ? { value: files[e.path] as string } : { deny: 'ENOENT' }))
  on('fs.list', (_, e) =>
    e.path === '/mods' ? { value: ['agent-watch', 'task-compass', 'skills-only'].map(name => ({ name, kind: 'dir' as const, size: 0, mtimeMs: 0, isLink: false })) } : { value: [] },
  )
  on('tool.call', (_, e) => {
    ran.push(String(e.tool))
    return { result: {} }
  })
  on('prompt.attachment', (_, e) => ({ text: e.text }))
  on('skill.prompt', (_, e) => ({ text: e.text }))
  on('tool.describe', (_, e) => ({ description: e.description }))
  on('plugin.register', () => ({ allow: true }))

  return { ran, invalidated }
}

const start = ($: Engine) =>
  $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })

const off = async ($: Engine, args: string) =>
  (await $.command.run({ command: 'switchboard', args } as never)) as { text: string }

test('a skill turned off is dropped from the listing, its call denied, its prompt replaced', async ($, on) => {
  mock.store(on)
  const said = engine(on, { value: '/p' })
  await start($)

  await off($, 'off skill loop')
  expect(said.invalidated).toContain('prompt.attachment')

  const listing = await $.prompt.attachment({ type: 'skill_listing', text: LISTING } as never)
  expect(listing.text).not.toContain('loop')
  expect(listing.text).toContain('review')

  const call = await $.tool.call({ tool: 'Skill', skill: 'loop' })
  expect('deny' in call && call.deny).toContain('turned off')
  expect(said.ran).not.toContain('Skill')

  await $.tool.call({ tool: 'Skill', skill: 'review' })
  expect(said.ran).toContain('Skill')

  const prompt = await $.skill.prompt({ skill: 'loop', text: 'do the loop', frontmatter: {} } as never)
  expect(prompt.text).toContain('turned off')
})

// `plugin.register` cannot be raised from a test (the kit's `$` has no
// `plugin` noun): its rule is the pure `refusal`, tested in model.test.ts.
test('a server turned off is denied and deferred', async ($, on) => {
  mock.store(on)
  const said = engine(on, { value: '/p' })
  await start($)
  await off($, 'off connector figma')

  const call = await $.tool.call({ tool: 'mcp__figma__get_screenshot' } as never)
  expect('deny' in call && call.deny).toContain('figma')
  expect(said.ran).not.toContain('mcp__figma__get_screenshot')

  const described = await $.tool.describe({
    tool: 'mcp__figma__get_screenshot',
    description: 'Screenshot a node',
    provider: { plugin: 'mcp:figma', tier: 'user' },
  } as never)
  expect(described.isDeferred).toBe(true)
  expect(described.description).toContain('Turned off')

  await off($, 'on connector figma')
  const back = await $.tool.describe({
    tool: 'mcp__figma__get_screenshot',
    description: 'Screenshot a node',
    provider: { plugin: 'mcp:figma', tier: 'user' },
  } as never)
  expect(back.isDeferred).toBeUndefined()
})

test('the command refuses to turn switchboard off', async ($, on) => {
  mock.store(on)
  engine(on, { value: '/p' })
  await start($)
  expect((await off($, 'off mod switchboard')).text).toContain('cannot turn itself off')
  expect((await off($, 'off mod agent-watch')).text).toContain('mod agent-watch is off')
})

test('toggles are kept per project root and survive in the store', async ($, on) => {
  mock.store(on)
  const root = { value: '/p' }
  engine(on, root)
  await start($)
  await off($, 'off skill loop')

  root.value = '/q'
  expect((await $.tool.call({ tool: 'Skill', skill: 'loop' })).deny).toBeUndefined()

  root.value = '/p'
  expect((await $.tool.call({ tool: 'Skill', skill: 'loop' })).deny).toContain('turned off')
  await off($, 'on skill loop')
  expect((await $.tool.call({ tool: 'Skill', skill: 'loop' })).deny).toBeUndefined()
})

test('the pane lists every mod with hooks from the plugin folders, each with an On/Off toggle', async ($, on) => {
  mock.store(on)
  engine(on, { value: '/p' })
  await start($)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ text: /MODS  3/ }))?.text).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /^SWITCHBOARD$/ }))?.props.color).toBe(DARK['text-1'])
    expect((await ui.find({ text: /^agent-watch$/ }))?.text).toBeDefined()
    expect((await ui.find({ text: /^task-compass$/ }))?.text).toBeDefined()
    expect(await ui.find({ text: /skills-only/ })).toBeUndefined()
    expect((await ui.find({ text: /^ALWAYS ON$/ }))?.text).toBeDefined()
    // On is nominal: a cyan glyph beside a text-1 name.
    expect((await ui.find({ type: 'Text', text: /^agent-watch$/ }))?.props.color).toBe(DARK['text-1'])
    expect((await ui.findAll({ type: 'Text', text: /^● $/ }))[0]?.props.color).toBe(DARK.cyan)
    expect((await ui.findAll({ type: 'Text' })).filter(one => one.props.dimColor || (one.props.bold && !one.props.weight)).length).toBe(0)
    // A switch: a filled Button named On, its knob at the right.
    const on = await ui.find({ type: 'Button', text: /^━━●$/ })
    expect(on?.props.label).toBe('On')
    expect(on?.props.variant).toBe('primary')
    await ui.unmount()
  }

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'mod-agent-watch' })
  expect((await ui.find({ text: /MODS  3 · 1 OFF/ }))?.text).toBeDefined()
  // Off is offline: a text-3 ring and name.
  expect((await ui.find({ type: 'Text', text: /^agent-watch$/ }))?.props.color).toBe(DARK['text-3'])
  const switched = await ui.find({ type: 'Button', text: /^●━━$/ })
  expect(switched?.props.label).toBe('Off')
  expect(switched?.props.variant).toBe('secondary')
  expect((await ui.find({ type: 'Text', text: /^ off from the next session$/ }))?.props.color).toBe(DARK.amber)
  await ui.press({ key: 'mod-agent-watch' })
  expect(await ui.find({ type: 'Text', text: /^ (on|off) from the next session$/ })).toBeUndefined()
  await ui.unmount()
})

test('skills and connectors open from their header; a toggle there acts next turn', async ($, on) => {
  mock.store(on)
  engine(on, { value: '/p' })
  await start($)
  await $.prompt.attachment({ type: 'skill_listing', text: LISTING } as never)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ text: /SKILLS  3/ }))?.text).toBeDefined()
  expect(await ui.find({ text: /^loop$/ })).toBeUndefined()
  await ui.press({ key: 'section-skill' })
  expect((await ui.find({ text: /^loop$/ }))?.text).toBeDefined()
  await ui.press({ key: 'skill-loop' })
  expect((await $.tool.call({ tool: 'Skill', skill: 'loop' })).deny).toContain('turned off')
  await ui.press({ key: 'section-connector' })
  expect((await ui.find({ text: /^figma$/ }))?.text).toBeDefined()
  await ui.unmount()
})

test('the command opens the pane when a kind or a name is left out', async ($, on) => {
  mock.store(on)
  engine(on, { value: '/p' })
  await start($)
  for (const args of ['', 'on', 'off mod', 'mod']) expect((await off($, args)).text).toBe('Switchboard opened.')
})

test('skills and servers come from the context breakdown; an id-named server shows its tools', async ($, on) => {
  mock.store(on)
  engine(on, { value: '/p' })
  await start($)

  const { text } = await off($, 'list')
  expect(text).toContain('on   deploy')
  expect(text).toContain('1a59c906… (batch, guide, update)')
  expect(text).not.toContain('read')
})

test("the desktop app's own servers are never listed, turned off or refused", async ($, on) => {
  mock.store(on, { 'off:/p': { mod: [], skill: [], connector: ['ccd_turn'] } })
  const said = engine(on, { value: '/p' })
  await start($)

  expect((await off($, 'list')).text).not.toContain('ccd_turn')
  expect((await off($, 'off connector ccd_turn')).text).toContain('stays on')
  expect((await $.tool.call({ tool: 'mcp__ccd_turn__update_plan' } as never)).deny).toBeUndefined()
  expect(said.ran).toContain('mcp__ccd_turn__update_plan')
})

const OUTPUT = (text: string) => ({
  plugin: 'switchboard',
  component: 'CommandOutput',
  props: { command: 'switchboard', args: 'list', text, isErrored: false },
}) as const

test('/switchboard list draws a panel per kind in the host theme; an unknown row stays text', async ($, on) => {
  mock.store(on)
  engine(on, { value: '/p' })
  on('config.list', () => ({ value: [{ key: 'theme', value: 'light' } as ConfigRow] }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  await start($)
  await off($, 'off mod agent-watch')
  const { text } = await off($, 'list')
  // The text the model reads is unchanged.
  expect(text).toContain('off  agent-watch')
  const LIGHT = TOKENS.light

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...OUTPUT(text), surface })
    expect((await ui.find({ type: 'Text', text: /^MODS$/ }))?.props.color).toBe(LIGHT['text-1'])
    expect(await ui.find({ type: 'Text', text: /^SKILLS$/ })).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /^agent-watch$/ }))?.props.color).toBe(LIGHT['text-3'])
    expect((await ui.find({ type: 'Text', text: /^task-compass$/ }))?.props.color).toBe(LIGHT['text-1'])
    expect((await ui.findAll({ type: 'Text', text: / ON$/ }))[0]?.props.color).toBe(LIGHT.cyan)
    await ui.unmount()
  }
  const old = await $.ui.mount({ ...OUTPUT('mods (next session):'), surface: 'terminal' })
  expect((await old.find({ type: 'Text' }))?.text).toBe('engine')
  await old.unmount()
})
