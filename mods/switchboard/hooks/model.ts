import type { Kind, Names } from '../types'

/** This mod's own name: it is never turned off, whatever the store says. */
export const SELF = 'switchboard'

export const KINDS: readonly Kind[] = ['mod', 'skill', 'connector']

export const EMPTY: Names = { mod: [], skill: [], connector: [] }

/** The `$.store` key holding one project's toggles. */
export const storeKey = (root: string) => `off:${root}`

const strings = (value: unknown) =>
  Array.isArray(value) ? [...new Set(value.filter((v): v is string => typeof v === 'string' && v !== ''))] : []

/** A stored value read as Names, whatever was stored; `switchboard` never off. */
export const asNames = (value: unknown): Names => {
  const held = (value ?? {}) as Partial<Record<Kind, unknown>>

  return {
    mod: strings(held.mod).filter(name => name !== SELF),
    skill: strings(held.skill),
    connector: strings(held.connector),
  }
}

/**
 * The tool-name spelling of a server name: `claude.ai Gmail` is
 * `claude_ai_Gmail` in `mcp__claude_ai_Gmail__create_draft`.
 */
export const toolSpelling = (server: string) => server.replace(/[^A-Za-z0-9_-]/g, '_')

/** Whether `name` of `kind` is off; a server matches in either spelling. */
export const isOff = (off: Names, kind: Kind, name: string) => {
  if (kind === 'mod' && name === SELF) return false
  if (kind === 'connector') return off.connector.some(server => toolSpelling(server) === toolSpelling(name))

  return off[kind].includes(name)
}

/** Turns `name` off when it is on, and on when it is off; `switchboard` stays on. */
export const toggle = (off: Names, kind: Kind, name: string): Names => {
  if (kind === 'mod' && name === SELF) return off
  const has = isOff(off, kind, name)

  return {
    ...off,
    [kind]: has ? off[kind].filter(n => (kind === 'connector' ? toolSpelling(n) !== toolSpelling(name) : n !== name)) : [...off[kind], name],
  }
}

/** Sets `name` of `kind` on or off, as `/switchboard on|off` asks. */
export const setOff = (off: Names, kind: Kind, name: string, wantOff: boolean) =>
  isOff(off, kind, name) === wantOff ? off : toggle(off, kind, name)

/** `seen` with `names` added to `kind`, unchanged (the same object) when none is new. */
export const addSeen = (seen: Names, kind: Kind, names: readonly string[]): Names => {
  const fresh = names.filter(name => name !== '' && !seen[kind].includes(name))

  return fresh.length === 0 ? seen : { ...seen, [kind]: [...seen[kind], ...fresh] }
}

/** The server of an MCP tool's name, `mcp__<server>__<tool>`; undefined for any other tool. */
export const serverOfTool = (tool: string) => {
  const match = /^mcp__(.+?)__.+$/.exec(tool)

  return match?.[1]
}

/** The server a `tool.describe` provider names (`mcp:<server>`); undefined for any other. */
export const serverOfProvider = (plugin: string) => (plugin.startsWith('mcp:') ? plugin.slice(4) : undefined)

/**
 * One entry of the skill listing the model reads: a line `- <name>: ...` at
 * the start of a line, with every line after it up to the next such line.
 */
const ENTRY = /^- (\S+?):(?:\s|$)/

/** The skill names a skill listing's text holds, in order. */
export const listedSkills = (text: string) =>
  text.split('\n').flatMap(line => {
    const name = ENTRY.exec(line)?.[1]
    return name ? [name] : []
  })

/**
 * The listing with every entry of an off skill dropped, its continuation
 * lines included (a description may run over several unindented lines, up
 * to the next entry); the header and every other entry as they were.
 */
export const dropSkills = (text: string, off: readonly string[]) => {
  if (off.length === 0) return text
  let isDropping = false

  return text
    .split('\n')
    .filter(line => {
      const name = ENTRY.exec(line)?.[1]
      if (name) isDropping = off.includes(name)
      return !isDropping
    })
    .join('\n')
}

/**
 * The folders a `CLAUDE_CODE_PLUGIN_DIRS` value names: `;`-separated on
 * Windows, `:`-separated elsewhere (a `;` in the value says which).
 */
