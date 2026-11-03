// The preview page: the scene list, each scene drawn at its built size, and, when
// served, controls that ask the server for the same scene at another size, on the
// other surface, or after a press (POST /run), drawn in place of the built one.
;(() => {
  const { CELL, draw } = window.PreviewRender
  const data = window.PREVIEW || { scenes: [], errors: ['scenes.js did not load: run scripts/preview-mods.py'] }
  const served = location.protocol.startsWith('http')
  const idOf = s => `${s.mod}/${s.scene}/${s.surface}/${s.columns}x${s.rows}`
  // What the page shows for each built drawing: the built one, or the server's answer to the last request.
  const live = new Map()
  let chosen = null
  try { chosen = sessionStorage.getItem('scene') } catch {}

  function show() {
    const main = document.getElementById('main')
    main.replaceChildren()
    if (data.errors.length) {
      const e = document.createElement('div')
      e.className = 'errors'
      e.textContent = data.errors.join('\n\n')
      main.append(e)
    }
    const list = chosen === null ? data.scenes : data.scenes.filter(s => `${s.mod}/${s.scene}` === chosen)
    for (const built of list) main.append(section(built))
  }

  function section(built) {
    const id = idOf(built)
    const state = live.get(id) || { drawing: built, actions: [], busy: false, error: '' }
    live.set(id, state)
    const s = state.drawing
    const [cw, rh] = CELL[s.surface]
    const wrap = document.createElement('section')
    wrap.className = 'scene'
    wrap.dataset.id = id
    const h = document.createElement('h3')
    h.textContent = `${s.mod} · ${s.scene} · ${s.surface} · ${s.columns}×${s.rows} cells`
    wrap.append(h)
    if (served) wrap.append(controls(built, state))
    const pane = document.createElement('div')
    pane.className = `pane ${s.surface}`
    pane.style.width = s.columns * cw + 'px'
    pane.style.minHeight = s.rows * rh + 'px'
    if (s.error) {
      const e = document.createElement('div')
      e.className = 'errors'
      e.textContent = s.error
      pane.append(e)
    } else {
      // A press names the plugin that drew the Button when it is not the mod's own (a contributed pane); none while a drawing is in flight.
      const press = (key, plugin) => { if (!state.busy) request(built, state, { actions: [...state.actions, plugin && plugin !== s.mod ? { press: key, plugin } : { press: key }] }) }
      pane.append(draw(s.tree, s.surface, served ? press : undefined, s.theme))
    }
    // Where the pane's body ends: what lies below it scrolls.
    const fold = document.createElement('div')
    fold.className = 'fold'
    fold.style.top = s.rows * rh + 'px'
    fold.innerHTML = '<span>pane height</span>'
    pane.append(fold)
    wrap.append(pane)
    // scripts/preview/snapshot.js: a PNG of the pane, and whether the drawing differs from its committed snapshot.
    if (window.PreviewSnapshot) window.PreviewSnapshot.decorate(wrap, pane, s, built)
    return wrap
  }

  function controls(built, state) {
    const c = document.createElement('div')
    c.className = 'controls'
    const s = state.drawing
    const num = (label, value, key) => {
      const l = document.createElement('label')
      const i = document.createElement('input')
      i.type = 'number'
      i.min = key === 'columns' ? 20 : 8
      i.max = key === 'columns' ? 400 : 200
      i.value = value
      i.onchange = () => request(built, state, { [key]: Number(i.value) })
      l.append(label + ' ', i)
      return l
    }
    const surface = document.createElement('select')
    for (const one of ['desktop', 'terminal']) {
      const o = document.createElement('option')
      o.value = o.textContent = one
      o.selected = one === s.surface
      surface.append(o)
    }
    surface.onchange = () => request(built, state, { surface: surface.value })
    const reset = document.createElement('button')
    reset.textContent = 'Built'
    reset.title = 'Back to the built drawing'
    reset.onclick = () => { live.delete(idOf(built)); show() }
    c.append(num('columns', s.columns, 'columns'), num('rows', s.rows, 'rows'), surface, reset)
    if (state.actions.length) {
      const p = document.createElement('span')
      p.className = 'presses'
      p.textContent = 'pressed: ' + state.actions.map(a => a.press).join(' → ')
      c.append(p)
    }
    const note = document.createElement('span')
    note.className = state.busy ? 'busy' : state.drawing !== built ? 'live' : ''
    note.textContent = state.busy ? 'drawing…' : state.error ? state.error : state.drawing !== built ? 'live' : 'built'
    c.append(note)
    return c
  }

  // Asks the server for this scene again: the current size, surface and presses, with `change` applied.
  async function request(built, state, change) {
    const s = state.drawing
    const ask = { mod: s.mod, scene: s.scene, surface: s.surface, columns: s.columns, rows: s.rows, actions: state.actions, ...change }
    state.busy = true
    state.error = ''
    show()
    try {
      const reply = await fetch('run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ask) })
      const answer = await reply.json()
      const drawing = answer.scenes && answer.scenes[0]
      if (!drawing) throw new Error((answer.errors || []).join('\n') || `no drawing came back (${reply.status})`)
      state.drawing = drawing
      state.actions = drawing.actions || []
      if (drawing.error) state.error = drawing.error
    } catch (error) {
      state.error = String(error.message || error)
    }
    state.busy = false
    show()
  }

  function menu() {
    const list = document.getElementById('list')
    list.replaceChildren()
    const all = document.createElement('button')
    all.textContent = 'All scenes'
    all.className = chosen === null ? 'on' : ''
    all.onclick = () => pick(null)
    list.append(all)
    let mod = ''
    const seen = new Set()
    for (const s of data.scenes) {
      if (s.mod !== mod) {
        mod = s.mod
        const h = document.createElement('h2')
        h.textContent = mod
        list.append(h)
      }
      const id = `${s.mod}/${s.scene}`
      if (seen.has(id)) continue
      seen.add(id)
      const b = document.createElement('button')
      b.textContent = s.scene
      b.className = chosen === id ? 'on' : ''
      b.onclick = () => pick(id)
      list.append(b)
    }
  }

  function pick(id) {
    chosen = id
    try { id === null ? sessionStorage.removeItem('scene') : sessionStorage.setItem('scene', id) } catch {}
    menu()
    show()
  }

  document.getElementById('outline').onchange = e => document.body.classList.toggle('outline', e.target.checked)
  document.getElementById('light').onchange = e => document.body.classList.toggle('light', e.target.checked)
  document.getElementById('stamp').textContent = data.stamp ? 'built ' + new Date(Number(data.stamp) * 1000).toLocaleTimeString() : ''
  if (chosen !== null && !data.scenes.some(s => `${s.mod}/${s.scene}` === chosen)) chosen = null
  menu()
  show()

  // Served, the page reloads itself after each rebuild.
  if (served) {
    setInterval(async () => {
      try {
        const now = await (await fetch('version.txt', { cache: 'no-store' })).text()
        if (data.stamp && now.trim() !== data.stamp) location.reload()
      } catch {}
    }, 1000)
  }
})()
