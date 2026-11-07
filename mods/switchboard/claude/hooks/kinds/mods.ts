import { atom, update } from 'claude-code'
import type { On } from 'claude-code'

import { readManifest } from '../inventory'
import { addSeen, refusal } from '../model'
import { loadOff } from '../store'

const seen = atom({ plugin: 'switchboard', key: 'seen' } as const, { mod: [], skill: [], connector: [] })
const refused = atom({ plugin: 'switchboard', key: 'refused' } as const, [])
const topics = atom({ plugin: 'switchboard', key: 'topics' } as const, {})
const loaded = atom({ plugin: 'switchboard', key: 'loaded' } as const, {})

/**
 * Mods and other plugins: an off one's hooks module is refused as it is
 * about to join the chain. The engine asks the plugins admitted before it,
 * so a plugin that loads before this one is not refused (ADR-0042). Only a
 * person's own plugins (tier `user`) are judged.
 *
 * No `.catch`: a judge that fails lets the plugin join, which is the safe
 * way for a switch to fail.
 */
export const registerMods = (on: On) => {
  on('plugin.register', async ($, e, next) => {
    // A managed plugin is the administrator's, never this switch's.
    if (e.tier !== 'user') return next(e)
    await update($, seen, held => addSeen(held, 'mod', [e.name])).catch(() => undefined)
    // Its topic is the `category` its manifest declares, read at the plugin's root.
    const category = (await readManifest($, e.root).catch(() => undefined))?.category
    if (category !== undefined) await update($, topics, held => ({ ...held, [e.name]: category })).catch(() => undefined)
    const refuse = refusal(await loadOff($), e.name)
    if (refuse !== undefined) {
      await update($, refused, list => (list.includes(e.name) ? list : [...list, e.name])).catch(() => undefined)
      // Refused, it did not load: a version recorded from an earlier load no longer holds.
      await update($, loaded, held => {
        const { [e.name]: _gone, ...kept } = held

        return kept
      }).catch(() => undefined)
      return { refuse }
    }

    // Where it loads from and the version it declares, for the pane's Versions section.
    await update($, loaded, held => ({ ...held, [e.name]: { root: e.root, ...(e.version === undefined ? {} : { version: e.version }) } })).catch(() => undefined)

    return next(e)
  })
}