export const pluginDirs = (value: string | undefined) =>
  (value ?? '')
    .split(value?.includes(';') ? ';' : ':')
    .map(dir => dir.trim().replace(/[\\/]+$/, ''))
    .filter(dir => dir !== '')

/**
 * When a mod's toggle waits for the next session: turned off while it runs,
 * or on while switchboard refused it. Undefined when the session already
 * matches the toggle.
 */
export const pendingNote = (off: Names, refused: readonly string[], mod: string) => {
  const isRefused = refused.includes(mod)
  if (isOff(off, 'mod', mod) && !isRefused) return 'off from the next session'
  if (!isOff(off, 'mod', mod) && isRefused) return 'on from the next session'
  return undefined
}


/** Why a plugin about to load is refused, or undefined when it may load; `switchboard` always may. */
export const refusal = (off: Names, plugin: string) =>
  plugin !== SELF && isOff(off, 'mod', plugin) ? `turned off for this project in switchboard (/switchboard on mod ${plugin})` : undefined

/** The deny text a blocked call returns to the model. */
export const denyText = (kind: Kind, name: string) =>
  `${kindLabel[kind]} ${name} is turned off for this project in switchboard. Tell the person, who can turn it on with /switchboard on ${kind} ${name}.`

export const kindLabel: Record<Kind, string> = { mod: 'The mod', skill: 'The skill', connector: 'The MCP server' }

/** When a toggle of each kind takes effect, as the pane and the command say it. */
export const takesEffect: Record<Kind, string> = {
  mod: 'from the next session or reload',
  skill: 'from the next turn',
  connector: 'at once for its calls, and from the next turn for its tool list',
}

/** The off entry a server's name matches, in the spelling it was turned off by. */
export const offName = (off: Names, server: string) =>
  off.connector.find(name => toolSpelling(name) === toolSpelling(server)) ?? server

/** What `/switchboard` was asked: open the pane, list, or set one item on or off. */
export type Ask =
  | { kind: 'open' }
  | { kind: 'list' }
  | { kind: 'set'; target: Kind; name: string; wantOff: boolean }
  | { kind: 'usage'; why: string }

const KIND_WORDS: Record<string, Kind> = {
  mod: 'mod', mods: 'mod', plugin: 'mod', plugins: 'mod',
  skill: 'skill', skills: 'skill',
  connector: 'connector', connectors: 'connector', mcp: 'connector', server: 'connector',
}

/** `/switchboard [list | on|off <mod|skill|connector> <name>]` read. */
export const parseArgs = (args: string): Ask => {
  const words = args.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0 || (words.length === 1 && KIND_WORDS[words[0] ?? ''])) return { kind: 'open' }
  if (words[0] === 'list' && words.length === 1) return { kind: 'list' }
  if (words[0] === 'on' || words[0] === 'off') {
    const target = KIND_WORDS[words[1] ?? '']
    const name = words.slice(2).join(' ')
    // A kind or name left out opens the pane, where each row has its toggle.
    if (!target || name === '') return words.length > 2 && !target ? { kind: 'usage', why: `say which kind: mod, skill or connector` } : { kind: 'open' }
    if (target === 'mod' && name === SELF) return { kind: 'usage', why: 'switchboard cannot turn itself off' }
    return { kind: 'set', target, name, wantOff: words[0] === 'off' }
  }

  return { kind: 'usage', why: `unknown: ${words[0]}` }
}

export const USAGE = 'Usage: /switchboard [list | on|off mod|skill|connector <name>]'

/** The text `/switchboard list` answers: each kind, what is seen, what is off. */
export const listText = (off: Names, seen: Names) =>
  KINDS.map(kind => {
    const names = [...new Set([...seen[kind], ...off[kind]])].sort()
    const rows = names.map(name => `  ${isOff(off, kind, name) ? 'off' : 'on '}  ${name}${kind === 'mod' && name === SELF ? ' (always on)' : ''}`)
    return [`${kind}s (${takesEffect[kind]}):`, ...(rows.length > 0 ? rows : ['  none seen yet'])].join('\n')
  }).join('\n')
