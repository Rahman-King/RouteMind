"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

type RevealProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Delay in seconds before the reveal animates in. */
  delay?: number
  /** Render as a different element while keeping the reveal behavior. */
  as?: React.ElementType
  /** Only animate the first time it enters the viewport (default true). */
  once?: boolean
}

/**
 * Scroll-triggered reveal. Children start hidden (via the `.reveal` utility)
 * and slide/fade into place once they enter the viewport. Falls back to
 * visible immediately when IntersectionObserver is unavailable.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = "div",
  once = true,
  style,
  ...props
}: RevealProps) {
  const ref = React.useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true)
            if (once) observer.unobserve(entry.target)
          } else if (!once) {
            setVisible(false)
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [once])

  return (
    <Tag
      ref={ref}
      className={cn("reveal", visible && "is-visible", className)}
      style={{ ["--delay" as string]: `${delay}s`, ...style }}
      {...props}
    >
      {children}
    </Tag>
  )
}
