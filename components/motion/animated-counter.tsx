"use client"

import * as React from "react"

type AnimatedCounterProps = {
  /** The final numeric value to count up to. */
  value: number
  /** Duration of the count-up in milliseconds. */
  duration?: number
  /** Formats the animated number for display (e.g. currency, compact). */
  format?: (n: number) => string
  className?: string
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

/**
 * Counts up from 0 to `value` the first time it scrolls into view, using
 * requestAnimationFrame for a smooth, GPU-light animation. Respects
 * prefers-reduced-motion by jumping straight to the final value.
 */
export function AnimatedCounter({
  value,
  duration = 1200,
  format = (n) => String(Math.round(n)),
  className,
}: AnimatedCounterProps) {
  const ref = React.useRef<HTMLSpanElement | null>(null)
  const [display, setDisplay] = React.useState(0)
  const started = React.useRef(false)

  React.useEffect(() => {
    const el = ref.current
    if (!el) return

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

    const run = () => {
      if (started.current) return
      started.current = true

      if (reduce) {
        setDisplay(value)
        return
      }

      const start = performance.now()
      const tick = (now: number) => {
        const progress = Math.min((now - start) / duration, 1)
        setDisplay(value * easeOutCubic(progress))
        if (progress < 1) requestAnimationFrame(tick)
        else setDisplay(value)
      }
      requestAnimationFrame(tick)
    }

    if (typeof IntersectionObserver === "undefined") {
      run()
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            run()
            observer.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.4 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [value, duration])

  return (
    <span ref={ref} className={className}>
      {format(display)}
    </span>
  )
}
