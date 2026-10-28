import { expect, mock, test } from 'claude-code/testing'
import type { AgentSpawnInput, AgentStatus, ConfigRow, On, Register } from 'claude-code'

import { applyPlan, currentSprint, guessStory, parseSprints, setStoryStatus } from './model'
import { TOKENS } from './sigma'
import { sessionsLayout } from './view'

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
const engine = (on: On, agentStatus: { value: AgentStatus }, more: { id: string; description: string; type: string; status: AgentStatus }[] = [], isEmpty = false) => {
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
    value: [...(isEmpty ? [] : [{ id: 'a1', description: 'Find hooks', type: 'Explore', status: agentStatus.value }]), ...more],
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
      // The rail's slot is two cells wide and its line sits on their boundary (`left` 1), where the sprint's glyph is centred.
      expect(edge?.props.left).toBe(1)
      expect(all.find(one => one.props.overflow === 'hidden' && one.props.height === cardRows)?.props.width).toBe(2)
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
    expect((await ui.find({ type: 'Text', text: /^SESSIONS$/ }))?.props).toMatchObject({ weight: 'bold', color: DARK['text-1'] })
    expect((await ui.find({ type: 'Text', text: / IN REVIEW$/ }))?.props).toMatchObject({ size: 'caption', color: DARK['text-3'] })
    expect((await ui.find({ type: 'Text', text: /^ 12s$/ }))?.props).toMatchObject({ tabular: true, size: 'caption' })
    // Names and labels are cut at the edge, never wrapped onto a second row.
    expect((await ui.find({ type: 'Text', text: /S2 Timeline/ }))?.props.wrap).toBe('truncate-end')
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

// task-orchestrator as the engine holds it: an inline plugin that writes its
// state. The kit loads an inline register without its closure, so the ledger
// is a literal inside it.
const orchestrator: Register = on => {
  on('session.start', async ($, e, next) => {
    const task = { requested: { model: 'sonnet', effort: 'medium' }, deps: [] as string[], createdAt: 500 }
    await $.state.set({ plugin: 'task-orchestrator', key: 'policy' } as const, 'balanced')
    await $.state.set({ plugin: 'task-orchestrator', key: 'enabled' } as const, true)
    await $.state.set({ plugin: 'task-orchestrator', key: 'ledger' } as const, [
      { ...task, id: 'T1', role: 'builder', objective: 'Write the model', status: 'running', agentId: 'a1', startedAt: 1_000, observed: { model: 'claude-sonnet-5-5', effort: 'high', at: 1_100 } },
      { ...task, id: 'T2', role: 'reviewer', objective: 'Review it', status: 'blocked', startedAt: 600, endedAt: 900 },
      { ...task, id: 'T3', role: 'tester', objective: 'Test it', status: 'queued', deps: ['T1', 'T2'] },
    ])
    return next(e)
  })
}
const idleOrchestrator: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.state.set({ plugin: 'task-orchestrator', key: 'ledger' } as const, [])
    return next(e)
  })
}

test('the Subagents panel draws the orchestrator ledger inline, one row per worker', { plugins: [{ name: 'task-orchestrator', register: orchestrator }] }, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on, { value: 'running' }, [{ id: 'a2', description: 'Look around', type: 'Explore', status: 'running' }])
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await clock.advance(4_000)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const text = async (pattern: RegExp) => (await ui.find({ text: pattern }))?.text
    expect(await text(/^ORCH BALANCED · 2 RUNNING$/)).toBeDefined()
    expect(await text(/T1 · builder · Write the model/)).toBeDefined()
    // Observed settings win over requested; the ledger's word is a badge.
    expect(await text(/claude-sonnet-5-5\/high/)).toBeDefined()
    expect(await text(/sonnet\/medium/)).toBeDefined()
    // The badge sits in the T2 row: some Box holds T2's name and BLOCKED, and no other task's.
    const boxes = (await ui.findAll({ type: 'Box' })).map(one => JSON.stringify(one))
    expect(boxes.some(one => one.includes('T2 · reviewer') && one.includes(' BLOCKED') && !one.includes('T1 · builder') && !one.includes('T3 · tester'))).toBe(true)
    expect(boxes.some(one => one.includes('T1 · builder') && one.includes(' BLOCKED') && !one.includes('T2 · reviewer'))).toBe(false)
    expect(await text(/WAITS ON T1, T2/)).toBeDefined()
    // The worker's agent is drawn once, as its task; an unclaimed agent still is.
    expect((await ui.findAll({ text: /Explore · Find hooks/ })).length).toBe(0)
    expect(await text(/Explore · Look around/)).toBeDefined()
    // Only a started task opens a transcript.
    expect((await ui.find({ type: 'Button', text: /T1 · builder/ }))?.key).toBe('agent-task-T1')
    await ui.unmount()
  }
})

test('with an empty ledger the Subagents panel is as it was', { plugins: [{ name: 'task-orchestrator', register: idleOrchestrator }] }, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on, { value: 'running' })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await clock.advance(4_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /ORCH/ })).toBeUndefined()
  expect(await ui.find({ text: /^1 RUNNING$/ })).toBeDefined()
  expect(await ui.find({ text: /Explore · Find hooks/ })).toBeDefined()
  await ui.unmount()
})

const offOrchestrator: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.state.set({ plugin: 'task-orchestrator', key: 'policy' } as const, 'balanced')
    await $.state.set({ plugin: 'task-orchestrator', key: 'enabled' } as const, false)
    await $.state.set({ plugin: 'task-orchestrator', key: 'ledger' } as const, [
      { id: 'T1', role: 'builder', objective: 'Write', status: 'queued', deps: [], createdAt: 500, requested: { model: 'sonnet', effort: 'medium' } },
    ])
    return next(e)
  })
}

test('the Subagents code says OFF when task-orchestrator is off', { plugins: [{ name: 'task-orchestrator', register: offOrchestrator }] }, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on, { value: 'running' })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await clock.advance(4_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /^ORCH BALANCED · OFF · 1 RUNNING$/ })).toBeDefined()
  await ui.unmount()
})

