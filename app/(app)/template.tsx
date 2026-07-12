import type React from "react"

// A template re-mounts on every navigation within this route group, so the
// entrance animation replays each time the user switches pages.
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-transition h-full">{children}</div>
}
