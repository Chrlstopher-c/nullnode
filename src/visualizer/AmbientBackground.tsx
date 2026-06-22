/** Fond ambiant pur CSS/DOM — aucune dépendance WebGL. Sert de couche de base sous la
 * scène Three.js (Canvas transparent) et de fallback quand WebGL échoue (WebKitGTK/NVIDIA).
 * L'app n'est donc jamais noire : grille technique + lueurs phosphor statiques suivant le thème. */
export function AmbientBackground(): React.ReactElement {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <div className="grid-backdrop absolute inset-0 opacity-60" />
      <div className="ambient-static absolute inset-0" />
    </div>
  )
}
