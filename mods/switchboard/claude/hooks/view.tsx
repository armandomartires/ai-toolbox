import { atom, read, update } from 'claude-code'
import type { EngineInterface, RenderInput, UiMessageArgument, UiMessageResult } from 'claude-code'

import type { Kind } from '../types'
import { KINDS, SELF, groupKey, groupRows, isOff, isProtected, pendingNote, shownName, takesEffect, versionLine, versionProblems, versionRows } from './model'
import type { ListOutput } from './model'
import { STATUS, color, heldOf, kit, recall, resizeAnswer } from './sigma'
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
export const VERSION = '0.8.2'
/** The resize handle's `Client` key on the Switchboard panel's bottom edge (ADR-0053). */
export const SWITCHBOARD_HANDLE = 'switchboard-handle'
/** Each of this pane's handles with the fewest rows a drag holds its panel's body at: a section header and a row. */
const MINS = { [SWITCHBOARD_HANDLE]: 4 }

const HEADINGS: Record<Kind, string> = { mod: 'Mods', skill: 'Skills', connector: 'Connectors' }

/**
 * The characters of the pane's tree its toggle rows may take. The engine draws a tree within its bounds (100,000
 * characters serialized; the kit cuts a Pane's text at 100,000 and drops what is past it), and a desktop refuses one
 * past them: it keeps its last drawing, so a header press seemed dead, and a fresh mount had none ("switchboard has
 * not drawn in this pane", TASK-0256). Rows past the budget are not drawn; their group says how many, and how to
 * reach them. The rest of the tree (headers, captions, Versions) fits in what is left.
 */
const ROW_BUDGET = 72_000
/**
 * A toggle row's serialized characters, at most, as drawn on `surface`: measured 1,370 on a desktop (an Svg track, the
 * words, an overlay Button) and 625 on the terminal for a 31-character name, which a row carries five times.
 */
const rowCost = (surface: string, name: string, note: string | undefined) =>
  (surface === 'terminal' ? 520 : 1250) + 6 * name.length + (note === undefined ? 0 : 400 + 2 * note.length)

/**
 * The pane: one section per kind, Mods open and the others behind their
 * header, and a row per item with a switch that flips it. Mods and Skills
 * sit in groups by topic (a mod's `category`, a skill's plugin), each behind
 * its own header; connectors are one flat list.
 *
 * Each row is SIGMAorbital's Toggle (`kit().toggle`): a square track
 * drawn in glyphs inside a `plain` Button, then the name and its state
 * word. Only a `Button` takes a press and it holds only strings and Text,
 * and a desktop rounds a bordered Box, so the track is text (`TASK-0187`).
 */
