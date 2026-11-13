# Dashboard ownership

ai-toolbox owns this directory. It was copied from the `sigma-llmwiki`
repository at commit `3d2c117`; that repository was retired on 2026-11-13 and is
no longer part of this project, so there is no upstream to sync with and no
per-file hash to keep. Edit these files here, as ADR-0066 (as amended) says;
change the reader together with `scripts/check-dashboard.sh` and its fixtures.

`scripts/vendor-skill.sh` is unrelated: it vendors the whole skill into OTHER
repositories and writes that skill-level `VENDORED.md` there.
