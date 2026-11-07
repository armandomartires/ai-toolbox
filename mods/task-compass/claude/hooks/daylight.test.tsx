import { expect, mock, test } from 'claude-code/testing'
import type { ConfigRow } from 'claude-code'

import { engine } from '../preview/fixtures'
import { TOKENS } from './sigma'

// Daylight on a desktop (TASK-0241): every word the pane draws is a Daylight text token or a status colour at
// 4.5:1 or more, and no Button carries words, since a desktop draws a Button's label in its own colour.

const LIGHT = TOKENS.light
/** Blanks: what a desktop's overlay Button holds over its words (TASK-0241). */
const BLANK = /^ *$/
/** A pressable's words: the Button itself where its text is the words (the terminal), else the Text drawn just before it, which its blank Button lies over (a desktop). */
const wordsNodeAt = <T extends { type: string; text?: string }>(all: T[], at: number): T | undefined => {
  const button = all[at]
  if (button === undefined) return undefined
  if (!BLANK.test(button.text ?? '')) return button
  return all.slice(0, at).reverse().find(one => one.type === 'Text' && !BLANK.test(one.text ?? ''))
}

/** WCAG's contrast of two hex colours, computed here apart from the mods' own. */
const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const lum = (hex: string) => {
  const v = parseInt(hex.slice(1), 16)
  return 0.2126 * lin(((v >> 16) & 255) / 255) + 0.7152 * lin(((v >> 8) & 255) / 255) + 0.0722 * lin((v & 255) / 255)
}
const ratio = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)

/** Text tokens (`white` is the one peak) and the status colours; green only for a signed delta. */
const READABLE = new Set([LIGHT['text-1'], LIGHT['text-2'], LIGHT['text-3'], LIGHT.white, LIGHT.cyan, LIGHT.amber, LIGHT.red, LIGHT.green])

const GOALS = `# Project

## Sprint 1 — Setup
- [x] Scaffold the mod

## Sprint 2 — Timeline
Goal: Show sprints as rails
Dates: 2026-10-26 → 2026-11-06
- [>] Draw the rails
  One color per status
- [ ] Hover cards
- [?] Parse sprints
- [!] Terminal check

## Sprint 3 — Sharing
- [ ] Publish

## Sprint 4 — Later
- [-] Parked
`

const PANE = {
  plugin: 'task-compass',
  component: 'Pane',
  requestId: 'task-compass',
  props: { title: 'Compass', isFocused: false, bodyColumns: 48, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

test('Daylight on a desktop: the Sprints rows, PREV, NEXT, HIDE and an open card are text tokens at 4.5:1; no Button carries words', async ($, on) => {
  mock.clock(on, { now: 1_000 })
  mock.store(on)
  engine(on, GOALS)
  on('config.list', () => ({ value: [{ key: 'theme', value: 'dark' } as ConfigRow] }))
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await $.tool.call({
    tool: 'mcp__ccd_turn__update_plan',
    items: [
      { content: 'Write the model', status: 'completed' },
      { content: 'Render the dots', status: 'in_progress' },
    ],
  } as never)
  await $.command.run({ command: 'compass', args: 'theme light' } as never)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  // Scrolled off the current sprint, so PREV, NEXT and the way back are all drawn; a story's card open.
  await ui.press({ key: 'later' })
  await ui.press({ key: 'st3.1' })

  const tree = await ui.findAll({})
  const keys = tree.filter(one => one.type === 'Button').map(one => String(one.key))
  for (const key of ['earlier', 'current', 's3', 'st3.1', 'fold-s3']) expect(keys, key).toContain(key)
  const all = await ui.findAll({ type: 'Text' })
  tree.forEach((button, at) => {
    if (button.type !== 'Button') return
    // No overlay Button carries words of its own, in `label` or in its text: a desktop draws them, a second copy over the words
    // (ghosting, seen live). The mod sets no `label`; the engine fills it from the one string child, the blanks.
    expect(String(button.props.label ?? ''), String(button.key)).toMatch(BLANK)
    expect(button.text, String(button.key)).toMatch(/^ +$/)
    // Its words are the Text just before it, in a readable token.
    const shown = wordsNodeAt(tree, at)
    expect(shown?.type, String(button.key)).toBe('Text')
    expect(READABLE.has(String(shown?.props.color)), `${shown?.text} ${shown?.props.color}`).toBe(true)
  })
  // The rows the screenshot showed near-white: a sprint's name, a story's, PREV and HIDE.
  expect((await ui.find({ type: 'Text', text: /^↺ / }))?.props.color).toBe(LIGHT['text-2'])
  expect((await ui.find({ type: 'Text', text: /S3 Sharing/ }))?.props.color).toBe(LIGHT['text-2'])
  expect((await ui.find({ type: 'Text', text: /^Publish$/ }))?.props.color).toBe(LIGHT['text-2'])
  expect((await ui.find({ type: 'Text', text: /PREV/ }))?.props.color).toBe(LIGHT['text-2'])
  expect((await ui.find({ type: 'Text', text: '▾ HIDE' }))?.props.color).toBe(LIGHT['text-3'])
  expect(await ui.find({ type: 'Text', text: /^PUBLISH/ })).toBeDefined()

  // Every Text the pane sets a colour on: a readable token, 4.5:1 on surface and on its own fill.
  const coloured = all.filter(one => one.props.color !== undefined)
  expect(coloured.length).toBeGreaterThan(20)
  for (const one of coloured) {
    const hex = String(one.props.color)
    expect(READABLE.has(hex), `${JSON.stringify(one.text)} ${hex}`).toBe(true)
    expect(ratio(hex, LIGHT.surface), `${JSON.stringify(one.text)} on surface`).toBeGreaterThanOrEqual(4.5)
    if (one.props.backgroundColor !== undefined) expect(ratio(hex, String(one.props.backgroundColor)), `${JSON.stringify(one.text)} on its fill`).toBeGreaterThanOrEqual(4.5)
  }
  await ui.unmount()

  // Night ops keeps its control colour: the toggle's words in line-strong, as before.
  await $.command.run({ command: 'compass', args: 'theme dark' } as never)
  const night = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await night.find({ type: 'Text', text: '▾ HIDE' }))?.props.color).toBe(TOKENS.dark['line-strong'])
  await night.unmount()
})

test('the terminal keeps its Buttons: the words inside, in their tokens, in Daylight too', async ($, on) => {
  mock.clock(on, { now: 1_000 })
  mock.store(on)
  engine(on, GOALS)
  on('config.list', () => ({ value: [{ key: 'theme', value: 'light' } as ConfigRow] }))
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const row = await ui.find({ type: 'Button', key: 's2' })
  expect(row?.text).toMatch(/S2 Timeline/)
  expect((row?.children?.[0] as { props: { color: string } }).props.color).toBe(LIGHT['text-1'])
  await ui.unmount()
})
