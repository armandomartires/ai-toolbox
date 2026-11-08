import { atom, read, update } from 'claude-code'
import type { EngineInterface, RenderInput, UiMessageArgument, UiMessageResult } from 'claude-code'

import type { Kind } from '../types'
import { KINDS, SELF, groupKey, groupRows, isOff, isProtected, pendingNote, shownName, takesEffect, versionLine, versionProblems, versionRows } from './model'
import type { ListOutput, VersionRow } from './model'
import { STATUS, color, controlToken, heldOf, kit, recall, resizeAnswer } from './sigma'
import type { Token } from './sigma'
import { saveOff } from './store'

// The same $.state values the hooks write: the engine lists a module's reads
// and writes from atoms declared in that file.
const off = atom({ plugin: 'switchboard', key: 'off' } as const, { mod: [], skill: [], connector: [] })
const seen = atom({ plugin: 'switchboard', key: 'seen' } as const, { mod: [], skill: [], connector: [] })
const refused = atom({ plugin: 'switchboard', key: 'refused' } as const, [])
const open = atom({ plugin: 'switchboard', key: 'open' } as const, ['mod'])
const hints = atom({ plugin: 'switchboard', key: 'hints' } as const, {})
const topics = atom({ plugin: 'switchboard', key: 'topics' } as const, {})
const closedGroups = atom({ plugin: 'switchboard', key: 'closedGroups' } as const, [])
// The rows the person dragged this mod's panels to (ADR-0053), read with `heldOf`, written by `resizeAnswer`.
// What the Versions section compares: the mods the session loaded and the checkout's manifests (inventory.ts writes them).
const loadedMods = atom({ plugin: 'switchboard', key: 'loaded' } as const, {})
const checkout = atom({ plugin: 'switchboard', key: 'checkout' } as const, '')
const manifests = atom({ plugin: 'switchboard', key: 'manifests' } as const, {})
const panelRows = atom({ plugin: 'switchboard', key: 'panelRows' } as const, {})

export const PANE = 'switchboard'
export const TITLE = 'Switchboard'
/** This mod's version, shown in the pane's last line; keep it the same as `claude/.claude-plugin/plugin.json`'s. */
export const VERSION = '0.9.0'
/** The resize handle's `Client` key on the Switchboard panel's bottom edge (ADR-0053). */
export const SWITCHBOARD_HANDLE = 'switchboard-handle'
/** Each of this pane's handles with the fewest rows a drag holds its panel's body at: a section header and a row. */
const MINS = { [SWITCHBOARD_HANDLE]: 4 }

const HEADINGS: Record<Kind, string> = { mod: 'Mods', skill: 'Skills', connector: 'Connectors' }
/** When a switch of each kind takes effect, as the KPI row's captions say it (`takesEffect` in full under each open section). */
const WHEN: Record<Kind, string> = { mod: 'next session', skill: 'next turn', connector: 'at once' }
/** The Versions section's key in `closedGroups`: it folds like a topic, and starts open. */
const VERSIONS_KEY = 'versions'
/** The marks the pane uses, as the footer's legend names them: each glyph in its token, its word in text-3. */
const LEGEND: readonly { id: string; glyph: string; token: Token; word: string }[] = [
  { id: 'off', glyph: STATUS.offline.glyph, token: STATUS.offline.token, word: 'off' },
  { id: 'caution', glyph: STATUS.caution.glyph, token: STATUS.caution.token, word: 'caution' },
]

/**
 * The characters of the pane's tree its toggle rows and topic headers may take. The engine draws a tree within its
 * bounds (100,000 characters serialized; the kit cuts a Pane's text at 100,000 and drops what is past it), and a
 * desktop refuses one past them: it keeps its last drawing, so a header press seemed dead, and a fresh mount had none
 * ("switchboard has not drawn in this pane", TASK-0256). Rows past the budget are not drawn; their group says how many,
 * and how to reach them; topics past it are named in one line (TASK-0257). The rest of the tree (the frame, the KPI
 * row, the section headers, captions, Versions and the legend) fits in what is left.
 */
const ROW_BUDGET = 72_000
/**
 * A toggle row's serialized characters, at most, as drawn on `surface`: measured 1,370 on a desktop (an Svg track, the
 * words, an overlay Button) and 625 on the terminal for a 31-character name, which a row carries five times.
 */
const rowCost = (surface: string, name: string, note: string | undefined) =>
  (surface === 'terminal' ? 520 : 1250) + 6 * name.length + (note === undefined ? 0 : 400 + 2 * note.length)
