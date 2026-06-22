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
