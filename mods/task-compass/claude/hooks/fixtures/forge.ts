// Placeholder names only (group/demo, owner/name): a forge project's declaration and its 20.PLAN.md, the forge variant of project-workflow's template.

export const FORGE_PLAN = `# Active Plan (forge tracker)

Where the project stands, right now.

Last updated: 2026-05-02.

## Current state

Demo runs its build on the forge and ships weekly.
The importer is half moved over.

## Open milestone and board

- Milestone: \`S012_Importer\` — move the importer onto the new queue.
- Board: Demo planning board

## Blocked

Waiting on group/demo#14 for the queue credentials.

## Next action

Take group/demo#21 from the board.

## History

Planning files moved to this forge; the old ones are in tag \`pre-forge-migration\` (git show pre-forge-migration:.ai/20.PLAN.md).
`

export const GITLAB_CONF = '# the forge\ntracker = gitlab\ngitlab_project = group/demo\n'

export const GITHUB_CONF = 'tracker = github\ngithub_repo = owner/name\n'