/**
 * A topic header's serialized characters, at most, as drawn on `surface`: its glyph, title, counts and rule, and on a
 * desktop `pressable`'s overlay Box and blank Button; the title is carried twice, once as figure spaces.
 */
const headCost = (surface: string, topic: string) => (surface === 'terminal' ? 900 : 1700) + 4 * topic.length
/**
 * A Versions row's serialized characters, at most, as drawn on `surface`: the mark, the name, a label and a value
 * per field, and its note (review of 8d92c44: the rows were not paid from the budget, and drew past the bound).
 */
const versionCost = (surface: string, name: string, note: string | undefined) =>
  (surface === 'terminal' ? 600 : 900) + 4 * name.length + (note === undefined ? 0 : 350 + 2 * note.length)

/** A header's counts: how many, and how many of them are off. */
const countsOf = (all: number, offCount: number) => `${all}${offCount > 0 ? ` · ${STATUS.offline.glyph} ${offCount} OFF` : ''}`

/** A list with `key` added, or taken out when it is there. */
const flipped = (list: readonly string[], key: string) => (list.includes(key) ? list.filter(k => k !== key) : [...list, key])

/**
 * The pane, SIGMAorbital's region as Compass and Agents draw theirs (ADR-0043, TASK-0257): one bracketed panel,
 * a KPI row (MODS, SKILLS, CONNECTORS, OFF), then one section per kind, Mods open and the others behind their
 * header, and a row per item with a switch that flips it. Mods and Skills sit in groups by topic (a mod's
 * `category`, a skill's plugin), each behind its own header; connectors are one flat list. Versions folds like a
 * topic. The legend and the version line close it.
 *
 * Brightness is the hierarchy: the panel's title, then a section's title in text-1, a topic's in text-3, a row's
 * name in text-2 (text-3 when off); colour only for state, beside its glyph. Every header is a `pressable`, its
 * fold glyph in `controlToken()` as Compass's fold toggles are: a desktop draws a Button's words in its own colour.
 * Each row is SIGMAorbital's Toggle (`kit().toggle`), the square switch of `TASK-0256`.
 */
