import React, {useEffect, useState} from 'react'
import useMatrixClient from '../hooks/useMatrixClient'
import { getBlockedFromServer, removeBlockedFromServer, getBlocked as getBlockedLocal,
  getMutedFromServer, removeMutedFromServer, getMuted as getMutedLocal } from '../utils/blockList'

export default function BlockManager() {
  const { client } = useMatrixClient()
  const [blocks, setBlocks] = useState<string[]>([])
  const [muted, setMuted] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      try {
        const list = client ? await getBlockedFromServer(client) : getBlockedLocal()
        const mList = client ? await getMutedFromServer(client) : getMutedLocal()
        if (!mounted) return
        setBlocks(list || [])
        setMuted(mList || [])
        setError(null)
      } catch (e: any) {
        if (!mounted) return
        setError(String(e?.message ?? e))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [client])

  const onUnblock = async (id: string) => {
    if (!id) return
    setLoading(true)
    try {
      if (client) {
        const newList = await removeBlockedFromServer(client, id)
        setBlocks(newList)
      } else {
        // local fallback
        await removeBlockedFromServer(null as any, id)
        const local = getBlockedLocal()
        setBlocks(local)
      }
      setError(null)
    } catch (e: any) {
      setError(String(e?.message ?? e))
      } finally {
      setLoading(false)
    }
  }

  const onUnmute = async (id: string) => {
    if (!id) return
    setLoading(true)
    try {
      if (client) {
        const newList = await removeMutedFromServer(client, id)
        setMuted(newList)
      } else {
        await removeMutedFromServer(null as any, id)
        const local = getMutedLocal()
        setMuted(local)
      }
      setError(null)
    } catch (e: any) {
      setError(String(e?.message ?? e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{padding: 12}}>
      <h3 style={{margin: 0}}>Blocked users</h3>
      <div style={{marginTop: 8, color: '#666'}}>Manage the list of users you have blocked. This list is synced across your devices.</div>

      {loading && <div style={{marginTop: 8}}>Loading…</div>}
      {error && <div style={{marginTop: 8, color: 'crimson'}}>{error}</div>}

      <div style={{marginTop: 12}}>
        <div style={{marginBottom: 8}}>
          <strong>Blocked</strong>
        </div>
        {blocks.length === 0 ? (
          <div style={{color: '#666'}}>You haven't blocked any users.</div>
        ) : (
          <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
            {blocks.map(b => (
              <div key={b} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 8, border: '1px solid #eee', borderRadius: 6}}>
                <div style={{fontFamily: 'monospace'}}>{b}</div>
                <div>
                  <button onClick={() => onUnblock(b)} style={{padding: '6px 10px'}}>Unblock</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{marginTop: 16, marginBottom: 8}}>
          <strong>Muted</strong>
        </div>
        {muted.length === 0 ? (
          <div style={{color: '#666'}}>You haven't muted any users.</div>
        ) : (
          <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
            {muted.map(b => (
              <div key={b} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 8, border: '1px solid #eee', borderRadius: 6}}>
                <div style={{fontFamily: 'monospace'}}>{b}</div>
                <div>
                  <button onClick={() => onUnmute(b)} style={{padding: '6px 10px'}}>Unmute</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
