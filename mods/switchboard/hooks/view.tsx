import { atom, read, update } from 'claude-code'
import type { EngineInterface, RenderInput } from 'claude-code'

import type { Kind } from '../types'
import { KINDS, SELF, groupKey, groupRows, isOff, isProtected, pendingNote, shownName, takesEffect } from './model'
import type { ListOutput } from './model'
import { STATUS, color, kit, recall } from './sigma'
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

export const PANE = 'switchboard'
export const TITLE = 'Switchboard'

const HEADINGS: Record<Kind, string> = { mod: 'Mods', skill: 'Skills', connector: 'Connectors' }

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
  const [held, known, gone, shown, named, grouped, closed] = await Promise.all([
    read($, off),
    read($, seen),
    read($, refused),
    read($, open),
    read($, hints),
    read($, topics),
    read($, closedGroups),
  ])

  const row = (kind: Kind, name: string) => {
    const isSelf = kind === 'mod' && name === SELF
    const isOn = !isOff(held, kind, name)
    const note = kind === 'mod' && !isSelf ? pendingNote(held, gone, name) : undefined
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
        {!isClosed && members.map(name => row(kind, name))}
      </Box>
    )
  }

  const section = (kind: Kind) => {
    const names = [...new Set([...known[kind], ...held[kind]])].filter(name => !(kind === 'connector' && isProtected(name)))
    const groups = groupRows(kind, names, grouped)
    const offCount = names.filter(name => isOff(held, kind, name)).length
    const isOpen = shown.includes(kind)
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
        {isOpen && groups.map(one => (one.topic === '' ? one.names.map(name => row(kind, name)) : group(kind, one.topic, one.names)))}
      </Box>
    )
  }

  const allOff = KINDS.reduce((sum, kind) => sum + held[kind].length, 0)
  return (
    <Box flexDirection="column" minHeight={e.props.scroll.bodyRows}>
      {panel({ title: 'Switchboard', code: allOff > 0 ? `${allOff} off` : 'all on', width }, <Box flexDirection="column">{KINDS.map(section)}</Box>)}
    </Box>
  )
}

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
