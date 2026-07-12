"use client"

import * as React from "react"
import Image from "next/image"
import { Check, Copy, RefreshCw, Volume2, VolumeX } from "lucide-react"
import { toast } from "sonner"
import type { ChatMessage as ChatMessageType } from "@/lib/types"
import { useApp } from "@/components/app-provider"
import { AiStatusPanel } from "@/components/chat/ai-status-panel"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function TypingLoader() {
  return (
    <div className="flex items-center gap-1.5 py-1">
      <span className="size-2 animate-bounce rounded-full bg-brand-violet [animation-delay:-0.3s]" />
      <span className="size-2 animate-bounce rounded-full bg-brand-pink [animation-delay:-0.15s]" />
      <span className="size-2 animate-bounce rounded-full bg-brand-blue" />
    </div>
  )
}

export function ChatMessage({
  message,
  onRegenerate,
  isLast,
}: {
  message: ChatMessageType
  onRegenerate: () => void
  isLast: boolean
}) {
  const { preferences } = useApp()
  const [copied, setCopied] = React.useState(false)
  const [isSpeaking, setIsSpeaking] = React.useState(false)
  const speechRef = React.useRef<SpeechSynthesisUtterance | null>(null)

  const speak = () => {
    if (!window.speechSynthesis) {
      toast.error("Text-to-speech is not supported in your browser")
      return
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      return
    }

    const utterance = new SpeechSynthesisUtterance(message.content)
    utterance.rate = 1
    utterance.pitch = 1
    utterance.volume = 1

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    speechRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }

  React.useEffect(() => {
    return () => {
      if (speechRef.current) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="bg-gradient-brand max-w-[85%] rounded-3xl rounded-br-lg px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap text-white shadow-glow-sm">
          {message.content}
        </div>
      </div>
    )
  }

  const copy = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    toast.success("Copied to clipboard")
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex gap-3">
      <div className="glass mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full">
        <Image
          src="/routemind-logo.png"
          alt="RouteMind"
          width={20}
          height={20}
          className="shrink-0"
        />
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        {message.content ? (
          <div className="text-[15px] leading-relaxed whitespace-pre-wrap text-foreground">
            {message.content}
          </div>
        ) : (
          <TypingLoader />
        )}

        {message.status && (
          <>
            <AiStatusPanel
              status={message.status}
              defaultOpen={preferences.showRoutingDetails}
            />
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full text-muted-foreground"
                aria-label="Copy response"
                onClick={copy}
              >
                {copied ? (
                  <Check className="text-brand-cyan" />
                ) : (
                  <Copy />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className={cn(
                  "rounded-full text-muted-foreground",
                  isSpeaking && "text-brand-violet bg-brand-violet/10"
                )}
                aria-label={isSpeaking ? "Stop speaking" : "Read aloud"}
                onClick={speak}
              >
                {isSpeaking ? (
                  <VolumeX className="animate-pulse" />
                ) : (
                  <Volume2 />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full text-muted-foreground"
                aria-label="Regenerate response"
                onClick={onRegenerate}
                disabled={!isLast}
              >
                <RefreshCw />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
