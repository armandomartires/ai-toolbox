import { expect, mock, test } from 'claude-code/testing'
import type { AgentSpawnInput, AgentStatus, ConfigRow, On } from 'claude-code'

import { applyPlan, currentSprint, guessStory, parseSprints, setStoryStatus } from './model'
import { TOKENS } from './sigma'

const DARK = TOKENS.dark

const GOALS = `# Project

<!-- comment lines are skipped
- [x] not a story
-->

## Sprint 1 — Setup
Goal: Get the basics in
- [x] Scaffold the mod
- [x] First pane

## Sprint 2 — Timeline
Goal: Show sprints as rails
Dates: 2026-10-26 → 2026-11-06
- [>] Draw the rails
  One color per status
- [ ] Hover cards
- [?] Parse sprints
- [!] Terminal check
- Screenshots later

## Sprint 3 — Sharing
- [ ] Publish
`

const PANE = {
  plugin: 'task-compass',
  component: 'Pane',
  requestId: 'task-compass',
  props: {
    title: 'Compass',
    isFocused: false,
    bodyColumns: 72,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const SURFACES = ['terminal', 'desktop'] as const

/**
 * A call to one of the desktop app's tools. The engine types only the MCP
 * tools connected when it last loaded the mod, which may not include them.
 */
type AppTool = never

/**
 * The engine beneath the mod: a .ai/GOALS.md kept in memory in /p, the session's
 * folder unless the test moves it, and one subagent.
 */
const engine = (on: On, agentStatus: { value: AgentStatus }) => {
  const file = { text: GOALS, mtime: 1, cwd: '/p' }
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__task-compass__${e.name}` } }))
  on('tool.describe', (_, e) => ({ description: e.description }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('classic.CwdChanged', () => ({}))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.cwd', () => ({ value: file.cwd }))
  on('fs.stat', (_, e) => {
    if (!/[\\/]p[\\/]\.ai[\\/]GOALS\.md$/.test(e.path)) throw new Error('ENOENT')
    return { value: { kind: 'file', size: file.text.length, mtimeMs: file.mtime, isLink: false } }
  })
  on('fs.read', () => ({ value: file.text }))
  on('fs.write', (_, e) => {
    file.text = e.text
    file.mtime++
    return { value: undefined }
  })
  on('agent.list', () => ({
    value: [{ id: 'a1', description: 'Find hooks', type: 'Explore', status: agentStatus.value }],
  }))
  on('agent.spawn', () => ({ model: 'm', agentId: 'a1' }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))

  return file
}

test('sprints, stories, statuses and details come from GOALS.md', () => {
  const sprints = parseSprints(GOALS)
  expect(sprints.map(sprint => [sprint.n, sprint.status])).toEqual([
    [1, 'done'],
    [2, 'in_progress'],
    [3, 'todo'],
  ])
  expect(sprints[1]?.stories.map(story => [story.id, story.status])).toEqual([
    ['2.1', 'in_progress'],
    ['2.2', 'todo'],
    ['2.3', 'review'],
    ['2.4', 'blocked'],
    ['2.5', 'backlog'],
  ])
  expect(sprints[1]?.stories[0]?.details).toEqual(['One color per status'])
  expect(sprints[1]?.goal).toBe('Show sprints as rails')
  expect(currentSprint(sprints)).toBe(1)
  // A file of plain items is one sprint of backlog stories.
  expect(parseSprints('- a\n- b')[0]?.stories.map(story => story.status)).toEqual(['backlog', 'backlog'])
})

test('a story status is written back as its checkbox, the rest untouched', () => {
  const done = setStoryStatus(GOALS, '2.1', 'done') ?? ''
  expect(done).toContain('- [x] Draw the rails\n  One color per status')
  expect(setStoryStatus(GOALS, '2.5', 'todo')).toContain('- [ ] Screenshots later')
  expect(setStoryStatus(GOALS, '2.2', 'backlog')).toContain('\n- Hover cards\n')
  expect(setStoryStatus(GOALS, '9.9', 'done')).toBeUndefined()
  expect(done.split('\n').length).toBe(GOALS.split('\n').length)
})

test('update_plan items, advance, done and start follow the app', () => {
  let list = applyPlan([], {
    items: [
      { content: 'a', status: 'in_progress' },
      { content: 'b', status: 'pending' },
      { content: 'c', status: 'pending' },
    ],
  })
  list = applyPlan(list, { advance: true })
  expect(list.map(task => task.status)).toEqual(['completed', 'in_progress', 'pending'])
  list = applyPlan(list, { done: [2], start: 3 })
  expect(list.map(task => task.status)).toEqual(['completed', 'completed', 'in_progress'])
})

test('a live task is matched to the story it shares words with', () => {
  const stories = parseSprints(GOALS)[1]?.stories ?? []
  expect(guessStory('Build the hover cards', stories)).toBe('2.2')
  expect(guessStory('Refactor', stories)).toBeUndefined()
})

test('the timeline shows sprints side by side with cards, tasks and subagents', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on, { value: 'running' })

  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await $.tool.call({
    tool: 'mcp__ccd_turn__update_plan',
    items: [
      { content: 'Write the model', status: 'completed' },
      { content: 'Render the dots', status: 'in_progress' },
      { content: 'Test it', status: 'pending' },
    ],
  } as AppTool)
  await $.agent.spawn({ prompt: 'look', description: 'Find hooks', subagentType: 'Explore' } as AgentSpawnInput)
  await clock.advance(12_000)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    // Any element's text: a dot's name is drawn as its Button's label.
    const text = async (pattern: RegExp) => (await ui.find({ text: pattern }))?.text
    // Three sprint rails, the current one marked.
    expect(await text(/S1 Setup/)).toBeDefined()
    expect(await text(/S2 Timeline/)).toBeDefined()
    expect(await text(/S3 Sharing/)).toBeDefined()
    expect(await text(/SPRINT 2 OF 3/)).toBeDefined()
    // The story in progress carries Claude's live tasks under it.
    expect(await text(/▸Draw the rails/)).toBeDefined()
    expect(await text(/1 task done/)).toBeDefined()
    expect(await text(/Render the dots/)).toBeDefined()
    // The dots keep their status colours outside the name's Button, and the
    // tree fills the pane's rows. In progress is cyan; the current sprint's
    // mark is white, the one peak.
    expect((await ui.find({ type: 'Text', text: '◐' }))?.props.color).toBe(DARK.cyan)
    expect((await ui.find({ type: 'Text', text: '◉' }))?.props.color).toBe(DARK.white)
    expect((await ui.findAll({ type: 'Text' })).filter(one => one.props.dimColor).length).toBe(0)
    expect((await ui.find({ type: 'Button', text: /▸Draw the rails/ }))?.text).not.toContain('◐')
    expect((await ui.findAll({ type: 'Box' }))[0]?.props.minHeight).toBe(40)
    // No card is open until a dot or its name is pressed.
    const isCard = (one: { type: string; props: Record<string, unknown> }) =>
      one.type === 'Box' && one.props.backgroundColor !== undefined
    const card = async () => (await ui.findAll({ type: 'Box' })).find(isCard)
    expect(await card()).toBeUndefined()
    await ui.press({ key: 'st2.1' })
    expect(await text(/· One color per/)).toBeDefined()
    // A SIGMAorbital panel on `surface`, filling its column (the second of
    // three in 72 cells) right of the rail, in the flow under its story: the
    // stories below it slide down.
    const opened = await card()
    // The card's rows: its text lines and the two its frame takes.
    const cardRows =
      (opened?.children ?? []).filter(one => typeof one === 'object' && (one as { type?: string }).type === 'Text').length + 2
    expect(opened?.props).toMatchObject({ backgroundColor: DARK.surface, width: 22 })
    expect(opened?.props.position).toBeUndefined()
    // A square-cornered border on the terminal; elsewhere no border, padded to the same size.
    if (surface === 'terminal') expect(opened?.props).toMatchObject({ borderStyle: 'single', borderColor: DARK.line, paddingX: 1 })
    else expect(opened?.props).toMatchObject({ paddingX: 2, paddingY: 1 })
    if (surface !== 'terminal') {
      expect(opened?.props.borderStyle).toBeUndefined()
      // Framed by four straight edges: clipped strips, each one cell thick.
      const strips = (opened?.children ?? []).filter(
        (one): one is { props: Record<string, unknown> } =>
          typeof one === 'object' && one !== null && (one as { props?: { overflow?: string } }).props?.overflow === 'hidden',
      )
      expect(strips.map(one => [one.props.width === 1 ? 'side' : 'edge', one.props.top])).toEqual([
        ['edge', 0],
        ['edge', cardRows - 1],
        ['side', 0],
        ['side', 0],
      ])
    }
    const all = await ui.findAll({})
    const at = (key: string) => all.findIndex(one => one.key === key)
    const cardAt = all.findIndex(isCard)
    expect(at('st2.1')).toBeLessThan(cardAt)
    expect(cardAt).toBeLessThan(at('st2.2'))
    // The rail runs on beside it for all of the card's rows: `│` cells on the
    // terminal, and elsewhere the left edge of one bordered Box, unbroken.
    const before = all.slice(0, cardAt).reverse()
    if (surface === 'terminal') {
      expect(before.find(one => one.type === 'Box' && one.props.width === 2)?.text).toBe('│'.repeat(cardRows))
    } else {
      const edge = before.find(one => one.props.borderStyle === 'single')
      expect(edge?.props).toMatchObject({ position: 'absolute', width: 3, height: cardRows + 2, borderColor: DARK.line })
      expect(all.find(one => one.props.overflow === 'hidden' && one.props.height === cardRows)?.props.width).toBe(1)
    }
    // Another press opens that one instead; pressing it again closes it.
    await ui.press({ key: 'st2.3' })
    expect(await text(/· One color per/)).toBeUndefined()
    // The status line is the status's glyph and word, in its colour: review is amber.
    expect((await ui.find({ type: 'Text', text: /▲ IN REVIEW/ }))?.props).toMatchObject({ color: DARK.amber, mono: true, wrap: 'truncate-end' })
    await ui.press({ key: 's2' })
    expect(await text(/Goal: Show sprints/)).toBeDefined()
    await ui.press({ key: 's2' })
    expect(await card()).toBeUndefined()
    // Text styling: weight in place of the deprecated bold, sizes for the
    // heading and the legend, steady digits for times and counts.
    const styled = await ui.findAll({ type: 'Text' })
    // (A desktop adds bold beside a semibold weight of its own accord.)
    expect(styled.every(one => one.props.bold === undefined || one.props.weight !== undefined)).toBe(true)
    expect((await ui.find({ type: 'Text', text: /^SUBAGENTS$/ }))?.props).toMatchObject({ weight: 'bold', color: DARK['text-1'] })
    expect((await ui.find({ type: 'Text', text: / IN REVIEW$/ }))?.props).toMatchObject({ size: 'caption', color: DARK['text-3'] })
    expect((await ui.find({ type: 'Text', text: /^ 12s$/ }))?.props).toMatchObject({ tabular: true, size: 'caption' })
    // Names and labels are cut at the edge, never wrapped onto a second row.
    expect((await ui.find({ type: 'Text', text: / S2 Timeline/ }))?.props.wrap).toBe('truncate-end')
    expect((await ui.find({ type: 'Text', text: /Explore · Find hooks/ }))?.props.wrap).toBe('truncate-end')
    // The legend and the subagent.
    expect(await text(/IN REVIEW/)).toBeDefined()
    expect(await text(/Explore · Find hooks 12s/)).toBeDefined()
    // The subagent's glyph is its identity, in its state's colour: running is cyan.
    expect((await ui.find({ type: 'Text', text: /^■ $/ }))?.props.color).toBe(DARK.cyan)
    await ui.unmount()
  }
})

test('earlier and later scroll the sprints like a carousel', async ($, on) => {
  mock.clock(on)
  engine(on, { value: 'completed' })

  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  // Two of the three sprints fit in 44 cells, the current one (2) first.
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop', props: { ...PANE.props, bodyColumns: 44 } })
  const has = async (pattern: RegExp) => (await ui.find({ text: pattern })) !== undefined
  expect([await has(/S1 Setup/), await has(/S2 Timeline/), await has(/S3 Sharing/)]).toEqual([false, true, true])
  expect(await has(/‹ 1 EARLIER/)).toBe(true)
  expect(await has(/LATER ›/)).toBe(false)

  await ui.press({ key: 'earlier' })
  expect([await has(/S1 Setup/), await has(/S2 Timeline/), await has(/S3 Sharing/)]).toEqual([true, true, false])
  expect(await has(/1 LATER ›/)).toBe(true)
  expect(await has(/EARLIER/)).toBe(false)

  // Away from the current sprint, the middle label goes back to it.
  await ui.press({ key: 'current' })
  expect([await has(/S1 Setup/), await has(/S3 Sharing/)]).toEqual([false, true])
  expect(await has(/↺/)).toBe(false)
  await ui.unmount()
})

test('wrap_up finishes the live task list, and the story tool says when review ends', async ($, on) => {
  mock.clock(on)
  engine(on, { value: 'completed' })

  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await $.tool.call({
    tool: 'mcp__ccd_turn__update_plan',
    items: [
      { content: 'Write the model', status: 'completed' },
      { content: 'Render the dots', status: 'in_progress' },
    ],
  } as AppTool)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ text: /Render the dots/ })).toBeDefined()
  // The app ticks off the last step with wrap_up, not update_plan.
  await $.tool.call({ tool: 'mcp__ccd_turn__wrap_up', recap: 'done' } as AppTool)
  expect(await ui.find({ text: /Render the dots/ })).toBeUndefined()
  expect(await ui.find({ text: /2 tasks done/ })).toBeDefined()
  await ui.unmount()

  const { description } = await $.tool.describe({
    tool: 'mcp__task-compass__story',
    description: '',
    provider: { plugin: 'task-compass', tier: 'user' },
  })
  expect(description).toContain('a story in review is done once they have seen it and moved on')
})

test('a subagent row opens its transcript; on the terminal h, l and c steer the carousel', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on, { value: 'running' })
  const views: unknown[] = []
  on('ui.view', (_, e) => {
    views.push(e)
    return { value: {} }
  })

  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await $.agent.spawn({ prompt: 'look', description: 'Find hooks', subagentType: 'Explore' } as AgentSpawnInput)
  await clock.advance(4_000)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: { ...PANE.props, bodyColumns: 44 } })
  // The status glyph stays a colored Text; the name is the press.
  expect((await ui.find({ type: 'Button', text: /Explore · Find hooks/ }))?.key).toBe('agent-a1')
  await ui.press({ key: 'agent-a1' })
  expect(views).toEqual([{ agentId: 'a1' }])
  await ui.unmount()

  // While that agent is in view, its row is marked and takes you back.
  const viewing = await $.ui.mount({
    ...PANE,
    surface: 'terminal',
    props: { ...PANE.props, bodyColumns: 44, view: { agentId: 'a1' } },
  })
  expect(await viewing.find({ text: /▸Explore · Find hooks/ })).toBeDefined()
  await viewing.press({ key: 'agent-a1' })
  expect(views.at(-1)).toEqual({})
  // The carousel's controls carry their keys on the terminal.
  expect((await viewing.find({ key: 'earlier' }))?.props.hotkey).toBe('h')
  await viewing.press({ key: 'earlier' })
  expect((await viewing.find({ key: 'later' }))?.props.hotkey).toBe('l')
  expect((await viewing.find({ key: 'current' }))?.props.hotkey).toBe('c')
  await viewing.unmount()

  // Elsewhere the same controls have none.
  const desktop = await $.ui.mount({ ...PANE, surface: 'desktop', props: { ...PANE.props, bodyColumns: 44 } })
  expect((await desktop.find({ key: 'later' }))?.props.hotkey).toBeUndefined()
  await desktop.unmount()
})

test('the story tool writes the status to GOALS.md and marks the story', async ($, on) => {
  mock.clock(on)
  const file = engine(on, { value: 'completed' })

  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  const ran = await $.tool.call({ tool: 'mcp__task-compass__story', story: '2.2', status: 'in_progress', why: 'cards next' })
  expect(String(ran.result)).toContain('is now In progress')
  expect(file.text).toContain('- [>] Hover cards')

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Button', text: /▸Hover cards/ }))?.text).toBeDefined()
  await ui.press({ key: 'st2.2' })
  expect((await ui.find({ type: 'Text', text: /cards next/ }))?.text).toBeDefined()
  await ui.unmount()

  const wrong = await $.tool.call({ tool: 'mcp__task-compass__story', story: '7.1' })
  expect(String(wrong.result)).toContain('No story "7.1"')
})

test('a session started in a temporary folder describes the board of the folder it moved to', async ($, on) => {
  mock.clock(on)
  const file = engine(on, { value: 'completed' })
  file.cwd = '/tmp/spare'
  const describe = async () =>
    (await $.tool.describe({
      tool: 'mcp__task-compass__story',
      description: '',
      provider: { plugin: 'task-compass', tier: 'user' },
    })).description

  await $.session.start({ cwd: '/tmp/spare', surface: 'desktop', isInteractive: true })
  expect(await describe()).toContain('call this all the same')

  // The app moves the session into the project before the tool is rendered.
  file.cwd = '/p'
  expect(await describe()).toContain('2.2 Hover cards [To do]')

  // A move it reports later reloads the board too.
  file.cwd = '/tmp/spare'
  await $.classic.CwdChanged({ old_cwd: '/p', new_cwd: '/tmp/spare' })
  file.cwd = '/p'
  await $.classic.CwdChanged({ old_cwd: '/tmp/spare', new_cwd: '/p' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /S2 Timeline/ }))?.text).toBeDefined()
  await ui.unmount()
})

const OUTPUT = (command: string, text: string) => ({
  plugin: 'task-compass',
  component: 'CommandOutput',
  props: { command, args: '', text, isErrored: false },
}) as const

test('/compass and /goals draw as panels in the host theme; an unknown row stays text', async ($, on) => {
  mock.clock(on)
  engine(on, { value: 'completed' })
  on('config.list', () => ({ value: [{ key: 'theme', value: 'light' } as ConfigRow] }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  const LIGHT = TOKENS.light

  const compass = ((await $.command.run({ command: 'compass', args: '' } as never)) as { text: string }).text
  expect(compass).toBe('Compass pane opened: 3 sprints, 8 stories.')
  const goals = ((await $.command.run({ command: 'goals', args: '' } as never)) as { text: string }).text
  expect(goals).toBe('Compass: 3 sprints, 8 stories loaded from /p/.ai/GOALS.md.')

  for (const surface of ['terminal', 'desktop'] as const) {
    let ui = await $.ui.mount({ ...OUTPUT('compass', compass), surface })
    expect((await ui.find({ type: 'Text', text: /^COMPASS$/ }))?.props.color).toBe(LIGHT['text-1'])
    expect((await ui.find({ type: 'Text', text: /^8$/ }))?.props.tabular).toBe(true)
    await ui.unmount()

    ui = await $.ui.mount({ ...OUTPUT('goals', goals), surface })
    expect((await ui.find({ type: 'Text', text: /^GOALS$/ }))?.props.color).toBe(LIGHT['text-1'])
    expect(await ui.find({ text: /3 SPRINTS/ })).toBeDefined()
    // The current sprint is marked white, the others by their status.
    expect((await ui.find({ type: 'Text', text: '◉' }))?.props.color).toBe(LIGHT.white)
    expect((await ui.find({ type: 'Text', text: /Timeline$/ }))?.props.color).toBe(LIGHT['text-1'])
    expect((await ui.find({ type: 'Text', text: /^0\/5$/ }))?.props.tabular).toBe(true)
    expect((await ui.findAll({ type: 'Text' })).filter(one => one.text === '').length).toBe(0)
    await ui.unmount()
  }

  const old = await $.ui.mount({ ...OUTPUT('goals', 'Compass: 2 sprints, 4 stories loaded from /x.'), surface: 'terminal' })
  expect((await old.find({ type: 'Text' }))?.text).toBe('engine')
  await old.unmount()
})
