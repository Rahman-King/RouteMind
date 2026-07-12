"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useApp } from "@/components/app-provider"
import { ChatEmptyState } from "@/components/chat/chat-empty-state"
import { ChatMessage } from "@/components/chat/chat-message"
import { PromptBar } from "@/components/chat/prompt-bar"
import { RoutingMonitor, type RoutingConfig } from "@/components/chat/routing-monitor"
import { Spinner } from "@/components/ui/spinner"

export function ChatPage() {
  const router = useRouter()
  const params = useSearchParams()
  const chatId = params.get("c")
  const { user, chats, getChat, createChat, sendMessage, regenerate } = useApp()

  const [generating, setGenerating] = React.useState(false)
  const [, force] = React.useReducer((x) => x + 1, 0)
  const bottomRef = React.useRef<HTMLDivElement>(null)
  const cancelledRef = React.useRef(false)
  const [routingConfig, setRoutingConfig] = React.useState<RoutingConfig>({
    mode: "automatic",
    forceTier: "auto",
    taskMode: "auto",
    reasoning: 50,
    creativity: 50,
    maxOutput: 2000,
  })
  const [isRoutingMonitorOpen, setIsRoutingMonitorOpen] = React.useState(true)

  const chat = chatId ? getChat(chatId) : undefined

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  })

  const handleSend = async (value: string) => {
    let id = chatId
    if (!id || !getChat(id)) {
      id = createChat()
      router.replace(`/chat?c=${id}`)
    }
    cancelledRef.current = false
    setGenerating(true)
    await sendMessage(id, value, force, routingConfig)
    setGenerating(false)
  }

  const handleRegenerate = async () => {
    if (!chatId) return
    cancelledRef.current = false
    setGenerating(true)
    await regenerate(chatId, force, routingConfig)
    setGenerating(false)
  }

  // A chat id is present in the URL but not yet found — brief loading.
  if (chatId && !chat && chats.length > 0) {
    return (
      <div className="flex h-[calc(100svh-3.5rem)] items-center justify-center">
        <Spinner className="size-7 text-brand-violet" />
      </div>
    )
  }

  const messages = chat?.messages ?? []
  const firstName = user?.name?.split(" ")[0] || "there"
  
  // Get the latest AI status from the last assistant message
  const latestAiStatus = messages
    .filter(m => m.role === "assistant")
    .pop()?.status

  return (
    <div className="flex h-[calc(100svh-3.5rem)]">
      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <ChatEmptyState name={firstName} onPick={handleSend} />
          ) : (
            <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
              {messages.map((m, i) => (
                <ChatMessage
                  key={m.id}
                  message={m}
                  isLast={i === messages.length - 1}
                  onRegenerate={handleRegenerate}
                />
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="sticky bottom-0 px-4 pb-4">
          <div className="mx-auto w-full max-w-3xl">
            <PromptBar
              onSend={handleSend}
              generating={generating}
              onStop={() => {
                cancelledRef.current = true
                setGenerating(false)
              }}
            />
          </div>
        </div>
      </div>

      {/* Routing Monitor Panel */}
      <RoutingMonitor 
        status={latestAiStatus} 
        onConfigChange={setRoutingConfig}
        onOpenChange={setIsRoutingMonitorOpen}
      />
    </div>
  )
}