// agent-watch as the engine holds it: an inline plugin that writes its state
// (the kit loads an inline register without its closure, so every value is a
// literal inside it), beside task-orchestrator's ledger.
const watcher: Register = on => {
  on('session.start', async ($, e, next) => {
    const row = { type: 'Explore', calls: 0, tokens: 0 }
    await $.state.set({ plugin: 'agent-watch', key: 'now' } as const, 6_000)
    await $.state.set({ plugin: 'agent-watch', key: 'frame' } as const, 0)
    await $.state.set({ plugin: 'agent-watch', key: 'tasks' } as const, [])
    await $.state.set({ plugin: 'agent-watch', key: 'agents' } as const, [
      { ...row, id: 'm1', description: 'Scan docs', status: 'running', startedAt: 1_000, calls: 2, tokens: 1_200 },
      { ...row, id: 'a1', description: 'T1 builder', status: 'running', startedAt: 1_000, spawnedBy: 'task-orchestrator' },
      { ...row, id: 'f1', description: 'Review code', status: 'running', startedAt: 2_000, runId: 'wf_1' },
      { ...row, id: 'f2', description: 'Review tests', status: 'failed', startedAt: 2_000, endedAt: 4_000, runId: 'wf_1' },
    ])
    await $.state.set({ plugin: 'agent-watch', key: 'runs' } as const, [{ id: 'wf_1', name: 'review', startedAt: 2_000 }])
    await $.state.set({ plugin: 'agent-watch', key: 'tones' } as const, { orch: 1, 'run:wf_1': 2 })
    return next(e)
  })
}
const emptyWatcher: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.state.set({ plugin: 'agent-watch', key: 'agents' } as const, [])
    return next(e)
  })
}

test('the Sessions panel draws agent-watch\'s tree: this session, the ORCH run, a Workflow run, a caption', { plugins: [{ name: 'agent-watch', register: watcher }, { name: 'task-orchestrator', register: orchestrator }] }, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on, { value: 'running' })
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await clock.advance(4_000)

  for (const surface of ['terminal', 'desktop'] as const) {
    // Tall enough for every member: the KPI row and the panel fold first, the table's members last.
    const ui = await $.ui.mount({ ...PANE, surface, props: { ...PANE.props, scroll: { offset: 0, bodyRows: 70 } } })
    const text = async (pattern: RegExp) => (await ui.find({ text: pattern }))?.text
    expect(await text(/^SESSIONS$/i)).toBeDefined()
    expect(await text(/^3 RUNNING$/i)).toBeDefined()
    expect(await text(/^THIS SESSION$/)).toBeDefined()
    expect(await text(/^ORCH BALANCED$/)).toBeDefined()
    expect(await text(/^WF review$/)).toBeDefined()
    // The orchestrator's tasks are its members; the worker's agent is not drawn twice.
    expect(await text(/T1 · builder · Write the model/)).toBeDefined()
    expect(await text(/WAITS ON T1, T2/)).toBeDefined()
    expect((await ui.findAll({ text: /T1 builder/ })).length).toBe(0)
    // A member's caption, and a failed member's badge.
    expect(await text(/2 CALLS · 1\.2k TOK/)).toBeDefined()
    expect(await text(/ FAILED$/)).toBeDefined()
    expect(await text(/Explore · Review code/)).toBeDefined()
    // Heads are bold Buttons; a task not started opens nothing.
    expect((await ui.findAll({ type: 'Text', text: /^THIS SESSION$/ })).map(one => one.props.weight)).toContain('bold')
    expect((await ui.find({ type: 'Text', text: /^ORCH BALANCED$/ }))?.props.color).toBe(DARK['text-1'])
    // A row is pressed to select it (ADR-0046), so its key is the row's.
    expect((await ui.find({ type: 'Button', text: /Explore · Scan docs/ }))?.key).toBe('row-m1')
    expect((await ui.find({ type: 'Button', text: /T2 · reviewer/ }))?.key).toBe('row-task-T2')
    // Rows are coloured by state, never by session: running cyan, failed red, blocked amber.
    const glyphs = (await ui.findAll({ type: 'Text', text: /[⬢●◆▲□○■] $/ })).map(head => head.props.color)
    expect(glyphs).toContain(DARK.cyan)
    expect(glyphs).toContain(DARK.red)
    expect(glyphs).toContain(DARK.amber)
    expect(glyphs).not.toContain(DARK.violet)
    // A member row carries its state's glyph, so the fixed square is only a done one.
    const squares = (await ui.findAll({ type: 'Text', text: /■ $/ })).map(head => head.props.color)
    for (const tone of [DARK.red, DARK.amber, DARK.cyan]) expect(squares).not.toContain(tone)
    await ui.unmount()
  }
})

