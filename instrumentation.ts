/**
 * Next.js instrumentation hook.
 *
 * In dev mode Next.js compiles routes on-demand (lazily) the first time they
 * are hit, which adds a one-time delay to the first click/request for each
 * route. To avoid that delay showing up mid-session, we "warm" the important
 * routes right after the server boots so their modules are already compiled by
 * the time the user interacts with the app.
 *
 * We warm using a GET request to the POST-only /api/chat route: this compiles
 * the entire route module (the expensive part) and returns a fast 405 without
 * running any model inference or spending API credits.
 */
export async function register() {
  // Only run on the Node.js server runtime, and only in development where
  // on-demand compilation happens. Production builds are fully precompiled.
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  if (process.env.NODE_ENV !== "development") return

  const port = process.env.PORT || "3000"
  const baseUrl = `http://localhost:${port}`

  // Routes to precompile on startup.
  const routesToWarm: Array<{ path: string; method: string }> = [
    { path: "/", method: "GET" },
    { path: "/api/chat", method: "GET" }, // GET on a POST-only route: compiles module, returns 405
  ]

  const warm = async () => {
    await Promise.all(
      routesToWarm.map(async ({ path, method }) => {
        try {
          await fetch(`${baseUrl}${path}`, { method })
          console.log(`[v0] warmed route: ${method} ${path}`)
        } catch {
          // Server may not be listening yet on the very first tick; ignore.
        }
      }),
    )
  }

  // Give the dev server a moment to start listening, then warm the routes.
  setTimeout(() => {
    void warm()
  }, 2000)
}
