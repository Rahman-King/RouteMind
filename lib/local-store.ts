// Local, browser-cached persistence for RouteMind.
// Everything a user creates — their account, chats, projects, and per-message
// memory — is stored in localStorage so it survives page reloads "forever"
// (until the browser cache is cleared). No backend / database required.

import type { Chat, Preferences, Project, UserProfile } from "@/lib/types"

const USERS_KEY = "routemind:accounts"
const SESSION_KEY = "routemind:session"
const RESET_KEY = "routemind:pending-reset"
const dataKey = (userId: string) => `routemind:data:${userId}`

export type StoredAccount = {
  profile: UserProfile
  password: string
  preferences: Preferences
}

export type StoredData = {
  chats: Chat[]
  projects: Project[]
}

const isBrowser = () => typeof window !== "undefined"

function read<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore quota / serialization errors — cache is best-effort.
  }
}

/* ---------------------------------- Accounts --------------------------------- */

export function loadAccounts(): StoredAccount[] {
  return read<StoredAccount[]>(USERS_KEY, [])
}

function saveAccounts(accounts: StoredAccount[]) {
  write(USERS_KEY, accounts)
}

export function findAccountByEmail(email: string): StoredAccount | undefined {
  const target = email.trim().toLowerCase()
  return loadAccounts().find((a) => a.profile.email.toLowerCase() === target)
}

export function findAccountById(id: string): StoredAccount | undefined {
  return loadAccounts().find((a) => a.profile.id === id)
}

export function addAccount(account: StoredAccount) {
  const accounts = loadAccounts()
  accounts.push(account)
  saveAccounts(accounts)
}

export function updateAccountProfile(profile: UserProfile) {
  const accounts = loadAccounts()
  const idx = accounts.findIndex((a) => a.profile.id === profile.id)
  if (idx === -1) return
  accounts[idx] = { ...accounts[idx], profile }
  saveAccounts(accounts)
}

export function updateAccountPreferences(id: string, preferences: Preferences) {
  const accounts = loadAccounts()
  const idx = accounts.findIndex((a) => a.profile.id === id)
  if (idx === -1) return
  accounts[idx] = { ...accounts[idx], preferences }
  saveAccounts(accounts)
}

export function updateAccountPassword(id: string, password: string) {
  const accounts = loadAccounts()
  const idx = accounts.findIndex((a) => a.profile.id === id)
  if (idx === -1) return
  accounts[idx] = { ...accounts[idx], password }
  saveAccounts(accounts)
}

/* ---------------------------------- Session ---------------------------------- */

export function getSession(): string | null {
  return read<string | null>(SESSION_KEY, null)
}

export function setSession(userId: string) {
  write(SESSION_KEY, userId)
}

export function clearSession() {
  if (!isBrowser()) return
  window.localStorage.removeItem(SESSION_KEY)
}

/* ------------------------------- Password reset ------------------------------ */

export function setPendingReset(userId: string) {
  write(RESET_KEY, userId)
}

export function getPendingReset(): string | null {
  return read<string | null>(RESET_KEY, null)
}

export function clearPendingReset() {
  if (!isBrowser()) return
  window.localStorage.removeItem(RESET_KEY)
}

/* --------------------------- Per-user chats / projects ----------------------- */

export function loadData(userId: string): StoredData {
  return read<StoredData>(dataKey(userId), { chats: [], projects: [] })
}

export function saveData(userId: string, data: StoredData) {
  write(dataKey(userId), data)
}