test('the Sessions panel draws the tree as a sunburst: an Svg on the desktop, a Raster of braille on the terminal', { plugins: [{ name: 'agent-watch', register: watcher }, { name: 'task-orchestrator', register: orchestrator }] }, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on, { value: 'running' })
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await clock.advance(4_000)

  const tall = { ...PANE.props, scroll: { offset: 0, bodyRows: 70 } }
  const desktop = await $.ui.mount({ ...PANE, surface: 'desktop', props: tall })
  const svg = await desktop.find({ type: 'Svg' })
  expect(svg).toBeDefined()
  expect(svg?.props.source).toMatch(/^<svg /)
  // Sectors are filled by state: running cyan, failed red, blocked amber; no session colour.
  for (const token of [DARK.cyan, DARK.red, DARK.amber]) expect(svg?.props.source).toContain(token)
  expect(svg?.props.source).not.toContain(DARK.violet)
  expect(String(svg?.props.alt)).toMatch(/running/)
  expect(svg?.props.isInteractive).toBe(true)
  expect(await desktop.find({ type: 'Raster' })).toBeUndefined()
  await desktop.unmount()

  const terminal = await $.ui.mount({ ...PANE, surface: 'terminal', props: tall })
  const raster = await terminal.find({ type: 'Raster' })
  expect(raster).toBeDefined()
  // 70 rows cap the chart (21 rows, 42 columns: the Sessions toggle takes one line): it was a fixed 18 x 9 before the chart took 80% of the width.
  expect(raster?.props).toMatchObject({ columns: 42, rows: 21 })
  expect(atob(String(raster?.props.cells)).length).toBe(42 * 21 * 12)
  expect(await terminal.find({ type: 'Svg' })).toBeUndefined()
  await terminal.unmount()

  // At the default 40 rows the chart is there: the tree's members yield first, down to the session heads.
  const dflt = await $.ui.mount({ ...PANE, surface: 'desktop', props: { ...PANE.props, scroll: { offset: 0, bodyRows: 40 } } })
  expect(await dflt.find({ type: 'Svg' })).toBeDefined()
  await dflt.unmount()
  const dfltTerminal = await $.ui.mount({ ...PANE, surface: 'terminal', props: { ...PANE.props, scroll: { offset: 0, bodyRows: 40 } } })
  expect(await dfltTerminal.find({ type: 'Raster' })).toBeDefined()
  await dfltTerminal.unmount()

  // A pane too short for it leaves the chart out.
  const short = await $.ui.mount({ ...PANE, surface: 'desktop', props: { ...PANE.props, scroll: { offset: 0, bodyRows: 30 } } })
  expect(await short.find({ type: 'Svg' })).toBeUndefined()
  await short.unmount()
})

const TREE = { plugins: [{ name: 'agent-watch', register: watcher }, { name: 'task-orchestrator', register: orchestrator }] }
const TALL = { ...PANE.props, scroll: { offset: 0, bodyRows: 70 } }

test('pressing a Sessions row selects it, outlines its arc and fills the panel; pressing it again clears it', TREE, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on, { value: 'running' })
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await clock.advance(4_000)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop', props: TALL })
  const source = async () => String((await ui.find({ type: 'Svg' }))?.props.source)
  // The head row, and the panel's name and path while this session is the one shown.
  const sessions = async () => (await ui.findAll({ type: 'Text', text: /^THIS SESSION$/ })).length
  const raised = async () => (await ui.findAll({ type: 'Box' })).filter(one => one.props.backgroundColor === DARK.raised).length
  // Nothing selected: this session in the panel, no arc outlined.
  expect(await source()).not.toContain(DARK.white)
  expect(await sessions()).toBe(3)
  expect(await raised()).toBe(0)
  await ui.press({ key: 'row-m1' })
  expect(await source()).toContain(`stroke="${DARK.white}"`)
  expect(await ui.find({ type: 'Text', text: /^THIS SESSION \/ Explore · Scan docs$/ })).toBeDefined()
  expect(await sessions()).toBe(1)
  // The selected row carries the raised fill.
  expect(await raised()).toBeGreaterThan(0)
  await ui.press({ key: 'row-m1' })
  expect(await source()).not.toContain(DARK.white)
  expect(await sessions()).toBe(3)
  expect(await raised()).toBe(0)
  await ui.unmount()
})

test('the selected-element panel shows path, state, progress, duration, tokens and children; OPEN TRANSCRIPT opens the transcript', TREE, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on, { value: 'running' })
  const views: unknown[] = []
  on('ui.view', (_, e) => {
    views.push(e)
    return { value: {} }
  })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await clock.advance(4_000)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: TALL })
  const has = async (pattern: RegExp) => (await ui.findAll({ type: 'Text', text: pattern })).length > 0
  expect(await has(/^SELECTED$/)).toBe(true)
  // This session by default: no transcript to open.
  expect(await ui.find({ key: 'transcript' })).toBeUndefined()
  await ui.press({ key: 'row-m1' })
  expect(await has(/^THIS SESSION \/ Explore · Scan docs$/)).toBe(true)
  expect(await has(/^ RUNNING$/)).toBe(true)
  expect(await has(/^0\/1$/)).toBe(true)
  expect(await has(/^· 0%$/)).toBe(true)
  expect(await has(/^00:00:05$/)).toBe(true)
  expect(await has(/^1,200$/)).toBe(true)
  expect(await has(/^—$/)).toBe(true)
  const open = await ui.find({ type: 'Button', key: 'transcript' })
  expect(open).toBeDefined()
  expect(await has(/^OPEN TRANSCRIPT$/)).toBe(true)
  await ui.press({ key: 'transcript' })
  expect(views).toEqual([{ agentId: 'm1' }])
  // A queued task has no transcript to open.
  await ui.press({ key: 'row-task-T3' })
  expect(await has(/^ QUEUED$/)).toBe(true)
  expect(await ui.find({ key: 'transcript' })).toBeUndefined()
  await ui.unmount()
})

test('the transcript stays reachable when the full panel does not fit: a one-line strip with OPEN TRANSCRIPT', TREE, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on, { value: 'running' })
  const views: unknown[] = []
  on('ui.view', (_, e) => {
    views.push(e)
    return { value: {} }
  })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await clock.advance(4_000)

  for (const bodyRows of [40, 48]) {
    views.length = 0
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: { ...PANE.props, scroll: { offset: 0, bodyRows } } })
    const has = async (pattern: RegExp) => (await ui.findAll({ type: 'Text', text: pattern })).length > 0
    // This session by default: a strip, no transcript.
    expect(await has(/^SELECTED$/)).toBe(false)
    expect(await ui.find({ key: 'transcript' })).toBeUndefined()
    await ui.press({ key: 'row-m1' })
    expect(await has(/^Explore · Scan docs$/)).toBe(true)
    expect(await has(/RUNNING/)).toBe(true)
    expect(await has(/ · 0\/1 · 1\.2k TOK$/)).toBe(true)
    expect(await ui.find({ type: 'Button', key: 'transcript' })).toBeDefined()
    expect(await has(/^OPEN TRANSCRIPT$/)).toBe(true)
    await ui.press({ key: 'transcript' })
    expect(views).toEqual([{ agentId: 'm1' }])
    // Clear the selection for the next pane height.
    await ui.press({ key: 'row-m1' })
    await ui.unmount()
  }
})

