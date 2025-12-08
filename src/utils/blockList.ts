// Simple client-side block list storage + helpers (UX-only). Uses localStorage for persistence.

const STORAGE_KEY = 'swarmchat_block_list'

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

export default { getBlocked, isBlocked, addBlocked, removeBlocked }
