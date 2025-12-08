// Simple client-side block list storage + helpers (UX-only). Uses localStorage for persistence.

const STORAGE_KEY = 'swarmchat_block_list'
import { MatrixClient } from 'matrix-js-sdk'

const ACCOUNT_DATA_EVENT = 'io.swarmchat.block_list'

const MUTE_ACCOUNT_DATA_EVENT = 'io.swarmchat.mute_list'

export function getBlocked(): string[] {
  try {
    if (typeof window === 'undefined') return []
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as string[]
  } catch (_) {
    return []
  }
}

export function isBlocked(userId?: string | null) {
  if (!userId) return false
  const list = getBlocked()
  return list.includes(userId)
}

export function addBlocked(userId: string) {
  if (!userId) return
  const list = getBlocked()
  if (list.includes(userId)) return
  list.push(userId)
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list)) } catch (_) {}
}

export function removeBlocked(userId: string) {
  if (!userId) return
  const list = getBlocked().filter(x => x !== userId)
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list)) } catch (_) {}
}

// Server-backed helpers using matrix-js-sdk client where available.
// Each of these will fall back to the local-storage variant if the client is not provided
export async function getBlockedFromServer(client?: MatrixClient | null): Promise<string[]> {
  try {
    if (!client || typeof client.getAccountData !== 'function') return getBlocked()
    const ev = client.getAccountData(ACCOUNT_DATA_EVENT)
    const content = ev?.getContent ? ev.getContent() : (ev as any)?.content ?? (ev as any)
    if (!content) return getBlocked()
    // content may either be { blocked: [..] } or directly an array
    const list = Array.isArray(content?.blocked) ? content.blocked : Array.isArray(content) ? content : []
    return list
  } catch (_) {
    return getBlocked()
  }
}

export async function setBlockedToServer(client: MatrixClient | null, list: string[]): Promise<boolean> {
  try {
    if (!client || typeof client.setAccountData !== 'function') {
      // fallback to local
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list)) } catch (_) {}
      return true
    }
    await client.setAccountData(ACCOUNT_DATA_EVENT, { blocked: list })
    return true
  } catch (_) {
    return false
  }
}

export async function addBlockedToServer(client: MatrixClient | null, userId: string): Promise<string[]> {
  if (!userId) return getBlocked()
  const list = await getBlockedFromServer(client)
  if (!list.includes(userId)) list.push(userId)
  await setBlockedToServer(client, list)
  return list
}

export async function removeBlockedFromServer(client: MatrixClient | null, userId: string): Promise<string[]> {
  if (!userId) return getBlocked()
  const list = (await getBlockedFromServer(client)).filter(x => x !== userId)
  await setBlockedToServer(client, list)
  return list
}

// ----- MUTE LIST APIs (server-backed + local fallback) -----
export function getMuted(): string[] {
  try {
    if (typeof window === 'undefined') return []
    const raw = window.localStorage.getItem('swarmchat_mute_list')
    if (!raw) return []
    return JSON.parse(raw) as string[]
  } catch (_) {
    return []
  }
}

export function isMuted(userId?: string | null) {
  if (!userId) return false
  const list = getMuted()
  return list.includes(userId)
}

export function addMuted(userId: string) {
  if (!userId) return
  const list = getMuted()
  if (list.includes(userId)) return
  list.push(userId)
  try { window.localStorage.setItem('swarmchat_mute_list', JSON.stringify(list)) } catch (_) {}
}

export function removeMuted(userId: string) {
  if (!userId) return
  const list = getMuted().filter(x => x !== userId)
  try { window.localStorage.setItem('swarmchat_mute_list', JSON.stringify(list)) } catch (_) {}
}

export async function getMutedFromServer(client?: any): Promise<string[]> {
  try {
    if (!client || typeof client.getAccountData !== 'function') return getMuted()
    const ev = client.getAccountData(MUTE_ACCOUNT_DATA_EVENT)
    const content = ev?.getContent ? ev.getContent() : (ev as any)?.content ?? (ev as any)
    if (!content) return getMuted()
    const list = Array.isArray(content?.muted) ? content.muted : Array.isArray(content) ? content : []
    return list
  } catch (_) {
    return getMuted()
  }
}

export async function setMutedToServer(client: MatrixClient | null, list: string[]): Promise<boolean> {
  try {
    if (!client || typeof client.setAccountData !== 'function') {
      try { window.localStorage.setItem('swarmchat_mute_list', JSON.stringify(list)) } catch (_) {}
      return true
    }
    await client.setAccountData(MUTE_ACCOUNT_DATA_EVENT, { muted: list })
    return true
  } catch (_) {
    return false
  }
}

export async function addMutedToServer(client: MatrixClient | null, userId: string): Promise<string[]> {
  if (!userId) return getMuted()
  const list = await getMutedFromServer(client)
  if (!list.includes(userId)) list.push(userId)
  await setMutedToServer(client, list)
  return list
}

export async function removeMutedFromServer(client: MatrixClient | null, userId: string): Promise<string[]> {
  if (!userId) return getMuted()
  const list = (await getMutedFromServer(client)).filter(x => x !== userId)
  await setMutedToServer(client, list)
  return list
}

export default { getBlocked, isBlocked, addBlocked, removeBlocked }