export const renderPane = async ($: EngineInterface, e: RenderInput<'Pane'>) => {
  const ui = $.ui.resolve(e)
  const { Box, Text } = ui
  const { innerWidth, label, panel, pressable, rule, stats, toggle, value } = kit(ui, e.surface)
  const width = Math.max(20, e.props.bodyColumns)
  // The bracketed frame holds what is four cells narrower than the pane.
  const body = innerWidth(width)
  const control = controlToken()
  const [held, known, gone, shown, named, grouped, closed, sized, running, repo, versions] = await Promise.all([
    read($, off),
    read($, seen),
    read($, refused),
    read($, open),
    read($, hints),
    read($, topics),
    read($, closedGroups),
    read($, panelRows),
    read($, loadedMods),
    read($, checkout),
    read($, manifests),
  ])
  // The body's rows when it sizes itself, counted as `section`, `group` and `row` draw them: where a drag starts (ADR-0053).
  let bodyRows = 0
  // What the toggle rows and topic headers may still take of the tree (ROW_BUDGET); once one does not fit, none after it is drawn.
  let budget = ROW_BUDGET

  // A header: the fold glyph in the control token and the title, pressed through `pressable` (words as Texts, a
  // blank Button over them on a desktop, TASK-0241), then the counts in text-3 tabular. A section's title is text-1
  // semibold; a topic's an uppercase text-3 label with a rule in `line` across what is left of the width.
  const header = (key: string, isOpen: boolean, title: string, counts: string, flip: () => void, isTopic: boolean) => {
    const glyph = isOpen ? '▾' : '▸'
    const words = ` ${title.toUpperCase()}`
    const spare = body - glyph.length - words.length - counts.length - 2
    // Keyed `<key>-head`, the row a test reads the header's words from: a Text keeps no key.
    return (
      <Box key={`${key}-head`} flexDirection="row">
        {pressable({ key, label: `${glyph}${words}`, token: control, onPress: flip }, [
          <Text color={color(control)}>{glyph}</Text>,
          isTopic ? (
            <Text color={color('text-3')} size="caption" wrap="truncate-end">{words}</Text>
          ) : (
            <Text color={color('text-1')} weight="semibold" wrap="truncate-end">{words}</Text>
          ),
        ])}
        <Box flexShrink={0} marginLeft={1}>
          <Text color={color('text-3')} size="caption" tabular>{counts}</Text>
        </Box>
        {isTopic && (
          <Box flexShrink={1} marginLeft={1}>
            {rule(Math.max(1, spare))}
          </Box>
        )}
      </Box>
    )
  }

  const row = (kind: Kind, name: string) => {
    const isSelf = kind === 'mod' && name === SELF
    const isOn = !isOff(held, kind, name)
    const note = kind === 'mod' && !isSelf ? pendingNote(held, gone, name) : undefined
    bodyRows += note === undefined ? 1 : 2
    const press = () => void saveOff($, kind, name, isOn).catch(() => undefined)

    // The design's Toggle (SIGMAorbital): the square switch, the name and its
    // state word. switchboard's own row is a disabled one that reads ALWAYS ON.
    return (
      <Box flexDirection="column">
        <Box flexDirection="row">
          {toggle({ key: `${kind}-${name}`, label: shownName(kind, name, named), isOn, onPress: isSelf ? undefined : press, onText: isSelf ? 'always on' : undefined })}
        </Box>
        {note !== undefined && (
          <Box flexDirection="row">
            <Text color={color('status-caution')} size="caption">{`  ${STATUS.caution.glyph}`}</Text>
            <Text color={color('status-caution')} size="caption">{` ${note}`}</Text>
          </Box>
        )}
      </Box>
    )
  }

  // The rows of one group or flat section in order while they fit the budget, then one caption naming the rest.
  const rowsOf = (kind: Kind, names: readonly string[]) => {
    const drawn: ReturnType<typeof row>[] = []
    for (const name of names) {
      const isSelf = kind === 'mod' && name === SELF
      const cost = rowCost(e.surface, shownName(kind, name, named), kind === 'mod' && !isSelf ? pendingNote(held, gone, name) : undefined)
      if (cost > budget) {
        budget = 0
        break
      }
      budget -= cost
      drawn.push(row(kind, name))
    }
    const left = names.length - drawn.length
    if (left === 0) return drawn
    bodyRows += 1
    return [
      ...drawn,
      <Text color={color('text-3')} size="caption" wrap="wrap">
        {`+ ${left} more not drawn: the pane holds so many rows at once. Close a section or group above to see them, or run /switchboard on|off ${kind} <name>.`}
      </Text>,
    ]
  }

  // A topic: its header, then its rows unless it is folded.
  const group = (kind: Kind, topic: string, members: readonly string[]) => {
    const key = groupKey(kind, topic)
    const isClosed = closed.includes(key)
    const offCount = members.filter(name => isOff(held, kind, name)).length
    const flip = () => void update($, closedGroups, list => flipped(list, key)).catch(() => undefined)
    bodyRows += 2

    return (
      <Box flexDirection="column" marginTop={1}>
        {header(`group-${key}`, !isClosed, topic, countsOf(members.length, offCount), flip, true)}
        {!isClosed && rowsOf(kind, members)}
      </Box>
    )
  }

  const namesOf = (kind: Kind) => [...new Set([...known[kind], ...held[kind]])].filter(name => !(kind === 'connector' && isProtected(name)))
  const listed = Object.fromEntries(KINDS.map(kind => [kind, namesOf(kind)])) as Record<Kind, string[]>
  const offOf = (kind: Kind) => listed[kind].filter(name => isOff(held, kind, name)).length

  const section = (kind: Kind) => {
    const names = listed[kind]
    const isOpen = shown.includes(kind)
    bodyRows += 2 + (isOpen ? 1 + (names.length === 0 ? 1 : 0) : 0)
    const flip = () => void update($, open, list => (list.includes(kind) ? list.filter(k => k !== kind) : [...list, kind])).catch(() => undefined)
    // The groups in order while their headers fit the budget, then one caption naming the topics left.
    const parts: unknown[] = []
    if (isOpen) {
      const groups = groupRows(kind, names, grouped)
      for (const [i, one] of groups.entries()) {
        if (one.topic === '') {
          parts.push(rowsOf(kind, one.names))
          continue
        }
        const cost = headCost(e.surface, one.topic)
        if (cost > budget) {
          budget = 0
          bodyRows += 1
          const left = groups.slice(i).filter(rest => rest.topic !== '').length
          parts.push(
            <Text color={color('text-3')} size="caption" wrap="wrap">
              {`+ ${left} more topics not drawn: the pane holds so many at once. Close a section or topic above to see them, or run /switchboard on|off ${kind} <name>.`}
            </Text>,
          )
          break
        }
        budget -= cost
        parts.push(group(kind, one.topic, one.names))
      }
    }

    return (
      <Box flexDirection="column" marginTop={1}>
        {header(`section-${kind}`, isOpen, HEADINGS[kind], countsOf(names.length, offOf(kind)), flip, false)}
        {isOpen && <Text color={color('text-3')} size="caption" wrap="wrap">{`Takes effect ${takesEffect[kind]}.`}</Text>}
        {isOpen && names.length === 0 && <Text color={color('text-3')}>None seen yet in this session.</Text>}
        {parts as never}
      </Box>
    )
  }

  // Versions: each mod of this checkout, the version loaded beside the manifest's, a note where they differ or the copy is not this checkout's.
  const rows = versionRows(repo, versions, running)
  const problems = versionProblems(rows)
  // The name column: the longest name, at most half the frame, so the versions line up as a table's values do.
  const nameColumn = Math.max(4, Math.min(Math.floor(body / 2), ...rows.map(one => one.name.length + 1)))
  // A version row as Agents' Selected panel draws a field: an uppercase text-3 label, then the value in text-1 tabular.
  const versionRow = (one: VersionRow) => {
    const line = versionLine(one)
    bodyRows += 1 + (line.note === undefined ? 0 : 1)
    const isOdd = one.isStale || one.isElsewhere
    const fields: (readonly [string, string])[] = one.isLoaded
      ? one.isStale
        ? [['loaded', one.loaded ?? '?'], ['manifest', one.manifest ?? '?']]
        : [['version', one.loaded ?? '—']]
      : one.manifest === undefined
        ? []
        : [['manifest', one.manifest]]

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" columnGap={1}>
          <Box key={`version-${one.name}-mark`} width={1} flexShrink={0}>
            {isOdd && <Text color={color('status-caution')}>{STATUS.caution.glyph}</Text>}
          </Box>
          <Box width={nameColumn} flexShrink={1}>
            <Text color={color('text-2')} wrap="truncate-end">{one.name.toUpperCase()}</Text>
          </Box>
          {fields.map(([word, shownValue]) => (
            <Box flexDirection="row" columnGap={1} flexShrink={0}>
              {label(word)}
              {value(shownValue)}
            </Box>
          ))}
        </Box>
        {line.note !== undefined && (
          <Text color={color(isOdd ? 'status-caution' : 'text-3')} size="caption" wrap="wrap">{`  ${isOdd ? STATUS.caution.glyph : STATUS.offline.glyph} ${line.note}`}</Text>
        )}
      </Box>
    )
  }
  // Paid from the budget as topics and rows are, in drawing order (after MODS): the header, then each row while it fits.
  const versionSection = () => {
    const isOpen = !closed.includes(VERSIONS_KEY)
    const flip = () => void update($, closedGroups, list => flipped(list, VERSIONS_KEY)).catch(() => undefined)
    bodyRows += 2 + (isOpen ? 1 : 0)
    budget = Math.max(0, budget - headCost(e.surface, 'Versions'))
    const drawn: ReturnType<typeof versionRow>[] = []
    for (const one of isOpen ? rows : []) {
      const cost = versionCost(e.surface, one.name, versionLine(one).note)
      if (cost > budget) {
        budget = 0
        break
      }
      budget -= cost
      drawn.push(versionRow(one))
    }
    const left = isOpen ? rows.length - drawn.length : 0
    if (left > 0) bodyRows += 1
    return (
      <Box flexDirection="column" marginTop={1}>
        {header('section-versions', isOpen, 'Versions', `${rows.length}${problems > 0 ? ` · ${STATUS.caution.glyph} ${problems}` : ''}`, flip, false)}
        {isOpen && <Text color={color('text-3')} size="caption" wrap="wrap">Loaded version beside the manifest's, for each mod of this checkout.</Text>}
        {drawn}
        {left > 0 && (
          <Text color={color('text-3')} size="caption" wrap="wrap">
            {`+ ${left} more not drawn: the pane holds so many rows at once. Close a section or group above to see them.`}
          </Text>
        )}
      </Box>
    )
  }

  // The KPI row, as Agents opens its panel: how many of each kind, and how many are off; a value takes no colour, nothing here is out of limits.
  const offTotal = KINDS.reduce((sum, kind) => sum + offOf(kind), 0)
  const allTotal = KINDS.reduce((sum, kind) => sum + listed[kind].length, 0)
  const kpiRow = (
    <Box marginTop={1}>
      {stats(body, [
        ...KINDS.map(kind => ({ label: HEADINGS[kind], value: String(listed[kind].length), caption: WHEN[kind] })),
        { label: 'Off', value: String(offTotal), caption: `of ${allTotal}` },
      ])}
    </Box>
  )
  bodyRows += 4

  // Built in drawing order, MODS, Versions, then the other kinds, so the budget is spent as the pane reads; and before the panel is, so the rows are in `bodyRows` when the handle reads them.
  const [firstKind, ...laterKinds] = KINDS
  const sections = [section(firstKind as Kind)]
  const versioned = rows.length > 0 ? versionSection() : undefined
  sections.push(...laterKinds.map(section))
  // The legend and the version line, as Compass closes its board: each mark's glyph in its token, its word in text-3, the version at the right.
  const footer = (
    <Box marginTop={1} flexDirection="row" flexWrap="wrap" columnGap={2}>
      {LEGEND.map(one => (
        <Box key={`legend-${one.id}`} flexDirection="row">
          <Text color={color(one.token)} size="caption">{one.glyph}</Text>
          <Text color={color('text-3')} size="caption">{` ${one.word.toUpperCase()}`}</Text>
        </Box>
      ))}
      <Box key="switchboard-version" flexGrow={1} justifyContent="flex-end">
        <Text color={color('text-3')} size="caption">{`SWITCHBOARD ${VERSION}`}</Text>
      </Box>
    </Box>
  )
  bodyRows += 2
  return (
    <Box flexDirection="column" minHeight={e.props.scroll.bodyRows}>
      {panel(
        {
          title: 'Switchboard',
          code: offTotal > 0 ? `${offTotal} off` : 'all on',
          width,
          bracketed: true,
          resize: { key: SWITCHBOARD_HANDLE, rows: bodyRows, held: heldOf(sized, e, SWITCHBOARD_HANDLE), min: MINS[SWITCHBOARD_HANDLE] },
        },
        <Box flexDirection="column">
          {kpiRow}
          {sections[0]}
          {versioned}
          {sections.slice(1)}
          {footer}
        </Box>,
      )}
    </Box>
  )
}

