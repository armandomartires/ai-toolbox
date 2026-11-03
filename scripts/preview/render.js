// Draws the test kit's trees (ui.drawn()) the way each surface lays them out.
//
// terminal: a true character grid, as Ink draws it. Every length is whole cells
//   (Space steps are cells: across xs/sm 1, md 2, lg 3, xl 4; down xs/sm 0, md/lg 1,
//   xl 2), a border is box-drawing characters filling the edge cells, a Text wraps
//   ('wrap', the default) or truncates ('end'/'truncate'/'truncate-end', 'middle'/
//   'truncate-middle', 'truncate-start') to the width its Box gives it, in
//   characters, and size and weight are ignored (semibold and bold draw bold).
//   One monospace font with its letter-spacing forced so each character takes
//   exactly one cell; characters outside ASCII (braille, box drawing, blocks) are
//   each set in a one-cell slot, so they line up whatever font supplies them.
// desktop: flexbox. A number is cells of 7.2px by 20px (agent-watch's CELL_PX and
//   ROW_PX); Space steps are px; size tokens are 11/12/13/15/20px; borderStyle
//   'round' has a 6px radius, any other a square corner; a Button that is not
//   plain is a bordered pill.
// Colours: a tree carries the dark theme's resolved hex. Given the scene's theme
//   (the mod's TOKENS: {dark: {token: hex}, light: {...}}), each hex that is a dark
//   token is drawn through a CSS variable the light theme overrides, so the page's
//   `body.light` switch changes it without drawing again.
// An approximation of the surfaces, for layout and content, not pixels.
// `onPress(key)` is called when a Button is clicked, with the Button's key.
window.PreviewRender = (() => {
  const CELL = { desktop: [7.2, 20], terminal: [8, 18] }
  const SPACE_PX = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 }
  const SPACE_ACROSS = { xs: 1, sm: 1, md: 2, lg: 3, xl: 4 }
  const SPACE_DOWN = { xs: 0, sm: 0, md: 1, lg: 1, xl: 2 }
  const SIZE = { caption: 11, footnote: 12, body: 13, heading: 15, title: 20 }
  const WEIGHT = { regular: 400, medium: 500, semibold: 600, bold: 700 }
  const BORDERS = {
    single: '┌─┐│└┘', round: '╭─╮│╰╯', double: '╔═╗║╚╝', bold: '┏━┓┃┗┛',
    singleDouble: '╓─╖║╙╜', doubleSingle: '╒═╕│╘╛', classic: '+-+|++',
  }
  const HEX = /^#[0-9a-f]{6}$/i

  // ---- the theme: dark hex -> a variable that `body.light` overrides ------------------------------------------------

  const themes = new Map()
  let sheet = null

  function themeClass(theme, surface) {
    if (!theme || !theme.dark || !theme.light) return null
    const key = surface + JSON.stringify(theme)
    if (themes.has(key)) return themes.get(key)
    const name = 'pv-t' + themes.size
    const map = new Map()
    for (const token of Object.keys(theme.dark)) {
      const d = String(theme.dark[token]).toLowerCase()
      const l = theme.light[token]
      if (!HEX.test(d) || !l || map.has(d)) continue
      if (String(l).toLowerCase() !== d) map.set(d, String(l))
    }
    const back = surface === 'terminal' ? 'bg' : 'surface'
    const dark = theme.dark, light = theme.light
    const rule = (o, extra) => `--pv-bg: ${o[back] || o.bg || o.surface || 'transparent'}; --pv-fg: ${o['text-1'] || o.ink || 'inherit'};${extra}`
    let lightVars = ''
    for (const [d, l] of map) lightVars += ` --t-${d.slice(1)}: ${l};`
    // An Svg's colours are attributes, which cannot hold a variable: a rule per mapped colour overrides them.
    let svgRules = ''
    for (const d of map.keys()) for (const [attr, prop] of [['fill', 'fill'], ['stroke', 'stroke'], ['stop-color', 'stop-color']]) svgRules += `.${name} [${attr}="${d}" i] { ${prop}: var(--t-${d.slice(1)}, ${d}); }
`
    if (!sheet) { sheet = document.createElement('style'); document.head.append(sheet) }
    sheet.textContent += `.${name} { ${rule(dark, '')} }\nbody.light .${name} { ${rule(light, lightVars)} }\n`
    const entry = { name, map }
    themes.set(key, entry)
    return entry
  }

  // ---- measuring -------------------------------------------------------------------------------------------------

  let letterSpacing = null
  /** The letter-spacing that makes the terminal font's advance exactly one cell. */
  function spacing() {
    if (letterSpacing !== null) return letterSpacing
    const probe = document.createElement('div')
    probe.className = 'pane terminal'
    probe.style.cssText = 'position:absolute;visibility:hidden;left:-9999px;top:0;width:auto;outline:0'
    const span = document.createElement('span')
    span.style.cssText = 'white-space:pre;letter-spacing:0'
    span.textContent = 'M'.repeat(64)
    probe.append(span)
    document.body.append(probe)
    const advance = span.getBoundingClientRect().width / 64
    probe.remove()
    letterSpacing = advance > 0 ? CELL.terminal[0] - advance : 0
    return letterSpacing
  }

  /** Cells a character takes: 2 for East Asian wide and emoji, 0 for combining marks, else 1. */
  function cellsOf(ch) {
    const c = ch.codePointAt(0)
    if (c < 32 || (c >= 0x300 && c <= 0x36f) || c === 0x200b || c === 0xfe0f) return 0
    if ((c >= 0x1100 && c <= 0x115f) || (c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xac00 && c <= 0xd7a3) ||
        (c >= 0xf900 && c <= 0xfaff) || (c >= 0xfe30 && c <= 0xfe6f) || (c >= 0xff00 && c <= 0xff60) ||
        (c >= 0xffe0 && c <= 0xffe6) || (c >= 0x1f300 && c <= 0x1faff) || (c >= 0x20000 && c <= 0x3fffd)) return 2
    return 1
  }
  const widthOf = text => { let n = 0; for (const ch of text) n += cellsOf(ch); return n }

  // ---- drawing ---------------------------------------------------------------------------------------------------

  /** Text into an element: ASCII as it is, any other character in its own cell-wide slot (terminal and Raster). */
  function appendCells(el, text, ctx) {
    if (ctx.surface !== 'terminal' || /^[\x20-\x7e\n\t]*$/.test(text)) { el.append(text); return }
    let run = ''
    const flush = () => { if (run) { el.append(run); run = '' } }
    for (const ch of text) {
      if (/[\x20-\x7e\n\t]/.test(ch)) { run += ch; continue }
      flush()
      const w = cellsOf(ch)
      if (w === 0) { if (el.lastChild) el.lastChild.textContent += ch; continue }
      const slot = document.createElement('i')
      slot.className = 'c'
      if (w !== 1) slot.style.width = w * ctx.cw + 'px'
      slot.textContent = ch
      el.append(slot)
    }
    flush()
  }

  function draw(node, surface, onPress, theme) {
    const [cw, rh] = CELL[surface]
    const entry = themeClass(theme, surface)
    const map = entry ? entry.map : new Map()
    const col = c => {
      if (typeof c !== 'string') return c
      const key = c.toLowerCase()
      return HEX.test(key) && map.has(key) ? `var(--t-${key.slice(1)}, ${key})` : c
    }
    const ctx = { surface, cw, rh, onPress, col, term: surface === 'terminal', pending: [], fragments: api.fragmentsAsRow }
    const root = document.createElement('div')
    root.className = `pv-root ${surface}` + (entry ? ' ' + entry.name : '')
    if (ctx.term) root.style.letterSpacing = spacing() + 'px'
    root.append(build(node, ctx, false))
    if (ctx.pending.length) queueMicrotask(() => truncateAll(ctx))
    return root
  }

  // Lengths. A cell count on the terminal is whole; on the desktop a number is cells of cw by rh, a step px.
  function length(ctx, v, horizontal) {
    if (typeof v === 'number') return (ctx.term ? Math.round(v) : v) * (horizontal ? ctx.cw : ctx.rh) + 'px'
    if (typeof v === 'string' && ctx.term && SPACE_ACROSS[v] !== undefined) return (horizontal ? SPACE_ACROSS[v] : SPACE_DOWN[v]) * (horizontal ? ctx.cw : ctx.rh) + 'px'
    if (typeof v === 'string' && SPACE_PX[v] !== undefined) return SPACE_PX[v] + 'px'
    return v
  }

  function build(node, ctx, inRow) {
    const { surface, col, term, rh } = ctx
    if (typeof node === 'string' || typeof node === 'number') { const t = document.createDocumentFragment(); appendCells(t, String(node), ctx); return t }
    if (!node || typeof node !== 'object') return document.createTextNode('')
    const p = node.props || {}
    const kids = node.children || []
    const x = v => length(ctx, v, true)
    const y = v => length(ctx, v, false)
    let el
    if (node.type === 'Box') {
      el = document.createElement('div')
      el.className = 'box'
      const s = el.style
      s.flexDirection = p.flexDirection || 'row'
      // The test kit draws a JSX fragment (<>{a}{b}</>) as a Box of just flexDirection column; in a row, Ink lays a
      // fragment's children out as the row's own, so such a Box of Text is drawn as a row.
      if (ctx.fragments && inRow && Object.keys(p).length === 1 && p.flexDirection === 'column' && kids.length > 0 &&
          kids.every(k => typeof k === 'string' || (k && k.type === 'Text'))) s.flexDirection = 'row'
      if (p.flexGrow !== undefined) s.flexGrow = p.flexGrow
      s.flexShrink = p.flexShrink !== undefined ? p.flexShrink : 1
      if (p.flexWrap) s.flexWrap = p.flexWrap
      if (p.alignItems) s.alignItems = p.alignItems
      if (p.alignSelf) s.alignSelf = p.alignSelf
      if (p.justifyContent) s.justifyContent = p.justifyContent
      if (p.position) s.position = p.position
      for (const k of ['left', 'right']) if (p[k] !== undefined) s[k] = x(p[k])
      for (const k of ['top', 'bottom']) if (p[k] !== undefined) s[k] = y(p[k])
      if (p.width !== undefined) s.width = x(p.width)
      if (p.minWidth !== undefined) s.minWidth = x(p.minWidth)
      if (p.height !== undefined) s.height = y(p.height)
      if (p.minHeight !== undefined) s.minHeight = y(p.minHeight)
      const gap = p.gap
      if (p.columnGap !== undefined || gap !== undefined) s.columnGap = x(p.columnGap !== undefined ? p.columnGap : gap)
      if (p.rowGap !== undefined || gap !== undefined) s.rowGap = y(p.rowGap !== undefined ? p.rowGap : gap)
      for (const [side, horizontal] of [['Top', false], ['Bottom', false], ['Left', true], ['Right', true]]) {
        for (const kind of ['margin', 'padding']) {
          const v = p[kind + side] ?? (horizontal ? p[kind + 'X'] : p[kind + 'Y']) ?? p[kind]
          if (v !== undefined) s[kind + side] = horizontal ? x(v) : y(v)
        }
      }
      const bc = col(p.borderColor || '#3a4048')
      if (p.borderStyle) {
        if (term) {
          // The border is the edge cells: transparent CSS border for the space, box-drawing characters over it.
          s.border = `solid transparent`
          s.borderWidth = `${rh}px ${ctx.cw}px`
          el.append(frame(p.borderStyle, bc, p.borderDimColor, ctx))
          if (!p.position) s.position = 'relative'
        } else {
          s.border = `1px solid ${bc}`
          if (p.borderStyle === 'round') s.borderRadius = '6px'
        }
      }
      if (p.backgroundColor) s.background = col(p.backgroundColor)
      if (p.overflow && !(term && p.borderStyle)) s.overflow = p.overflow
      if (p.display === 'none') s.display = 'none'
      if (p.key) el.title = p.key
    } else if (node.type === 'Text') {
      el = document.createElement('span')
      el.className = 'txt'
      const s = el.style
      let fg = p.color ? col(p.color) : '', bg = p.backgroundColor ? col(p.backgroundColor) : ''
      if (p.inverse) { const f = fg || 'var(--pv-fg, currentColor)'; fg = bg || 'var(--pv-bg, transparent)'; bg = f }
      if (fg) s.color = fg
      if (bg) s.background = bg
      if (p.dimColor) s.opacity = 0.6
      const w = p.weight ? WEIGHT[p.weight] : p.bold ? 600 : undefined
      if (term) {
        // The terminal draws semibold and bold as bold, and has one size.
        if (w !== undefined) s.fontWeight = w >= 600 ? 700 : 400
      } else {
        if (p.size && SIZE[p.size]) { s.fontSize = SIZE[p.size] + 'px'; s.lineHeight = SIZE[p.size] > 15 ? '24px' : '20px' }
        if (w !== undefined) s.fontWeight = w
        if (p.mono) s.fontFamily = 'ui-monospace, Consolas, monospace'
        if (p.tabular) s.fontVariantNumeric = 'tabular-nums'
      }
      if (p.italic) s.fontStyle = 'italic'
      const deco = [p.underline && 'underline', p.strikethrough && 'line-through'].filter(Boolean).join(' ')
      if (deco) s.textDecoration = deco
      const mode = { truncate: 'end', end: 'end', 'truncate-end': 'end', middle: 'middle', 'truncate-middle': 'middle', 'truncate-start': 'start' }[p.wrap]
      if (mode) {
        s.whiteSpace = 'pre'
        s.overflow = 'hidden'
        if (term && kids.length === 1 && (typeof kids[0] === 'string' || typeof kids[0] === 'number')) {
          ctx.pending.push({ el, text: String(kids[0]), mode })
        } else {
          s.textOverflow = 'ellipsis'
        }
      }
    } else if (node.type === 'Button') {
      el = document.createElement('span')
      el.className = 'btn box' + (p.plain ? ' plain' : '') + (p.variant === 'primary' ? ' primary' : '') + (term ? ' tbtn' : '')
      el.title = `Button ${p.key}${p.hotkey ? ' · ' + p.hotkey : ''}`
      if (p.dimColor) el.style.opacity = 0.6
      if (!kids.length && p.label) appendCells(el, p.label, ctx)
      if (ctx.onPress && p.key) el.onclick = event => { event.stopPropagation(); ctx.onPress(p.key, node.press && node.press.plugin) }
    } else if (node.type === 'Svg') {
      el = document.createElement('div')
      if (term) { el.textContent = p.alt || ''; el.className = 'txt' } else {
        el.innerHTML = p.source || ''
        const svg = el.firstElementChild
        if (svg) { svg.setAttribute('width', p.width); svg.setAttribute('height', p.height) }
        el.title = p.alt || ''
      }
      return el
    } else if (node.type === 'Raster') {
      return raster(p, ctx)
    } else if (node.type === 'Markdown' || node.type === 'Code') {
      el = document.createElement('pre')
      el.textContent = p.text || p.source || p.children || ''
      return el
    } else {
      el = document.createElement('div')
      el.className = 'unknown'
      el.textContent = node.type
    }
    const row = node.type === 'Box' && (el.style.flexDirection === 'row' || el.style.flexDirection === '')
    for (const kid of kids) el.append(build(kid, ctx, row))
    return el
  }

  // A terminal Box's border: its corner, edge and side characters drawn over the cells its CSS border leaves.
  function frame(style, color, dim, ctx) {
    const [tl, h, tr, v, bl, br] = BORDERS[style] || BORDERS.single
    const f = document.createElement('div')
    f.className = 'frame'
    f.style.cssText = `top:${-ctx.rh}px;bottom:${-ctx.rh}px;left:${-ctx.cw}px;right:${-ctx.cw}px;color:${color}` + (dim ? ';opacity:.6' : '')
    const edge = (cls, a, fill, b) => {
      const row = document.createElement('div')
      row.className = 'fr ' + cls
      for (const [cls2, text] of [['k', a], ['f', fill], ['k', b]]) {
        const part = document.createElement('span')
        part.className = cls2
        appendCells(part, text, ctx)
        row.append(part)
      }
      return row
    }
    f.append(edge('top', tl, h.repeat(500), tr), edge('bot', bl, h.repeat(500), br))
    for (const side of ['l', 'r']) {
      const col = document.createElement('div')
      col.className = 'fs ' + side
      appendCells(col, (v + '\n').repeat(200), ctx)
      f.append(col)
    }
    return f
  }

  // After layout, a truncating Text is cut to the cells its Box gave it: Ink's cli-truncate, with the ellipsis in the last cell.
  function truncateAll(ctx) {
    for (const { el, text, mode } of ctx.pending) {
      if (!el.isConnected) continue
      el.replaceChildren()
      appendCells(el, text, ctx)
      const cells = Math.floor(el.clientWidth / ctx.cw + 0.01)
      const chars = Array.from(text)
      if (widthOf(text) <= cells || cells <= 0) continue
      let out
      if (cells === 1) out = '…'
      else if (mode === 'start') out = '…' + take(chars.slice().reverse(), cells - 1).reverse().join('')
      else if (mode === 'middle') {
        const half = Math.floor(cells / 2)
        out = take(chars, half).join('') + '…' + take(chars.slice().reverse(), cells - half - 1).reverse().join('')
      } else out = take(chars, cells - 1).join('') + '…'
      el.replaceChildren()
      appendCells(el, out, ctx)
    }
  }
  function take(chars, cells) {
    const out = []
    let used = 0
    for (const ch of chars) { const w = cellsOf(ch); if (used + w > cells) break; out.push(ch); used += w }
    return out
  }

  // A Raster's cells: 12 bytes each, a code point (u32, little-endian), then fg and bg as r, g, b and a flag (1: the default colour).
  // Each cell is one cell-wide slot of the surface's grid, so a braille or block row cannot drift.
  function raster(p, ctx) {
    const bytes = Uint8Array.from(atob(p.cells || ''), c => c.charCodeAt(0))
    const hex = (r, g, b) => '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('')
    const pre = document.createElement('div')
    pre.className = 'raster'
    pre.style.cssText = `line-height:${ctx.rh}px;font-size:${ctx.term ? 14 : 12}px`
    for (let r = 0; r < p.rows; r++) {
      const line = document.createElement('div')
      line.className = 'rrow'
      line.style.height = ctx.rh + 'px'
      for (let c = 0; c < p.columns; c++) {
        const at = (r * p.columns + c) * 12
        if (at + 12 > bytes.length) break
        const cp = Math.min(0x10ffff, (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24)) >>> 0)
        const span = document.createElement('i')
        span.className = 'c'
        span.style.width = ctx.cw + 'px'
        span.textContent = String.fromCodePoint(cp > 32 ? cp : 32)
        if (bytes[at + 7] !== 1) span.style.color = ctx.col(hex(bytes[at + 4], bytes[at + 5], bytes[at + 6]))
        if (bytes[at + 11] !== 1) span.style.background = ctx.col(hex(bytes[at + 8], bytes[at + 9], bytes[at + 10]))
        line.append(span)
      }
      pre.append(line)
    }
    return pre
  }

  /** The keys of every Button in a tree, in document order. */
  function buttons(node, out = []) {
    if (!node || typeof node !== 'object') return out
    if (node.type === 'Button' && node.props && node.props.key) out.push(node.props.key)
    for (const kid of node.children || []) buttons(kid, out)
    return out
  }

  const api = { CELL, draw, buttons, fragmentsAsRow: true }
  return api
})()
