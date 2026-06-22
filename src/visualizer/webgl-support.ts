/** Vrai si WebGL2 + render targets float sont dispo (requis par le post-process : EffectComposer
 * utilise des buffers half-float, le Bloom mipmapBlur des buffers float). WebKitGTK/NVIDIA ne les
 * fournit pas toujours → monter EffectComposer planterait alors le Canvas. Détection one-shot. */
export function supportsPostProcessing(): boolean {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    if (!gl) return false
    const ok =
      gl.getExtension('EXT_color_buffer_float') !== null ||
      gl.getExtension('EXT_color_buffer_half_float') !== null
    canvas.remove()
    return ok
  } catch (err) {
    console.error('[visualizer] détection WebGL float échouée — post-process désactivé', err)
    return false
  }
}

const SOFTWARE_MARKERS = ['llvmpipe', 'swiftshader', 'software', 'softpipe', 'microsoft basic']

let acceleratedCache: boolean | null = null

/** Vrai si WebGL est accéléré matériellement. WebKitGTK/NVIDIA sous XWayland avec DMABUF désactivé
 * retombe sur llvmpipe (rendu logiciel) → la scène 3D rame à ~2fps : on préfère alors ne pas monter
 * le Canvas et garder le fond CSS fluide. Détection mémoïsée (renderer string via debug_renderer_info). */
export function hasAcceleratedWebGL(): boolean {
  if (acceleratedCache !== null) return acceleratedCache
  try {
    const canvas = document.createElement('canvas')
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null
    if (!gl) { acceleratedCache = false; return false }
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = info
      ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)).toLowerCase()
      : ''
    canvas.remove()
    // renderer vide = pas d'info exposée : on tolère (navigateurs durcis) plutôt que de tout couper.
    acceleratedCache = renderer === '' || !SOFTWARE_MARKERS.some((m) => renderer.includes(m))
    return acceleratedCache
  } catch (err) {
    console.error('[visualizer] détection accélération WebGL échouée — scène 3D désactivée', err)
    acceleratedCache = false
    return false
  }
}
