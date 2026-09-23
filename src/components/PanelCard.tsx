import type { ReactNode } from 'react'

type PanelCardProps = {
  children: ReactNode
  className?: string
}

export function PanelCard({ children, className = '' }: PanelCardProps) {
  return <article className={`rounded-panel border border-line bg-paper/85 shadow-sm ${className}`}>{children}</article>
}
