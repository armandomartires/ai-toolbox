# Vendored dashboard — do not edit these files here

Every file listed below is a **copy**. The original lives in the
`sigma-llmwiki` repository under `.ai/scripts/` and `.ai/dashboard/`,
and that copy is the one to change. Editing a file here makes the two
diverge, which is the exact failure this manifest exists to catch —
two independently-evolving dashboard generators is how this situation
started (see that repo's ADR-0029).

To update this directory, run **in the source repository**:

```
python .ai/scripts/sync_dashboard_skill.py --target <path-to-ai-toolbox> --write
```

To find out whether the two have drifted, from either side:

```
python .ai/scripts/sync_dashboard_skill.py --target <path-to-ai-toolbox> --check
```

`--check` recomputes every hash below and exits non-zero on any
difference, so “these are in sync” is a claim a command can refute
rather than one somebody remembers making.

| Source commit | Files |
|---|---|
| `d3661d4` | 27 |

| File | sha256 |
|---|---|
| `pm_dashboard.py` | `37fba8a228965a5776186f1b49be964b3cbfd302cb1c238ccbae515fd8a16555` |
| `pm_collect.py` | `58e00963f9e8c0e82c78f91f83cba5b459d8fd412325222d4f0afb64663aa4cb` |
| `pm_metrics.py` | `24ba625eb5ebe98c51c50cbaebaf4ced524c30e6e386eccf7c6ab976fcf45c93` |
| `pm_briefs.py` | `4ff2dc9d99dca16e95d8f16f0965f90c8047b3cf003c2932241f8d72fadbbf54` |
| `pm_corpus_sprint.py` | `aa190da28472b80c8ba1e98c944831145c843a9ef35a15d8487047472d0c5d19` |
| `pm_corpus_migration.py` | `2a32221ff4dba499834ece86719fbcb8d9d5601b5287be92a33a79fc565ee47d` |
| `pm_dashboard_smoke.py` | `13d23e4088a54b5e9148eb3236ed588f59fe687a1969abe2e6ace8ff0310028e` |
| `template.html` | `42625aca387dad7f49b058e49e46624342fd6da1cb9a1d6ce98abb2118a2f8b9` |
| `SCHEMA.md` | `e2452c5f6a76c3b2528f91b5cd4784b15f2f407e16393460649021bc2f2a6997` |
| `css/00-tokens.css` | `1d44a84543e62fa77469bdef46ff0fd9fe28f4af7130ec24b6f14ae63a421a59` |
| `css/10-base.css` | `82752bdf2ee2439f6419c3f81ad8877d1e062c342c4855e03cccd5a1cbed01d3` |
| `css/20-components.css` | `2869aaccec79620ebe89d50b910503d22ac2f13dfe11cda0472d98a776e218c1` |
| `css/30-charts.css` | `2296cd7b93f5c8f2e85442be3eed2ab4c71289c2502d09214a5a6ee52557e168` |
| `css/90-print.css` | `1b15320b0c0950ab94a41f8ceafef9e24e15dc6b435c9de0708035824d452228` |
| `js/00-util.js` | `a345a1727b1df102f05ec6069a988e60cf49fe7e0d1d1f5c76034c6013320d63` |
| `js/10-svg.js` | `8a2b86ccf9b07ab39c66997b3cc0eafa3c93f7d32413e82de2b2e445b9abc445` |
| `js/20-burn.js` | `8725fb7dbb7debe77546b9216366256263afdbb5595b9c1df8cd09ac25ef0d30` |
| `js/21-flow.js` | `0c76142c38ff049a1cde7d39ea41af44a1eac2bdd9fe142bfb19549c5f70ad1f` |
| `js/22-forecast.js` | `b24150541cff1bf4d31ab0dd747c88d2a5ad06ec8ced99787774f8f37077ddf3` |
| `js/23-board.js` | `b1dd0f89daf208c12e6d0789ed52bb1ebfc14e67b30335db1636d04484eb4813` |
| `js/24-deps.js` | `06d6f89e380e6f715a706553c5dfdfa94ecb87d201e8b966ef2a0d15369092c5` |
| `js/25-activity.js` | `580f7687b3264ca55f46077620222b316708a4d9db8324d4e078298104ab5349` |
| `js/26-debt.js` | `c0277f7024d0f622342bb5478536d0f17ae78f005901a2373d8a50a3fd6647a1` |
| `js/27-overview.js` | `5b00e91d7bf6ff64198d71915e5e22f8593c03ab3d7d958e7b77a775ec0b096f` |
| `js/28-backlog.js` | `60404894a585e1a72d4a846c7db6cab98ac4439c7b0d85b60d71f89f411ed914` |
| `js/40-theme.js` | `e15a22e82e5b8b9e83b3d6c336f4c2ff4d87bf5576c3fadecff64ec4215b04fe` |
| `js/90-app.js` | `830d8db17770a36131b90abb7214e01600f2184d1ef2a69fed23bfa7d66bfb75` |
