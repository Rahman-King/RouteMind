"use client"

import * as React from "react"
import type { AccentColor, Chat, ChatMessage, Preferences, Project, UserProfile } from "@/lib/types"
import { generateAssistant } from "@/lib/routing"
import * as store from "@/lib/local-store"

const defaultPreferences: Preferences = {
  emailNotifications: true,
  compactMode: false,
  showRoutingDetails: false,
}

type AppContextValue = {
  hydrated: boolean
  ready: boolean
  user: UserProfile | null
  preferences: Preferences
  chats: Chat[]
  projects: Project[]
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>
  setPreference: (key: keyof Preferences, value: boolean) => void
  createChat: () => string
  deleteChat: (id: string) => void
  getChat: (id: string) => Chat | undefined
  renameChat: (id: string, title: string) => void
  sendMessage: (chatId: string, content: string, onUpdate: () => void, routingConfig?: any) => Promise<void>
  regenerate: (chatId: string, onUpdate: () => void, routingConfig?: any) => Promise<void>
  createProject: (name: string, description: string, accent: AccentColor) => void
  deleteProject: (id: string) => void
}

const AppContext = React.createContext<AppContextValue | null>(null)

export function useApp() {
  const ctx = React.useContext(AppContext)
  if (!ctx) throw new Error("useApp must be used within AppProvider")
  return ctx
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = React.useState(false)
  const [ready, setReady] = React.useState(false)
  const [user, setUser] = React.useState<UserProfile | null>(null)
  const [preferences, setPreferences] = React.useState<Preferences>(defaultPreferences)
  const [chats, setChats] = React.useState<Chat[]>([])
  const [projects, setProjects] = React.useState<Project[]>([])

  const chatsRef = React.useRef(chats)
  chatsRef.current = chats

  // Initialize with a default guest user on first mount
  React.useEffect(() => {
    const guestUser: UserProfile = {
      id: crypto.randomUUID(),
      name: "Guest",
      email: "guest@routemind.com",
      avatarUrl: "",
      bio: "",
    }
    setUser(guestUser)
    setHydrated(true)
    setReady(true)
  }, [])

  // Persist chats & projects to the cache whenever they change (debounced so
  // streaming responses don't thrash localStorage).
  React.useEffect(() => {
    if (!user) return
    const id = window.setTimeout(() => {
      store.saveData(user.id, { chats, projects })
    }, 250)
    return () => window.clearTimeout(id)
  }, [user, chats, projects])

  const updateProfile = React.useCallback(async (patch: Partial<UserProfile>) => {
    setUser((prev) => {
      if (!prev) return prev
      const next = { ...prev, ...patch }
      return next
    })
  }, [])

  const setPreference = React.useCallback((key: keyof Preferences, value: boolean) => {
    setPreferences((prev) => {
      const next = { ...prev, [key]: value }
      return next
    })
  }, [])

  const createChat = React.useCallback(() => {
    const id = crypto.randomUUID()
    const chat: Chat = { id, title: "New chat", createdAt: Date.now(), messages: [] }
    setChats((prev) => [chat, ...prev])
    return id
  }, [])

  const deleteChat = React.useCallback((id: string) => {
    setChats((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const getChat = React.useCallback((id: string) => chats.find((c) => c.id === id), [chats])

  const renameChat = React.useCallback((id: string, title: string) => {
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)))
  }, [])

  const runAssistant = React.useCallback(
    async (chatId: string, prompt: string, onUpdate: () => void, routingConfig?: any) => {
      const assistantId = crypto.randomUUID()

      // Insert an empty assistant bubble to stream into.
      setChats((prev) =>
        prev.map((c) =>
          c.id === chatId
            ? { ...c, messages: [...c.messages, { id: assistantId, role: "assistant", content: "" }] }
            : c,
        ),
      )
      onUpdate()

      const chat = chatsRef.current.find((c) => c.id === chatId)
      // Filter out the empty assistant bubble we just added
      const history = chat 
        ? chat.messages.filter((m) => m.id !== assistantId)
        : []

      let result
      try {
        // Real Fireworks call — returns the generated text plus ACTUAL usage.
        result = await generateAssistant(prompt, history, routingConfig)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Something went wrong generating a response."
        setChats((prev) =>
          prev.map((c) =>
            c.id === chatId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: `⚠️ ${message}`, createdAt: Date.now() }
                      : m,
                  ),
                }
              : c,
          ),
        )
        onUpdate()
        return
      }

      const { text, status } = result

      // Type out the real response for a smooth reading experience.
      const words = text.split(/(\s+)/)
      let acc = ""
      for (const word of words) {
        acc += word
        setChats((prev) =>
          prev.map((c) =>
            c.id === chatId
              ? { ...c, messages: c.messages.map((m) => (m.id === assistantId ? { ...m, content: acc } : m)) }
              : c,
          ),
        )
        onUpdate()
        await wait(12)
      }

      setChats((prev) =>
        prev.map((c) =>
          c.id === chatId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === assistantId ? { ...m, content: text, status, createdAt: Date.now() } : m,
                ),
              }
            : c,
        ),
      )
      onUpdate()
    },
    [],
  )

  const sendMessage = React.useCallback(
    async (chatId: string, content: string, onUpdate: () => void, routingConfig?: any) => {
      const userMsgId = crypto.randomUUID()
      const userMsg: ChatMessage = { id: userMsgId, role: "user", content, createdAt: Date.now() }

      setChats((prev) =>
        prev.map((c) => {
          if (c.id !== chatId) return c
          const isFirst = c.messages.length === 0
          return {
            ...c,
            title: isFirst ? content.slice(0, 40) : c.title,
            messages: [...c.messages, userMsg],
          }
        }),
      )
      onUpdate()

      await runAssistant(chatId, content, onUpdate, routingConfig)
    },
    [runAssistant],
  )

  const regenerate = React.useCallback(
    async (chatId: string, onUpdate: () => void, routingConfig?: any) => {
      const chat = chatsRef.current.find((c) => c.id === chatId)
      if (!chat) return
      const lastUser = [...chat.messages].reverse().find((m) => m.role === "user")
      if (!lastUser) return

      const last = chat.messages[chat.messages.length - 1]
      if (last?.role === "assistant") {
        setChats((prev) =>
          prev.map((c) => {
            if (c.id !== chatId) return c
            const msgs = [...c.messages]
            msgs.pop()
            return { ...c, messages: msgs }
          }),
        )
      }
      onUpdate()
      await runAssistant(chatId, lastUser.content, onUpdate, routingConfig)
    },
    [runAssistant],
  )

  const createProject = React.useCallback(
    (name: string, description: string, accent: AccentColor) => {
      const id = crypto.randomUUID()
      const project: Project = { id, name, description, accent, createdAt: Date.now() }
      setProjects((prev) => [project, ...prev])
    },
    [],
  )

  const deleteProject = React.useCallback((id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const value = React.useMemo<AppContextValue>(
    () => ({
      hydrated,
      ready: hydrated && (user ? ready : true),
      user,
      preferences,
      chats,
      projects,
      updateProfile,
      setPreference,
      createChat,
      deleteChat,
      getChat,
      renameChat,
      sendMessage,
      regenerate,
      createProject,
      deleteProject,
    }),
    [
      hydrated,
      ready,
      user,
      preferences,
      chats,
      projects,
      updateProfile,
      setPreference,
      createChat,
      deleteChat,
      getChat,
      renameChat,
      sendMessage,
      regenerate,
      createProject,
      deleteProject,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
