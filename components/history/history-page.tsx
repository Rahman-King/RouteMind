"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useApp } from "@/components/app-provider"
import { 
  Trash2, 
  Search, 
  MessageSquare, 
  Clock, 
  Coins, 
  DollarSign, 
  ChevronRight,
  Sparkles
} from "lucide-react"
import { Reveal } from "@/components/motion/reveal"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { currency, compactNumber } from "@/lib/format"

export function HistoryPage() {
  const router = useRouter()
  const { ready, chats, deleteChat } = useApp()
  const [searchQuery, setSearchQuery] = React.useState("")
  const [sortBy, setSortBy] = React.useState<"date" | "tokens" | "cost" | "messages">("date")
  const [sortOrder, setSortOrder] = React.useState<"desc" | "asc">("desc")

  // Calculate aggregated stats
  const chatStats = React.useMemo(() => {
    let totalMessages = 0
    let totalTokens = 0
    let totalCost = 0
    let totalSavings = 0

    chats.forEach(chat => {
      totalMessages += chat.messages.length
      chat.messages.forEach(msg => {
        if (msg.role === "assistant" && msg.status) {
          totalTokens += (msg.status.tokensIn || 0) + (msg.status.tokensOut || 0)
          totalCost += msg.status.cost || 0
          totalSavings += msg.status.estimatedSavings?.cost || 0
        }
      })
    })

    return {
      chatsCount: chats.length,
      totalMessages,
      totalTokens,
      totalCost,
      totalSavings
    }
  }, [chats])

  // Process and enrich chats
  const enrichedChats = React.useMemo(() => {
    return chats.map(chat => {
      let messagesCount = chat.messages.length
      let tokens = 0
      let cost = 0
      const tiers = new Set<number>()

      chat.messages.forEach(msg => {
        if (msg.role === "assistant" && msg.status) {
          tokens += (msg.status.tokensIn || 0) + (msg.status.tokensOut || 0)
          cost += msg.status.cost || 0
          if (msg.status.selectedTier !== undefined) {
            tiers.add(msg.status.selectedTier)
          }
        }
      })

      return {
        ...chat,
        messagesCount,
        tokens,
        cost,
        tiers: Array.from(tiers).sort()
      }
    })
  }, [chats])

  // Filter and Sort Chats
  const filteredAndSortedChats = React.useMemo(() => {
    const filtered = enrichedChats.filter(chat => {
      const matchTitle = chat.title.toLowerCase().includes(searchQuery.toLowerCase())
      const matchMessages = chat.messages.some(m => 
        m.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
      return matchTitle || matchMessages
    })

    return filtered.sort((a, b) => {
      let comparison = 0
      if (sortBy === "date") {
        comparison = a.createdAt - b.createdAt
      } else if (sortBy === "tokens") {
        comparison = a.tokens - b.tokens
      } else if (sortBy === "cost") {
        comparison = a.cost - b.cost
      } else if (sortBy === "messages") {
        comparison = a.messagesCount - b.messagesCount
      }

      return sortOrder === "desc" ? -comparison : comparison
    })
  }, [enrichedChats, searchQuery, sortBy, sortOrder])

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortBy(field)
      setSortOrder("desc")
    }
  }

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (confirm("Are you sure you want to delete this chat session?")) {
      deleteChat(id)
      toast.success("Chat session deleted")
    }
  }

  if (!ready) {
    return (
      <div className="flex h-[calc(100svh-3.5rem)] items-center justify-center">
        <Spinner className="size-7 text-brand-violet" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      {/* Header section */}
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight bg-gradient-to-r from-brand-violet to-brand-pink bg-clip-text text-transparent">
            Chat History
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Manage your previous conversations and view operational routing telemetry.
          </p>
        </div>
      </div>

      {/* Aggregate Stats Cards */}
      <Reveal className="mb-8 grid gap-4 grid-cols-2 md:grid-cols-4">
        <div className="glass lift rounded-2xl p-4">
          <div className="flex size-9 items-center justify-center rounded-xl bg-brand-violet/10 text-brand-violet mb-2">
            <MessageSquare className="size-4.5" />
          </div>
          <p className="text-xl font-bold font-display leading-tight">{chatStats.chatsCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Total Chats</p>
        </div>

        <div className="glass lift rounded-2xl p-4">
          <div className="flex size-9 items-center justify-center rounded-xl bg-brand-blue/10 text-brand-blue mb-2">
            <Coins className="size-4.5" />
          </div>
          <p className="text-xl font-bold font-display leading-tight">{compactNumber(chatStats.totalTokens)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Tokens Burned</p>
        </div>

        <div className="glass lift rounded-2xl p-4">
          <div className="flex size-9 items-center justify-center rounded-xl bg-brand-pink/10 text-brand-pink mb-2">
            <DollarSign className="size-4.5" />
          </div>
          <p className="text-xl font-bold font-display leading-tight">{currency(chatStats.totalCost)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Estimated Cost</p>
        </div>

        <div className="glass lift rounded-2xl p-4">
          <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 mb-2">
            <Sparkles className="size-4.5" />
          </div>
          <p className="text-xl font-bold font-display leading-tight">{currency(chatStats.totalSavings)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Routing Savings</p>
        </div>
      </Reveal>

      {/* Search and Filter Controls */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search chats by title or keywords..."
            className="w-full rounded-2xl border border-border bg-muted/30 py-2.5 pl-10 pr-4 text-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:border-brand-violet/50 focus:bg-background"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        {/* Sorting Dropdowns */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleSort("date")}
            className={cn(
              "flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all hover:bg-muted/40",
              sortBy === "date" ? "border-brand-violet/40 bg-brand-violet/5 text-brand-violet" : "border-border bg-muted/20"
            )}
          >
            Date {sortBy === "date" && (sortOrder === "desc" ? "↓" : "↑")}
          </button>
          <button
            onClick={() => toggleSort("tokens")}
            className={cn(
              "flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all hover:bg-muted/40",
              sortBy === "tokens" ? "border-brand-violet/40 bg-brand-violet/5 text-brand-violet" : "border-border bg-muted/20"
            )}
          >
            Tokens {sortBy === "tokens" && (sortOrder === "desc" ? "↓" : "↑")}
          </button>
          <button
            onClick={() => toggleSort("cost")}
            className={cn(
              "flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all hover:bg-muted/40",
              sortBy === "cost" ? "border-brand-violet/40 bg-brand-violet/5 text-brand-violet" : "border-border bg-muted/20"
            )}
          >
            Cost {sortBy === "cost" && (sortOrder === "desc" ? "↓" : "↑")}
          </button>
        </div>
      </div>

      {/* Main Table/List */}
      {filteredAndSortedChats.length === 0 ? (
        <div className="glass rounded-3xl py-16 px-4 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground/80 mb-4">
            <MessageSquare className="size-6" />
          </div>
          <h3 className="font-display text-lg font-bold">No chats found</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
            {searchQuery 
              ? "We couldn't find any chats matching your search query. Try typing something else."
              : "You haven't started any chat sessions yet! Create a new one from the sidebar."}
          </p>
          {!searchQuery && (
            <Link
              href="/chat"
              className="mt-5 inline-flex items-center justify-center rounded-xl bg-brand-violet px-4 py-2 text-sm font-semibold text-white shadow-glow hover:shadow-glow-md hover:bg-brand-violet/90 transition-all"
            >
              Start New Chat
            </Link>
          )}
        </div>
      ) : (
        <div className="glass overflow-hidden rounded-3xl border border-border">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border bg-muted/20 text-xs font-semibold tracking-wider text-muted-foreground/80">
                  <th className="py-4 px-6">Chat Session</th>
                  <th className="py-4 px-6 text-center">Messages</th>
                  <th className="py-4 px-6">Routing Tier</th>
                  <th className="py-4 px-6 text-right">Tokens Used</th>
                  <th className="py-4 px-6 text-right">Cost</th>
                  <th className="py-4 px-6 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredAndSortedChats.map((chat) => (
                  <tr
                    key={chat.id}
                    onClick={() => router.push(`/chat?c=${chat.id}`)}
                    className="group cursor-pointer transition-colors hover:bg-muted/15"
                  >
                    {/* Chat Session & Date */}
                    <td className="py-4 px-6 max-w-xs">
                      <div className="flex items-start gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors group-hover:bg-brand-violet/10 group-hover:text-brand-violet mt-0.5">
                          <MessageSquare className="size-4.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-sm leading-tight text-foreground">
                            {chat.title || "New chat"}
                          </p>
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="size-3" />
                            {new Date(chat.createdAt).toLocaleDateString()} at{" "}
                            {new Date(chat.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Messages Count */}
                    <td className="py-4 px-6 text-center text-sm font-semibold tabular-nums text-foreground/90">
                      {chat.messagesCount}
                    </td>

                    {/* Routing Tiers Used */}
                    <td className="py-4 px-6">
                      <div className="flex flex-wrap gap-1">
                        {chat.tiers.length === 0 ? (
                          <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-xxs font-semibold text-muted-foreground">
                            None
                          </span>
                        ) : (
                          chat.tiers.map((tier) => {
                            let label = `T${tier}`
                            let theme = "bg-muted text-muted-foreground"
                            if (tier === 0) {
                              label = "Cache/Rule"
                              theme = "bg-emerald-500/10 text-emerald-500 border border-emerald-500/15"
                            } else if (tier === 1) {
                              label = "Tier 1 (MiniMax)"
                              theme = "bg-brand-violet/10 text-brand-violet border border-brand-violet/15"
                            } else if (tier === 2) {
                              label = "Tier 2 (Kimi)"
                              theme = "bg-brand-blue/10 text-brand-blue border border-brand-blue/15"
                            }
                            return (
                              <span
                                key={tier}
                                className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-xxs font-bold uppercase tracking-wide", theme)}
                              >
                                {label}
                              </span>
                            )
                          })
                        )}
                      </div>
                    </td>

                    {/* Tokens */}
                    <td className="py-4 px-6 text-right font-mono text-sm tabular-nums text-foreground/80">
                      {chat.tokens > 0 ? compactNumber(chat.tokens) : "—"}
                    </td>

                    {/* Cost */}
                    <td className="py-4 px-6 text-right font-mono text-sm tabular-nums text-foreground/90 font-semibold">
                      {chat.cost > 0 ? currency(chat.cost) : "$0.00"}
                    </td>

                    {/* Delete Action */}
                    <td className="py-4 px-6 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={(e) => handleDelete(chat.id, e)}
                          aria-label="Delete history"
                          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors"
                        >
                          <Trash2 className="size-4" />
                        </button>
                        <ChevronRight className="size-4 text-muted-foreground/30 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
