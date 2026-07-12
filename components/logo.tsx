import Image from "next/image"
import Link from "next/link"
import { cn } from "@/lib/utils"

const sizeMap = {
  sm: { icon: 24, text: "text-lg" },
  md: { icon: 32, text: "text-xl" },
  lg: { icon: 40, text: "text-2xl" },
}

export function Logo({
  size = "md",
  href,
  iconOnly = false,
  className,
}: {
  size?: "sm" | "md" | "lg"
  href?: string
  iconOnly?: boolean
  className?: string
}) {
  const { icon, text } = sizeMap[size]

  const content = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <div className="relative shrink-0">
        <Image
          src="/routemind-logo.png"
          alt="RouteMind logo"
          width={icon}
          height={icon}
          priority
          className="dark:drop-shadow-[0_4px_12px_color-mix(in_srgb,var(--brand-violet)_55%,transparent)] drop-shadow-[0_2px_8px_color-mix(in_srgb,var(--brand-violet)_30%,transparent)] transition-all duration-300"
        />
      </div>
      {!iconOnly && (
        <span className={cn("font-display font-bold tracking-tight", text)}>
          <span className="text-foreground">Route</span>
          <span className="text-gradient-brand">Mind</span>
        </span>
      )}
    </span>
  )

  if (href) {
    return (
      <Link href={href} className="inline-flex" aria-label="RouteMind home">
        {content}
      </Link>
    )
  }

  return content
}