// agent-watch that has m1 gone from a session started in /q: the selected agent leaves the tree.
const shrinkingWatcher: Register = on => {
  on('session.start', async ($, e, next) => {
    const row = { type: 'Explore', calls: 0, tokens: 0 }
    const rows = [
      { ...row, id: 'm1', description: 'Scan docs', status: 'running', startedAt: 1_000, calls: 2, tokens: 1_200 },
      { ...row, id: 'f1', description: 'Review code', status: 'running', startedAt: 2_000 },
    ]
    await $.state.set({ plugin: 'agent-watch', key: 'now' } as const, 6_000)
    await $.state.set({ plugin: 'agent-watch', key: 'agents' } as const, e.cwd === '/q' ? rows.slice(1) : rows)
    return next(e)
  })
}

test('a selection whose key is no longer in the chart falls back to this session', { plugins: [{ name: 'agent-watch', register: shrinkingWatcher }] }, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on, { value: 'running' })
  const views: unknown[] = []
  on('ui.view', (_, e) => {
    views.push(e)
    return { value: {} }
  })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await clock.advance(4_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const has = async (pattern: RegExp) => (await ui.findAll({ type: 'Text', text: pattern })).length > 0
  await ui.press({ key: 'row-m1' })
  expect(await ui.find({ key: 'transcript' })).toBeDefined()
  // m1 leaves the tree: the strip is about this session again, with nothing to open.
  await $.session.start({ cwd: '/q', surface: 'terminal', isInteractive: true })
  await clock.advance(1_000)
  expect(await has(/Scan docs/)).toBe(false)
  expect(await ui.find({ key: 'transcript' })).toBeUndefined()
  expect(await has(/^THIS SESSION$/)).toBe(true)
  expect(await has(/· \d+\/\d+ · .*TOK$|^SELECTED$/)).toBe(true)
  await ui.unmount()
})

test('the KPI row shows the progress, agents, tokens and failed of this session', TREE, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on, { value: 'running' })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await clock.advance(4_000)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: TALL })
  const has = async (pattern: RegExp, color?: string) =>
    (await ui.findAll({ type: 'Text', text: pattern })).some(one => color === undefined || one.props.color === color)
  for (const title of [/^PROGRESS$/, /^AGENTS$/, /^TOKENS$/, /^FAILED$/]) expect(await has(title, DARK['text-3'])).toBe(true)
  // 2 of 6 steps, six agents, this session's 1.2k tokens, one failed (red, with its glyph).
  expect(await has(/^33$/, DARK['text-1'])).toBe(true)
  expect(await has(/^ %$/, DARK['text-3'])).toBe(true)
  expect(await has(/^6$/, DARK['text-1'])).toBe(true)
  expect(await has(/^1\.2k$/, DARK['text-1'])).toBe(true)
  expect(await has(/^ TOK$/, DARK['text-3'])).toBe(true)
  expect(await has(/^1$/, DARK.red)).toBe(true)
  expect(await has(/^◆ $/, DARK.red)).toBe(true)
  // The legend: a glyph and a word per state.
  for (const word of [/^ RUNNING$/, /^ DONE$/, /^ FAILED$/, /^ BLOCKED$/, /^ QUEUED$/, /^ STOPPED$/]) expect(await has(word, DARK['text-3'])).toBe(true)
  await ui.unmount()
})

test('the Sessions table colours each row by its state, never by its session', TREE, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on, { value: 'running' })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await clock.advance(4_000)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: TALL })
  const colour = async (pattern: RegExp) => (await ui.findAll({ type: 'Text', text: pattern })).map(one => one.props.color)
  expect(await colour(/^ BLOCKED$/)).toContain(DARK.amber)
  expect(await colour(/^ FAILED$/)).toContain(DARK.red)
  expect(await colour(/^ QUEUED$/)).toContain(DARK['text-3'])
  expect(await colour(/^ RUNNING$/)).toContain(DARK.cyan)
  // The STEPS, TIME and TOK columns.
  expect(await colour(/^2\/6$/)).toContain(DARK['text-1'])
  expect(await colour(/^1\.2k$/)).toContain(DARK['text-3'])
  // No Text in the pane is a session tone.
  const all = (await ui.findAll({ type: 'Text' })).map(one => one.props.color)
  expect(all).not.toContain(DARK.violet)
  await ui.unmount()
})

test('without agent-watch\'s agents the Sessions panel is the flat list', { plugins: [{ name: 'agent-watch', register: emptyWatcher }] }, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on, { value: 'running' })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await clock.advance(4_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /^SESSIONS$/i })).toBeDefined()
  expect(await ui.find({ text: /^1 RUNNING$/i })).toBeDefined()
  expect(await ui.find({ text: /Explore · Find hooks/ })).toBeDefined()
  expect(await ui.find({ text: /THIS SESSION/ })).toBeUndefined()
  await ui.unmount()
})

// agent-watch loaded with nothing tracked yet: its clock is the signal.
const loadedWatcher: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.state.set({ plugin: 'agent-watch', key: 'now' } as const, 6_000)
    await $.state.set({ plugin: 'agent-watch', key: 'agents' } as const, [])
    return next(e)
  })
}
const oneRowWatcher: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.state.set({ plugin: 'agent-watch', key: 'now' } as const, 6_000)
    await $.state.set({ plugin: 'agent-watch', key: 'agents' } as const, [
      { id: 'm1', type: 'Explore', description: 'Scan docs', status: 'running', startedAt: 1_000, calls: 0, tokens: 0 },
    ])
    return next(e)
  })
}
const queuedOrchestrator: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.state.set({ plugin: 'task-orchestrator', key: 'policy' } as const, 'balanced')
    await $.state.set({ plugin: 'task-orchestrator', key: 'enabled' } as const, true)
    await $.state.set({ plugin: 'task-orchestrator', key: 'ledger' } as const, [
      { id: 'T1', role: 'builder', objective: 'Write', status: 'queued', deps: [], createdAt: 500, requested: { model: 'sonnet', effort: 'medium' } },
    ])
    return next(e)
  })
}

