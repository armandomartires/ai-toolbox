// PNG export of a pane, and the badge for a drawing that differs from its committed snapshot.
// The pane's DOM is cloned with every element's computed style inlined, wrapped in an SVG
// foreignObject, drawn on a canvas at 2x and downloaded. No libraries, no network: fonts are
// whatever the page already resolved (system fonts), and a font that fails falls back as usual.
;(() => {
  const SCALE = 2
  const XHTML = 'http://www.w3.org/1999/xhtml'

  // Copies the computed style of `from` onto `to`, then walks the children in step.
  function inline(from, to) {
    const cs = getComputedStyle(from)
    let css = ''
    for (let i = 0; i < cs.length; i++) css += `${cs[i]}:${cs.getPropertyValue(cs[i])};`
    to.setAttribute('style', css)
    // Inputs keep their value only as a property.
    if (from instanceof HTMLInputElement) to.setAttribute('value', from.value)
    const a = from.children, b = to.children
    for (let i = 0; i < a.length; i++) if (b[i]) inline(a[i], b[i])
  }

  function toSvg(pane) {
    const rect = pane.getBoundingClientRect()
    const w = Math.ceil(rect.width), h = Math.ceil(rect.height)
    const clone = pane.cloneNode(true)
    inline(pane, clone)
    // The fold marker is a page aid, not part of the pane.
    for (const fold of clone.querySelectorAll('.fold')) fold.remove()
    clone.setAttribute('xmlns', XHTML)
    clone.style.outline = 'none'
    clone.style.margin = '0'
    const xml = new XMLSerializer().serializeToString(clone)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * SCALE}" height="${h * SCALE}" viewBox="0 0 ${w} ${h}">` +
      `<foreignObject x="0" y="0" width="${w}" height="${h}">${xml}</foreignObject></svg>`
    return { svg, w, h }
  }

  function render(pane) {
    const { svg, w, h } = toSvg(pane)
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = w * SCALE
        canvas.height = h * SCALE
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)
        canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('the canvas gave no PNG'))), 'image/png')
      }
      img.onerror = () => reject(new Error('the browser could not draw the pane'))
      // A data: URL keeps the canvas untainted (a blob: SVG with foreignObject taints it in some browsers).
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
    })
  }

  const slug = text => String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'scene'

  function download(blob, name) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.append(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  function decorate(section, pane, drawing, built) {
    let bar = section.querySelector('.controls')
    if (!bar) {
      bar = document.createElement('div')
      bar.className = 'controls'
      section.querySelector('h3').after(bar)
    }
    const png = document.createElement('button')
    png.textContent = 'PNG'
    png.title = 'Download this pane as a PNG (2x)'
    png.onclick = async () => {
      png.disabled = true
      const label = png.textContent
      try {
        const name = `${drawing.mod}-${slug(drawing.scene)}-${drawing.surface}-${drawing.columns}x${drawing.rows}.png`
        download(await render(pane), name)
      } catch (error) {
        png.title = String(error && error.message || error)
        png.textContent = 'PNG failed'
        setTimeout(() => { png.textContent = label; png.disabled = false }, 3000)
        return
      }
      png.disabled = false
    }
    bar.append(png)
    // Only the built drawing is compared with the snapshot; a live one at another size is not.
    if (drawing === built && built.changed) {
      const badge = document.createElement('span')
      badge.className = 'changed-badge'
      badge.textContent = 'CHANGED'
      badge.title = built.diff || 'differs from the committed snapshot'
      badge.style.cssText = 'color:#ffc857;border:1px solid #ffc857;border-radius:4px;padding:0 6px;font-size:11px;letter-spacing:.06em;cursor:help'
      bar.append(badge)
    }
  }

  window.PreviewSnapshot = { decorate }
})()