/** A drag on the panel's handle: the rows it asks for are held for this surface, or let go back to automatic (ADR-0053). */
export const sizePanels = async ($: EngineInterface, e: UiMessageArgument, next: (e: UiMessageArgument) => Promise<UiMessageResult>) =>
  (await resizeAnswer(e, MINS, fn => update($, panelRows, fn))) ?? next(e)

/**
 * `/switchboard list` as a panel per kind; none for a row this session did
 * not answer (a resume, a reload), which the engine draws as text. A
 * declaration: the engine follows `$` past an import only into one.
 */
export function renderOutput($: EngineInterface, e: RenderInput<'CommandOutput'>) {
  if (e.props.isErrored) return undefined
  const kinds = recall<ListOutput>(e.props.text)
  if (kinds === undefined) return undefined
  const ui = $.ui.resolve(e)
  const { Box, Text } = ui
  const { badge, label, panel } = kit(ui, e.surface)
  const width = Math.min(64, e.viewport?.columns ?? 64)

  return (
    <Box flexDirection="column" rowGap={1}>
      {kinds.map(one =>
        panel(
          { title: HEADINGS[one.kind], code: `${one.rows.filter(row => !row.isOn).length} off`, width },
          <Box flexDirection="column">
            <Text color={color('text-3')} size="caption">{`Takes effect ${one.takesEffect}.`}</Text>
            {one.rows.length === 0 && <Text color={color('text-3')}>None seen yet.</Text>}
            {(one.groups ?? [{ topic: '', rows: one.rows }]).map(part => (
              <Box flexDirection="column">
                {part.topic !== '' && <Box marginTop={1}>{label(part.topic)}</Box>}
                {part.rows.map(row => (
                  <Box flexDirection="row" columnGap={2}>
                    <Box width={8} flexShrink={0}>
                      {row.isSelf ? label('always') : badge(row.isOn ? 'nominal' : 'offline', row.isOn ? 'on' : 'off')}
                    </Box>
                    <Text color={color(row.isOn ? 'text-1' : 'text-3')} wrap="truncate-end">{row.name}</Text>
                  </Box>
                ))}
              </Box>
            ))}
          </Box>,
        ),
      )}
    </Box>
  )
}