export const renderPane = async ($: EngineInterface, e: RenderInput<'Pane'>) => {
  const ui = $.ui.resolve(e)
  const { Box, Button, Text } = ui
  const { label, panel, rule, toggle } = kit(ui, e.surface)
  const width = Math.max(20, e.props.bodyColumns)
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
  // What the toggle rows may still take of the tree (ROW_BUDGET); once a row does not fit, none after it is drawn.
  let budget = ROW_BUDGET

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

  // A topic's sub-header: a text-3 label under the section's text-1 header,
  // its counts, then a rule in `line` across what is left of the width. A
  // plain Button, so no fill; topics take no colour.
  const group = (kind: Kind, topic: string, members: readonly string[]) => {
    const key = groupKey(kind, topic)
    const isClosed = closed.includes(key)
    const offCount = members.filter(name => isOff(held, kind, name)).length
    const flip = () =>
      void update($, closedGroups, list => (list.includes(key) ? list.filter(k => k !== key) : [...list, key])).catch(() => undefined)
    const head = `${isClosed ? '▸' : '▾'} ${topic}`
    const counts = `${members.length}${offCount > 0 ? ` · ${STATUS.offline.glyph} ${offCount} OFF` : ''}`
    const spare = width - head.length - counts.length - 3
    bodyRows += 2

    return (
      <Box flexDirection="column" marginTop={1}>
        <Box flexDirection="row">
          <Button key={`group-${key}`} plain onPress={flip}>
            {label(head)}
          </Button>
          <Box flexShrink={0} marginLeft={1}>
            <Text color={color('text-3')} size="caption" tabular>{counts}</Text>
          </Box>
          <Box flexShrink={1} marginLeft={1}>
            {rule(Math.max(1, spare))}
          </Box>
        </Box>
        {!isClosed && rowsOf(kind, members)}
      </Box>
    )
  }

  const section = (kind: Kind) => {
    const names = [...new Set([...known[kind], ...held[kind]])].filter(name => !(kind === 'connector' && isProtected(name)))
    const groups = groupRows(kind, names, grouped)
    const offCount = names.filter(name => isOff(held, kind, name)).length
    const isOpen = shown.includes(kind)
    bodyRows += 2 + (isOpen ? 1 + (names.length === 0 ? 1 : 0) : 0)
    const flip = () =>
      void update($, open, list => (list.includes(kind) ? list.filter(k => k !== kind) : [...list, kind])).catch(() => undefined)
    const counts = `${names.length}${offCount > 0 ? ` · ${STATUS.offline.glyph} ${offCount} OFF` : ''}`

    return (
      <Box flexDirection="column" marginTop={1}>
        <Button key={`section-${kind}`} plain onPress={flip}>
          <Text color={color('text-1')} weight="semibold" tabular>{`${isOpen ? '▾' : '▸'} ${HEADINGS[kind].toUpperCase()}  ${counts}`}</Text>
        </Button>
        {isOpen && <Text color={color('text-3')} size="caption" wrap="wrap">{`Takes effect ${takesEffect[kind]}.`}</Text>}
        {isOpen && names.length === 0 && <Text color={color('text-3')}>None seen yet in this session.</Text>}
        {isOpen && groups.map(one => (one.topic === '' ? rowsOf(kind, one.names) : group(kind, one.topic, one.names)))}
      </Box>
    )
  }

  // Versions: each mod of this checkout, the version loaded beside the manifest's, a note where they differ or the copy is not this checkout's.
  const rows = versionRows(repo, versions, running)
  const problems = versionProblems(rows)
  const versionSection = () => {
    bodyRows += 2 + rows.length
    return (
      <Box flexDirection="column" marginTop={1}>
        <Text color={color('text-1')} weight="semibold" tabular>{`VERSIONS  ${rows.length}${problems > 0 ? ` · ${STATUS.caution.glyph} ${problems}` : ''}`}</Text>
        <Text color={color('text-3')} size="caption" wrap="wrap">Loaded version beside the manifest's, for each mod of this checkout.</Text>
        {rows.map(one => {
          const line = versionLine(one)
          bodyRows += line.note === undefined ? 0 : 1
          const isOdd = one.isStale || one.isElsewhere

          return (
            <Box flexDirection="column">
              <Box flexDirection="row" columnGap={1}>
                <Text color={color(isOdd ? 'status-caution' : 'text-1')} wrap="truncate-end">{one.name.toUpperCase()}</Text>
                <Text color={color('text-3')} size="caption" tabular>{line.text}</Text>
              </Box>
              {line.note !== undefined && (
                <Text color={color(isOdd ? 'status-caution' : 'text-3')} size="caption" wrap="wrap">{`  ${isOdd ? STATUS.caution.glyph : STATUS.offline.glyph} ${line.note}`}</Text>
              )}
            </Box>
          )
        })}
      </Box>
    )
  }

  const allOff = KINDS.reduce((sum, kind) => sum + held[kind].length, 0)
  const sections = KINDS.map(section)
  // Drawn before the panel is, so its rows are in `bodyRows` when the handle reads them.
  const versioned = rows.length > 0 ? versionSection() : undefined
  bodyRows += 2
  return (
    <Box flexDirection="column" minHeight={e.props.scroll.bodyRows}>
      {panel(
        {
          title: 'Switchboard',
          code: allOff > 0 ? `${allOff} off` : 'all on',
          width,
          resize: { key: SWITCHBOARD_HANDLE, rows: bodyRows, held: heldOf(sized, e, SWITCHBOARD_HANDLE), min: MINS[SWITCHBOARD_HANDLE] },
        },
        <Box flexDirection="column">{sections[0]}{versioned}{sections.slice(1)}<Box marginTop={1} justifyContent="flex-end"><Text color={color('text-3')} size="caption">{`SWITCHBOARD ${VERSION}`}</Text></Box></Box>,
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