test('with only queued ledger tasks and no agent-watch the Sessions panel is the flat list', { plugins: [{ name: 'task-orchestrator', register: queuedOrchestrator }] }, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on, { value: 'completed' }, [], true)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await clock.advance(4_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /^ORCH BALANCED · 0 RUNNING$/ })).toBeDefined()
  expect(await ui.find({ text: /THIS SESSION/ })).toBeUndefined()
  await ui.unmount()
})

test('with agent-watch loaded and no agent the Sessions panel draws this session', { plugins: [{ name: 'agent-watch', register: loadedWatcher }] }, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on, { value: 'running' })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await clock.advance(4_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /^THIS SESSION$/ })).toBeDefined()
  expect(await ui.find({ text: /No subagent yet/ })).toBeDefined()
  await ui.unmount()
})

test('with agent-watch loaded the tree is drawn though Compass tracks no agent itself', { plugins: [{ name: 'agent-watch', register: oneRowWatcher }] }, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on, { value: 'running' }, [], true)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await clock.advance(4_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /^THIS SESSION$/ })).toBeDefined()
  expect(await ui.find({ text: /Explore · Scan docs/ })).toBeDefined()
  await ui.unmount()
})

test('the SELECTED panel is funded before the KPI row', TREE, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on, { value: 'running' })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await clock.advance(4_000)
  const shows = async (bodyRows: number) => {
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: { ...PANE.props, scroll: { offset: 0, bodyRows } } })
    const panel = (await ui.findAll({ type: 'Text', text: /^SELECTED$/ })).length > 0
    await ui.unmount()
    return panel
  }
  // The panel needs no KPI row's rows ahead of it: it is there at 54, where the KPI row first would have left too little.
  expect(await shows(54)).toBe(true)
  expect(await shows(40)).toBe(false)
})

test('the chart takes 80% of the pane: a Raster of 0.8 x the columns, an Svg in an 80% Box with no size of its own, capped by the room', TREE, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on, { value: 'running' })
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await clock.advance(4_000)
  const pane = (surface: string, bodyColumns: number, bodyRows: number) => $.ui.mount({ ...PANE, surface, props: { ...PANE.props, bodyColumns, scroll: { offset: 0, bodyRows } } })

  for (const [bodyColumns, columns] of [[60, 48], [100, 80]] as const) {
    const terminal = await pane('terminal', bodyColumns, 200)
    expect((await terminal.find({ type: 'Raster' }))?.props).toMatchObject({ columns, rows: columns / 2 })
    await terminal.unmount()
  }
  // Short of room the chart shrinks rather than push the table out: still round, fewer columns.
  const capped = await pane('terminal', 100, 55)
  const small = (await capped.find({ type: 'Raster' }))?.props as { columns: number; rows: number }
  expect(small.columns).toBeLessThan(80)
  expect(small.columns).toBe(small.rows * 2)
  expect(small.rows).toBeGreaterThanOrEqual(9)
  await capped.unmount()

  const desktop = await pane('desktop', 100, 200)
  const svg = await desktop.find({ type: 'Svg' })
  expect(svg?.props.width).toBeUndefined()
  expect(svg?.props.height).toBeUndefined()
  // The markup is drawn at the pane's own width (0.8 x 100 columns x 7px), so the host does not scale it: its fonts keep their size.
  expect(String(svg?.props.source)).toMatch(/^<svg [^>]*viewBox="0 0 560 560" width="560" height="560"/)
  const slot = (await desktop.findAll({ type: 'Box' })).find(box => (box.children ?? []).some(child => typeof child === 'object' && (child as { type?: string }).type === 'Svg'))
  expect(slot?.props.width).toBe('80%')
  await desktop.unmount()
  const narrow = await pane('desktop', 60, 200)
  expect(String((await narrow.find({ type: 'Svg' }))?.props.source)).toMatch(/^<svg [^>]*viewBox="0 0 336 336" width="336" height="336"/)
  await narrow.unmount()
  const tight = await pane('desktop', 100, 55)
  const slotTight = (await tight.findAll({ type: 'Box' })).find(box => (box.children ?? []).some(child => typeof child === 'object' && (child as { type?: string }).type === 'Svg'))
  expect(typeof slotTight?.props.width).toBe('number')
  await tight.unmount()
})

test('the board has a SIGMAorbital title bar like the Sessions panel', TREE, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on, { value: 'running' })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await clock.advance(4_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: TALL })
  const titles = (await ui.findAll({ type: 'Text' })).map(one => one.children?.join?.('') ?? one.props.children).filter(text => typeof text === 'string')
  expect(titles.indexOf('SPRINTS')).toBeGreaterThanOrEqual(0)
  expect(titles.indexOf('SPRINTS')).toBeLessThan(titles.indexOf('SESSIONS'))
  await ui.unmount()
})

test('the table, the SELECTED panel and the strip show CODE · full name, the code in text-3', TREE, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on, { value: 'running' })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await clock.advance(4_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: TALL })
  const codes = async (pattern: RegExp) => (await ui.findAll({ type: 'Text', text: pattern })).filter(one => one.props.color === DARK['text-3'])
  // The table row of m1 carries its code and its full name.
  expect((await codes(/^A\d\d ·$/)).length).toBeGreaterThan(0)
  expect((await ui.findAll({ type: 'Text', text: /^Explore · Scan docs$/ })).length).toBeGreaterThan(0)
  await ui.press({ key: 'row-m1' })
  // The SELECTED panel adds the code before the name, beside the table's.
  expect((await codes(/^A\d\d ·$/)).length).toBeGreaterThan(0)
  expect((await ui.findAll({ type: 'Text', text: /^Explore · Scan docs$/ })).length).toBeGreaterThan(1)
  await ui.unmount()
})

