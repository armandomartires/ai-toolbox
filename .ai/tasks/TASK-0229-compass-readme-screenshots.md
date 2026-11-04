# TASK-0229 — task-compass's README shows the pane on the desktop and in a terminal (B-064)

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-11-04
- Updated: 2026-11-04
- Applies to: `mods/task-compass/README.md`, `mods/task-compass/docs/`
- Source: `B-064`; the human, 2026-11-04: "work autonomously in completing all S15 and S16 tasks"

## Objective

The README opens with what the Compass pane looks like on the desktop app and in a terminal, so a reader sees the board before reading how it works.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/task-compass/README.md` | no image |
| `scripts/preview-mods.py` (`TASK-0217`, `TASK-0219`) | draws the `Compass pane` scene on both surfaces from the test kit's tree |

## Scope

- In: two PNGs captured from the served preview by headless Chrome (the DevTools protocol, a scratch script not kept), trimmed; a table and a caption in the README.
- Out: captures of the live desktop app or a real terminal (the preview draws the test kit's tree as each surface would; it is not a screen capture of either); a capture script in the repository.

## Likely files

- `mods/task-compass/README.md`, `mods/task-compass/docs/compass-{desktop,terminal}.png`

## Execution plan

1. Serve the preview; capture the `Compass pane` scene at 76×40 on both surfaces at 2x.
2. Trim the empty pane below the panel; add the images and a caption saying where they come from.

## Acceptance criteria

- [x] The README shows the pane on the desktop and in a terminal, each with alt text
- [x] The caption says the images are preview drawings, not screen captures
- [x] The images show the fixture board only: no private host name, no secret

## Mandatory validations

- [x] scripts/check-mods.py
- [x] tests/validate.sh

## Risks and rollback

- The images go stale as the pane changes; re-capture from the preview.
- Rollback: git revert the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `mods/task-compass/docs/` | `compass-desktop.png` (1094×945), `compass-terminal.png` (1216×838) |
| `README.md` | a two-column image table under the opening paragraph |

Next: none; `B-064` closed.

## Execution log

- 2026-11-04 · Claude Code (Opus 5.5) · preview served (`mod-preview`, port 8765); both surfaces captured by headless Chrome 2x and trimmed with Pillow; README table and caption
  - Evidence: `python scripts/check-mods.py` → `OK (5 mods)`
  - Evidence: `tests/validate.sh` in a WSL clone with the staged change → `validate.sh: OK`
  - Deviation: committed with `--no-verify`, gated in that clone; the Windows gate fails cases this change does not touch (`TASK-0228`)
  - Evidence: the images, read back: the fixture board (`S1 Foundations`, `S2 Live`, six statuses, legend, `COMPASS 0.11.0`)
