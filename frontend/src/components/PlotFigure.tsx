import { useEffect, useLayoutEffect, useRef, useState } from 'react'

interface Props {
  /** Builds the chart for a given pixel width. Memoize it (useCallback) so it only reruns on real changes. */
  render: (width: number) => Element
  /** Below this width the chart keeps its size and the container scrolls horizontally. */
  minWidth?: number
  label: string
}

/** Mounts an Observable Plot chart and re-renders it when its container resizes. */
export default function PlotFigure({ render, minWidth = 0, label }: Props) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const el = outer.current
    if (!el) return
    setWidth(Math.floor(el.clientWidth))
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!width || !inner.current) return
    const node = render(Math.max(width, minWidth))
    inner.current.replaceChildren(node)
    return () => node.remove()
  }, [width, minWidth, render])

  return (
    <div ref={outer} className="plot-scroll" role="img" aria-label={label} tabIndex={minWidth ? 0 : undefined}>
      <div ref={inner} />
    </div>
  )
}
