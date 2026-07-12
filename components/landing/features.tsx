import {
  BarChart3,
  Compass,
  FolderTree,
  MessageSquare,
  ShieldCheck,
  Timer,
  type LucideIcon,
} from "lucide-react"
import { Reveal } from "@/components/motion/reveal"

type Feature = {
  icon: LucideIcon
  title: string
  description: string
}

const features: Feature[] = [
  {
    icon: Compass,
    title: "Smart model routing",
    description:
      "Every prompt is analyzed and routed to the ideal model for the job — automatically.",
  },
  {
    icon: MessageSquare,
    title: "Beautiful chat",
    description:
      "A focused, delightful chat surface with a floating prompt bar built for flow.",
  },
  {
    icon: BarChart3,
    title: "Live analytics",
    description:
      "Track tokens, cost, latency and confidence across every conversation.",
  },
  {
    icon: FolderTree,
    title: "Projects & memory",
    description:
      "Organize work into projects with persistent context and memory.",
  },
  {
    icon: Timer,
    title: "Real-time insight",
    description:
      "See the routing decision, model used and cost of each response instantly.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by default",
    description:
      "Full authentication, protected workspaces and private user profiles.",
  },
]

export function Features() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          Built for a premium AI workflow
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground text-pretty">
          Everything you need to think, build and ship with AI — beautifully.
        </p>
      </Reveal>

      <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, description }, i) => (
          <Reveal
            key={title}
            delay={0.06 * i}
            className="glass sheen lift group rounded-3xl p-6 hover:shadow-glow-sm"
          >
            <div className="bg-gradient-brand mb-5 inline-flex size-12 items-center justify-center rounded-2xl text-white shadow-glow-sm transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-110 group-hover:rotate-3">
              <Icon className="size-6" />
            </div>
            <h3 className="font-display text-lg font-semibold">{title}</h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              {description}
            </p>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
