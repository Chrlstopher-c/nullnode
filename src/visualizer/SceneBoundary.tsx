import { Component, type ReactNode } from 'react'
import { AmbientBackground } from './AmbientBackground'

interface Props {
  children: ReactNode
}

interface State {
  crashed: boolean
}

/** Isole la scène WebGL : un crash du Canvas (ex. post-process non supporté par WebKitGTK)
 * ne démonte plus tout l'arbre React — l'UI 2D (login, chat) reste utilisable, fond dégradé. */
export class SceneBoundary extends Component<Props, State> {
  state: State = { crashed: false }

  static getDerivedStateFromError(): State {
    return { crashed: true }
  }

  componentDidCatch(error: unknown): void {
    console.error('[visualizer] scène WebGL crashée — fallback fond statique', error)
  }

  render(): ReactNode {
    if (this.state.crashed) {
      return <AmbientBackground />
    }
    return this.props.children
  }
}
