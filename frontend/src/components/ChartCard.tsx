import { useRef, useState, type ReactNode } from 'react'
import { downloadPng } from '../exports'

interface Props {
  title: string
  /** File name without extension. */
  file: string
  actions?: ReactNode
  children: ReactNode
}

/** A card with a title, optional controls and a "PNG" button that saves the card as an image. */
export default function ChartCard({ title, file, actions, children }: Props) {
  const ref = useRef<HTMLElement>(null)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!ref.current) return
    setBusy(true)
    try {
      await downloadPng(ref.current, `${file}.png`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card" ref={ref}>
      <div className="card-head">
        <h3>{title}</h3>
        <div className="card-actions">
          {actions}
          <button type="button" className="btn small no-export" onClick={save} disabled={busy} aria-label={`Download ${title} as PNG`}>
            {busy ? 'Saving…' : 'PNG'}
          </button>
        </div>
      </div>
      {children}
    </section>
  )
}
