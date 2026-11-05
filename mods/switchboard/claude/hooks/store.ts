import { atom, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { Kind, Names } from '../types'
import { asNames, setOff, storeKey } from './model'

// The engine lists a module's $.state reads and writes from the atoms declared
// in that same file, so each module declares the atoms it uses.
const off = atom({ plugin: 'switchboard', key: 'off' } as const, { mod: [], skill: [], connector: [] })

/**
 * What is off in the session's project now. `$.store` is the truth, read at
 * each use: the project root can move during a session (`/cd`, a desktop
 * host's move), and a hook can run before `session.start`.
 */
export async function loadOff($: EngineInterface): Promise<Names> {
  return asNames(await $.store.get(storeKey(await $.session.root())))
}

/** Mirrors the store into `$.state`, so the pane draws what the hooks read. */
export async function syncOff($: EngineInterface) {
  const held = await loadOff($)
  await update($, off, () => held)

  return held
}

/**
 * Sets one item on or off for the session's project, stores it, mirrors it,
 * and drops the engine's cached answers that hide it, so the next turn
 * reads the change.
 */
export async function saveOff($: EngineInterface, kind: Kind, name: string, wantOff: boolean) {
  const key = storeKey(await $.session.root())
  const held = setOff(asNames(await $.store.get(key)), kind, name, wantOff)
  await $.store.set(key, held)
  await update($, off, () => held)
  $.ui.invalidate('prompt.attachment')
  $.ui.invalidate('tool.describe')

  return held
}
