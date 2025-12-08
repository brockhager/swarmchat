// Simple client-side block list storage + helpers (UX-only). Uses localStorage for persistence.

const STORAGE_KEY = 'swarmchat_block_list'
const ACCOUNT_DATA_EVENT = 'io.swarmchat.block_list'

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
export async function getBlockedFromServer(client?: any): Promise<string[]> {
  try {
    if (!client || !client.getAccountData) return getBlocked()
    const ev = (client as any).getAccountData ? (client as any).getAccountData(ACCOUNT_DATA_EVENT) : null
    const content = ev?.getContent ? ev.getContent() : ev?.content ?? ev
    if (!content) return getBlocked()
    // content may either be { blocked: [..] } or directly an array
    const list = Array.isArray(content?.blocked) ? content.blocked : Array.isArray(content) ? content : []
    return list
  } catch (_) {
    return getBlocked()
  }
}

export async function setBlockedToServer(client: any, list: string[]): Promise<boolean> {
  try {
    if (!client || !client.setAccountData) {
      // fallback to local
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list)) } catch (_) {}
      return true
    }
    await (client as any).setAccountData(ACCOUNT_DATA_EVENT, { blocked: list })
    return true
  } catch (_) {
    return false
  }
}

export async function addBlockedToServer(client: any, userId: string): Promise<string[]> {
  if (!userId) return getBlocked()
  const list = await getBlockedFromServer(client)
  if (!list.includes(userId)) list.push(userId)
  await setBlockedToServer(client, list)
  return list
}

export async function removeBlockedFromServer(client: any, userId: string): Promise<string[]> {
  if (!userId) return getBlocked()
  const list = (await getBlockedFromServer(client)).filter(x => x !== userId)
  await setBlockedToServer(client, list)
  return list
}

export default { getBlocked, isBlocked, addBlocked, removeBlocked }
