/** @jsxImportSource @opentui/solid */
/**
 * task-compass for OpenCode, the TUI part: a sidebar slot listing the current
 * sprint's stories from the session folder's .ai/GOALS.md, one status glyph
 * each, coloured from the OpenCode theme. It reads the file each time the
 * slot draws; it has no pane, carousel or cards (those are the Claude mod's).
 * Written against @opencode-ai/plugin 1.18.30's `tui` module on this host
 * (types/opencode-plugin.d.ts); not yet seen in a live TUI (TASK-0254).
 */
import type { TuiPlugin, TuiThemeCurrent } from '@opencode-ai/plugin/tui'

import type { Status } from './board.ts'
import { sidebarBoard } from './compass.ts'

const tone = (theme: TuiThemeCurrent, status: Status) =>
  status === 'in_progress'
    ? theme.info
    : status === 'review'
      ? theme.warning
      : status === 'blocked'
        ? theme.error
        : status === 'done'
          ? theme.success
          : theme.textMuted

const tui: TuiPlugin = async api => {
  api.slots.register({
    order: 50,
    slots: {
      sidebar_content(ctx) {
        const theme = ctx.theme.current
        const board = sidebarBoard(api.state.path.directory)
        return (
          <box flexDirection="column">
            <text fg={theme.text}>
              <b>Compass</b> {board.title}
            </text>
            {board.rows.map(row => (
              <text fg={tone(theme, row.status)}>
                {row.glyph} <span style={{ fg: theme.text }}>{row.text}</span>
              </text>
            ))}
          </box>
        )
      },
    },
  })
}

export default { id: 'task-compass', tui }
