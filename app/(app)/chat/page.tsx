import { Suspense } from "react"
import { ChatPage } from "@/components/chat/chat-page"
import { Spinner } from "@/components/ui/spinner"

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100svh-3.5rem)] items-center justify-center">
          <Spinner className="size-7 text-brand-violet" />
        </div>
      }
    >
      <ChatPage />
    </Suspense>
  )
}
