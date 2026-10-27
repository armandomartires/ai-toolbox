import { atom, update } from 'claude-code'
import type { Register } from 'claude-code'

import { kit, recall, remember, syncTheme, watchTheme } from './sigma'

// The engine lists a module's $.state reads and writes from the atoms declared
// in that same file, so each module declares the atoms it uses.
const greeted = atom({ plugin: 'my-mod', key: 'greeted' } as const, 0)

/** Pure logic lives in plain functions, so a test can call it directly. */
export const greeting = (args: string, count: number) =>
  `Hello from my-mod${args.trim() ? `, ${args.trim()}` : ''} (${count} so far).`

/** What `/hello` answered, kept so its row can be drawn as a panel. */
type Hello = { name: string; count: number }

export const register: Register = on => {
  // Every mod draws in SIGMAorbital (sigma.tsx, ADR-0043): its colours follow
  // the host's theme setting, read at the start and on every change.
  watchTheme(on)

  on('session.start', async ($, e, next) => {
    await syncTheme($)
    await $.command.register({ name: 'hello', description: 'Say hello from my-mod', argumentHint: '[name]' })

    return next(e)
  })

  on('command.run', { command: 'hello' }, async ($, e) => {
    const count = await update($, greeted, n => n + 1)

    return { text: remember<Hello>(greeting(e.args, count), { name: e.args.trim(), count }) }
  })

  // The command's row drawn as a panel. A row this session did not answer
  // (after a resume, or a reload) has no kept result and stays text.
  on('ui.render', { component: 'CommandOutput', props: { command: 'hello' } }, async ($, e, next) => {
    const hello = recall<Hello>(e.props.text)
    if (hello === undefined || e.props.isErrored) return next(e)
    const ui = $.ui.resolve(e)
    const { Box } = ui
    const { label, panel, value } = kit(ui, e.surface)
    const width = Math.min(48, e.viewport?.columns ?? 48)

    return panel(
      { title: 'Greeting', code: 'MY-MOD', width },
      <Box flexDirection="row" columnGap={2}>
        {label('Name')}
        {value(hello.name || '—')}
        {label('Count')}
        {value(String(hello.count), 'so far')}
      </Box>,
    )
  })
}
