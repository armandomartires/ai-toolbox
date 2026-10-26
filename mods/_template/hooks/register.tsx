import { atom, update } from 'claude-code'
import type { Register } from 'claude-code'

// The engine lists a module's $.state reads and writes from the atoms declared
// in that same file, so each module declares the atoms it uses.
const greeted = atom({ plugin: 'my-mod', key: 'greeted' } as const, 0)

/** Pure logic lives in plain functions, so a test can call it directly. */
export const greeting = (args: string, count: number) =>
  `Hello from my-mod${args.trim() ? `, ${args.trim()}` : ''} (${count} so far).`

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'hello', description: 'Say hello from my-mod', argumentHint: '[name]' })

    return next(e)
  })

  on('command.run', { command: 'hello' }, async ($, e) => {
    const count = await update($, greeted, n => n + 1)

    return { text: greeting(e.args, count) }
  })
}