test('the SELECTED panel\'s title carries the member\'s state glyph and tone, and a session its hexagon', TREE, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on, { value: 'running' })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await clock.advance(4_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: TALL })
  // This session: the hexagon.
  expect((await ui.findAll({ type: 'Text', text: /^⬢$/ })).length).toBeGreaterThan(0)
  // A failed member: the failed glyph in red, beside the panel's own title.
  const before = (await ui.findAll({ type: 'Text', text: /^◆$/ })).length
  await ui.press({ key: 'row-f2' })
  const glyphs = await ui.findAll({ type: 'Text', text: /^◆$/ })
  // The panel adds two: its title's, and its State line's.
  expect(glyphs.length).toBe(before + 2)
  expect(glyphs.every(one => one.props.color === DARK.red)).toBe(true)
  await ui.unmount()
})

test('at 40 rows and 60 columns the chart, legend, strip, KPI row, tree and board stay within the pane', TREE, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on, { value: 'running' })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await clock.advance(4_000)
  // The accounting itself: every part the layout draws is paid for, whatever the pane's height, width or surface.
  const tight: number[] = []
  for (const isTerminal of [true, false]) {
    for (const cols of [40, 60, 100]) {
      for (const rows of [30, 40, 46, 60, 120]) {
        for (const lines of [3, 15]) {
          const layout = sessionsLayout({ rows, cols, isTerminal, hasTree: true, canChart: true, lines, shrink: budget => ({ lines: Math.min(lines, budget), apply: () => {} }), flatLines: 0 })
          // Wherever the chart is drawn the parts never exceed the pane, in the tight tier too.
          if (layout.hasChart) expect(layout.used).toBeLessThanOrEqual(rows)
          // The tight tier draws the chart at its least size, never under 160 px.
          if (layout.hasChart && !isTerminal && layout.chartGap === 0) tight.push(layout.chartPx)
          // The strip's two rows are counted when the panel is not drawn.
          expect(layout.stripRows).toBe(layout.hasSelected ? 0 : 2)
          expect(layout.legendRows).toBe(Math.ceil(59 / cols))
        }
      }
    }
  }
  expect(tight.length).toBeGreaterThan(0)
  for (const px of tight) expect(px >= 160 && px < 220).toBe(true)
  // The pane as rendered agrees: at 60 columns the chart is there at 46 rows, with the strip and no panel, and not at 30.
  const mount = (bodyRows: number) => $.ui.mount({ ...PANE, surface: 'terminal', props: { ...PANE.props, bodyColumns: 60, scroll: { offset: 0, bodyRows } } })
  const tall = await mount(46)
  const raster = (await tall.find({ type: 'Raster' }))?.props as { columns: number; rows: number }
  expect(raster.rows).toBeLessThan(46)
  expect(raster.columns).toBe(raster.rows * 2)
  expect((await tall.findAll({ type: 'Text', text: /^SELECTED$/ })).length).toBe(0)
  await tall.unmount()
  const short = await mount(30)
  expect(await short.find({ type: 'Raster' })).toBeUndefined()
  await short.unmount()
})

// Collapse and expand (TASK-0199): the Sessions list folds under this session's row, each sprint under its progress line; no title bar carries a toggle.
const LIST = { key: 'toggle-list', hotkey: 's' } as const
const fold = (n: number) => `fold-s${n}`
const SHORT = { ...PANE.props, scroll: { offset: 0, bodyRows: 56 } }

/** A Button's label: the text of the Text inside it. */
const labelOf = async (ui: { find: (q: Record<string, unknown>) => Promise<{ text?: string } | undefined> }, key: string) => (await ui.find({ type: 'Button', key }))?.text

test('a sprint\'s toggle hangs directly under that sprint\'s progress line, as a line-strong Button: `k` on the terminal for the current sprint', TREE, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on, { value: 'running' })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await clock.advance(4_000)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface, props: TALL })
    const all = await ui.findAll({})
    for (const n of [1, 2, 3]) {
      const progress = all.findIndex(one => one.type === 'Text' && /^[▰▱]{5} \d+\/\d+/.test(one.text ?? '') && all.findIndex(other => other.key === `s${n}`) < all.indexOf(one) && (n === 3 || all.indexOf(one) < all.findIndex(other => other.key === `s${n + 1}`)))
      const button = all.findIndex(one => one.key === fold(n))
      expect(progress).toBeGreaterThan(-1)
      expect(button).toBeGreaterThan(progress)
      // Nothing with a label or a press sits between the progress line and the toggle: only the rail's own cells.
      expect(all.slice(progress + 1, button).filter(one => one.type === 'Button' || (one.type === 'Text' && one.text !== '│' && one.text !== ''))).toEqual([])
      expect(all[button]?.type).toBe('Button')
      expect(((await ui.find({ type: 'Button', key: fold(n) }))?.children?.[0] as { props: { color: string } }).props.color).toBe(DARK['line-strong'])
      expect(await labelOf(ui, fold(n))).toBe('▾ HIDE')
    }
    // The hotkey is the terminal's, and the current sprint's (the second) alone.
    expect((await ui.find({ type: 'Button', key: fold(2) }))?.props.hotkey).toBe(surface === 'terminal' ? 'k' : undefined)
    expect((await ui.find({ type: 'Button', key: fold(1) }))?.props.hotkey).toBeUndefined()
    expect((await ui.find({ type: 'Button', key: fold(3) }))?.props.hotkey).toBeUndefined()
    await ui.unmount()
  }
})

test('folding a sprint hides only that sprint\'s rows and counts them; the state is an atom; its rows return to the board\'s room', TREE, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on, { value: 'running' })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await clock.advance(4_000)
  let ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: SHORT })
  expect(await ui.find({ key: 'st2.1' })).toBeDefined()
  expect(await ui.find({ key: 'st3.1' })).toBeDefined()
  // The rows that sprint draws now: its stories, and Claude's live tasks under the one worked on.
  const hidden = (await ui.findAll({ type: 'Button' })).filter(one => /^(st|t)2[.-]/.test(String(one.key))).length
  expect(hidden).toBeGreaterThanOrEqual(4)
  await ui.press({ key: fold(2) })
  // Sprint 2 shows its header, progress and toggle only; sprints 1 and 3 keep their rows.
  expect(await ui.find({ key: 'st2.1' })).toBeUndefined()
  expect(await ui.find({ key: 'st2.4' })).toBeUndefined()
  expect(await ui.find({ key: 's2' })).toBeDefined()
  expect(await ui.find({ key: 'st3.1' })).toBeDefined()
  expect(await labelOf(ui, fold(2))).toBe(`▸ SHOW ${hidden}`)
  expect(await labelOf(ui, fold(3))).toBe('▾ HIDE')
  // The atom is not the pane's: a pane mounted afterwards draws it folded.
  await ui.unmount()
  ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: SHORT })
  expect(await labelOf(ui, fold(2))).toBe(`▸ SHOW ${hidden}`)
  expect(await ui.find({ key: 'st2.1' })).toBeUndefined()
  await ui.press({ key: fold(2) })
  expect(await ui.find({ key: 'st2.1' })).toBeDefined()
  expect(await labelOf(ui, fold(2))).toBe('▾ HIDE')
  await ui.unmount()
  // With every sprint on view folded, the board's room is the three rows, and the Sessions panel takes the rest.
  const base = { rows: 46, cols: 72, isTerminal: true, hasTree: true, canChart: true, lines: 8, shrink: (budget: number) => ({ lines: Math.min(8, budget), apply: () => {} }), flatLines: 0 }
  const grown = (layout: ReturnType<typeof sessionsLayout>) => layout.chartRows + (layout.hasKpi ? 5 : 0) + (layout.hasSelected ? 9 : 0)
  const whole = sessionsLayout(base)
  const folded = sessionsLayout({ ...base, isBoardFolded: true })
  expect(folded.room).toBe(3)
  expect(grown(folded)).toBeGreaterThan(grown(whole))
  expect(folded.used).toBeLessThanOrEqual(46)
})

test('`k` folds the current sprint: the terminal\'s hotkey sits on its toggle alone', TREE, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on, { value: 'running' })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await clock.advance(4_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: SHORT })
  const hotkeys = (await ui.findAll({ type: 'Button' })).filter(one => one.props.hotkey === 'k').map(one => one.key)
  expect(hotkeys).toEqual([fold(2)])
  // `k` is the press of that toggle: it folds the current sprint's rows and no other's.
  await ui.press({ key: fold(2) })
  expect(await ui.find({ key: 'st2.1' })).toBeUndefined()
  expect(await ui.find({ key: 'st3.1' })).toBeDefined()
  await ui.unmount()
})

test('the Sessions toggle hangs directly under THIS SESSION\'s row, indented like its members; `s` on the terminal; folded it leaves that row and the toggle', TREE, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on, { value: 'running' })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await clock.advance(4_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: TALL })
  const has = async (pattern: RegExp) => (await ui.findAll({ type: 'Text', text: pattern })).length > 0
  const order = async () => (await ui.findAll({})).filter(one => one.type === 'Button').map(one => one.key)
  let keys = await order()
  const main = keys.find(key => String(key).startsWith('row-'))!
  // The first press of a row is THIS SESSION's; the toggle is the next Button, before any member's row.
  expect(keys[keys.indexOf(main) + 1]).toBe(LIST.key)
  expect(keys.indexOf(LIST.key)).toBeLessThan(keys.indexOf('row-m1'))
  expect((await ui.find({ type: 'Button', key: LIST.key }))?.props.hotkey).toBe('s')
  expect(((await ui.find({ type: 'Button', key: LIST.key }))?.children?.[0] as { props: { color: string } }).props.color).toBe(DARK['line-strong'])
  expect(await labelOf(ui, LIST.key)).toBe('▾ HIDE')
  expect(await has(/^STEPS$/)).toBe(true)
  await ui.press({ key: LIST.key })
  // Folded: THIS SESSION's row and the toggle, with the counts; the table's head stays, everything under the toggle goes.
  keys = await order()
  expect(keys.filter(key => String(key).startsWith('row-'))).toEqual([main])
  expect(await ui.find({ key: 'row-m1' })).toBeUndefined()
  expect(await labelOf(ui, LIST.key)).toMatch(/^▸ SHOW \d+ SESSIONS · \d+ AGENTS$/)
  expect(await has(/^STEPS$/)).toBe(true)
  // The rest of the Sessions panel and the board stay.
  expect(await ui.find({ type: 'Raster' })).toBeDefined()
  expect(await has(/^PROGRESS$/)).toBe(true)
  expect(await has(/^SELECTED$/)).toBe(true)
  expect(await ui.find({ key: 'st2.1' })).toBeDefined()
  await ui.unmount()
  // The state is an atom: a pane mounted afterwards draws it folded, and unfolds with the same toggle.
  const again = await $.ui.mount({ ...PANE, surface: 'terminal', props: TALL })
  expect(await labelOf(again, LIST.key)).toMatch(/^▸ SHOW/)
  await again.press({ key: LIST.key })
  expect(await again.find({ key: 'row-m1' })).toBeDefined()
  expect(await labelOf(again, LIST.key)).toBe('▾ HIDE')
  await again.unmount()
  const desktop = await $.ui.mount({ ...PANE, surface: 'desktop', props: TALL })
  expect((await desktop.find({ type: 'Button', key: LIST.key }))?.props.hotkey).toBeUndefined()
  await desktop.unmount()
})

test('collapsing the Sessions list hands its rows to the chart: more chart rows at the same height', TREE, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on, { value: 'running' })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await clock.advance(4_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: SHORT })
  const rowsOf = async () => ((await ui.find({ type: 'Raster' }))?.props as { rows: number }).rows
  const open = await rowsOf()
  await ui.press({ key: LIST.key })
  expect(await rowsOf()).toBeGreaterThan(open)
  await ui.unmount()
  // The accounting agrees: a folded list is this session's row, its blank line and the toggle, and the chart gets the rest.
  const base = { rows: 56, cols: 72, isTerminal: true, hasTree: true, canChart: true, lines: 15, shrink: (budget: number) => ({ lines: Math.min(15, budget), apply: () => {} }), flatLines: 0, hasFold: true }
  const expanded = sessionsLayout(base)
  const folded = sessionsLayout({ ...base, isListCollapsed: true })
  expect(folded.treeLines).toBe(3)
  expect(folded.chartRows).toBeGreaterThan(expanded.chartRows)
  expect(folded.used).toBeLessThanOrEqual(56)
})

test('no title bar carries a toggle: the Sprints and Sessions bars are the panel look, a title, a code and a rule', TREE, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on, { value: 'running' })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await clock.advance(4_000)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface, props: TALL })
    expect(await ui.find({ key: 'toggle-board' })).toBeUndefined()
    expect(await ui.find({ key: 'toggle-cards' })).toBeUndefined()
    // A title bar is the Box holding a bold uppercase title: no ▾ or ▸ Button sits beside the title.
    for (const title of ['SPRINTS', 'SESSIONS']) {
      const bars = (await ui.findAll({ type: 'Box' })).filter(one => (one.children ?? []).some(child => typeof child === 'object' && (child as { type?: string }).type === 'Text' && ((child as { children?: unknown[] }).children ?? []).join('') === title))
      expect(bars.length).toBe(1)
      expect((bars[0]?.children ?? []).filter(child => typeof child === 'object' && (child as { type?: string }).type === 'Button')).toEqual([])
      expect(bars[0]?.text).not.toMatch(/[▾▸]/)
    }
    await ui.unmount()
  }
})

test('the rail passes through the glyph\'s centre: on a desktop both are two cells wide, the rail on their boundary; on the terminal both are the first column', TREE, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on, { value: 'running' })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await clock.advance(4_000)
  const desktop = await $.ui.mount({ ...PANE, surface: 'desktop', props: SHORT })
  const glyphs = await desktop.findAll({ type: 'Box', key: 'glyph' })
  const slots = await desktop.findAll({ type: 'Box', key: 'rail' })
  expect(glyphs.length).toBeGreaterThan(0)
  expect(slots.length).toBeGreaterThan(0)
  // Every glyph is centred in two cells, and every rail slot is as wide, its line the bordered Box's left edge at `left` 1.
  for (const one of glyphs) expect(one.props).toMatchObject({ width: 2, justifyContent: 'center' })
  for (const one of slots) {
    expect(one.props.width).toBe(glyphs[0]?.props.width)
    const line = (one.children ?? []).find(child => typeof child === 'object' && (child as { props?: { borderStyle?: string } }).props?.borderStyle === 'single') as { props: Record<string, unknown> } | undefined
    expect(line?.props).toMatchObject({ position: 'absolute', left: 1 })
  }
  await desktop.unmount()
  const terminal = await $.ui.mount({ ...PANE, surface: 'terminal', props: SHORT })
  // The monospaced `│` is one cell in the first column of its row, as the one-cell glyph is: the same column.
  const rail = (await terminal.findAll({ type: 'Text', text: '│' }))[0]!
  const glyph = (await terminal.findAll({ type: 'Text', text: '◉' }))[0]!
  expect([rail.text?.length, glyph.text?.length]).toEqual([1, 1])
  const box = (await terminal.findAll({ type: 'Box' })).find(one => one.text === '│' && one.props.width === 1)
  expect(box).toBeDefined()
  expect((await terminal.findAll({ type: 'Box', key: 'glyph' })).every(one => one.props.width === undefined && one.props.justifyContent === undefined)).toBe(true)
  await terminal.unmount()
})

test('the chart is there at the default 40 rows on the desktop and the terminal, with every part paid for', TREE, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on, { value: 'running' })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await clock.advance(4_000)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface, props: PANE.props })
    expect(await ui.find({ type: surface === 'terminal' ? 'Raster' : 'Svg' })).toBeDefined()
    await ui.unmount()
  }
})

test('the toggle line costs the default pane no chart: the tight tier pays for it with the blank line above THIS SESSION\'s row', () => {
  // 15 lines of heads and ledger tasks that cannot yield, at the default 40 rows: with the toggle's line they are 16.
  const base = { rows: 40, cols: 72, isTerminal: true, hasTree: true, canChart: true, lines: 15, shrink: () => ({ lines: 15, apply: () => {} }), flatLines: 0 }
  const withToggle = sessionsLayout({ ...base, hasFold: true })
  expect(withToggle.hasChart).toBe(true)
  expect(withToggle.headGap).toBe(0)
  expect(withToggle.used).toBeLessThanOrEqual(40)
  // Without a toggle there is nothing to pay for: the blank line stays.
  expect(sessionsLayout(base)).toMatchObject({ hasChart: true, headGap: 1 })
})

test('the layout never takes more rows than the pane has, folded or not, whatever its height, width and surface', () => {
  for (const isTerminal of [true, false]) {
    for (const cols of [40, 60, 100]) {
      for (const rows of [30, 40, 46, 60, 120]) {
        for (const lines of [3, 15]) {
          for (const hasFold of [false, true]) {
            for (const isListCollapsed of hasFold ? [false, true] : [false]) {
              for (const isBoardFolded of [false, true]) {
                const layout = sessionsLayout({ rows, cols, isTerminal, hasTree: true, canChart: true, lines, shrink: budget => ({ lines: Math.min(lines, budget), apply: () => {} }), flatLines: 0, hasFold, isListCollapsed, isBoardFolded })
                // Wherever the chart is drawn the parts never exceed the pane, whatever is folded, the toggle line paid for.
                if (layout.hasChart) expect(layout.used).toBeLessThanOrEqual(rows)
              }
            }
          }
        }
      }
    }
  }
})
