import React, {useEffect, useState, useRef} from 'react'
import useMatrixClient from '../hooks/useMatrixClient'
import { getBlocked, isBlocked, addBlocked, removeBlocked } from '../utils/blockList'

export default function ChatDemo() {
  const {client, connectionState, userId} = useMatrixClient()
  const [joinedRooms, setJoinedRooms] = useState<Array<{roomId: string; name?: string}>>([])
  const [blocked, setBlocked] = useState<string[]>(() => getBlocked())
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<string | null>(null)

  const [messages, setMessages] = useState<Array<{id: string; txnId?: string; sender?: string; body: string; ts?: number; status?: 'pending'|'sent'|'failed'; receipts?: string[]}>>([])
  const timelineListenerRef = useRef<Function | null>(null)
  const messagesContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!client) return

    // Fetch joined rooms from the server and populate a simple room list
    // We use any-casts since different matrix-js-sdk versions vary slightly in typings.
    ;(async () => {
      try {
        setStatus('Loading joined rooms...')
        // Using the client REST helper to get joined rooms
        const r = await (client as any).getJoinedRooms()
        const roomIds: string[] = r && r.joined_rooms ? r.joined_rooms : r
        const rooms = roomIds.map((id: string) => ({roomId: id, name: (client as any).getRoom(id)?.name || (client as any).getRoom(id)?.roomId || id}))
        setJoinedRooms(rooms)
        if (rooms.length) setSelectedRoom(rooms[0].roomId)
        setStatus(null)
      } catch (err) {
        setStatus('Failed to load joined rooms: ' + (err && (err as Error).message))
      }
    })()

    // listen for new rooms that become available in the client in-memory store
    const onRoom = (room: any) => {
      setJoinedRooms(prev => {
        if (prev.find(r => r.roomId === room.roomId)) return prev
        const name = room?.name || room?.roomId || room?.room_id || room.roomId
        return [{roomId: room.roomId, name}, ...prev]
      })
    }

    ;(client as any).on && (client as any).on('Room', onRoom)
    // storage event so block-list changes in other tabs update this component
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'swarmchat_block_list') setBlocked(getBlocked())
    }
    if (typeof window !== 'undefined') window.addEventListener('storage', onStorage)
    return () => {
      ;(client as any).removeListener && (client as any).removeListener('Room', onRoom)
      if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage)
    }
  }, [client])

  // When the selected room changes, load recent history and attach a Room.timeline listener
  useEffect(() => {
    if (!client || !selectedRoom) {
      setMessages([])
      return
    }

    let cancelled = false

    const normalizeEvent = (ev: any) => {
      // SDK events may expose getContent/getSender/getTs or have content/sender/timestamp directly
      const getContent = ev?.getContent ? ev.getContent() : ev?.content
      const sender = ev?.getSender ? ev.getSender() : ev?.sender
      const eventId = ev?.getId ? ev.getId() : ev?.event_id ?? String(Math.random())
      const ts = ev?.getTs ? ev.getTs() : ev?.origin_server_ts
      const body = getContent?.body ?? String(getContent ?? '')
      return {id: eventId, sender, body, ts}
    }

    const loadHistory = async () => {
      try {
        setStatus('Loading room history...')

        // Try to use an SDK-provided scrollback/back-pagination helper first
        try {
          await (client as any).scrollback?.(selectedRoom, 30)
        } catch (_) {
          // not all SDK versions expose scrollback, it's a best-effort call
        }

        // Now read the in-memory timeline events for the room and convert them into our messages list
        const room = (client as any).getRoom ? (client as any).getRoom(selectedRoom) : null
        let events: any[] = []
        if (room) {
          // room may expose .getLiveTimeline().getEvents() or .timeline
          const live = room.getLiveTimeline ? room.getLiveTimeline() : null
          if (live && live.getEvents) events = live.getEvents()
          else if (room.timeline) events = room.timeline
          else if (room.getTimeline) events = room.getTimeline()
        }

        // Convert to a simple list of message-like objects and keep them chronological (oldest first)
        const converted = (events || []).filter(e => {
          const t = e?.getType ? e.getType() : e?.type
          return t === 'm.room.message'
        }).map(e => normalizeEvent(e)).reverse()

        if (!cancelled) {
          setMessages(converted)
          setStatus(null)
        }
      } catch (err) {
        if (!cancelled) setStatus('Failed to load history: ' + (err && (err as Error).message))
      }
    }

    // timeline handler appends new message events live
    const onTimeline = (event: any, roomObj: any, toStartOfTimeline: boolean, removed: any, data: any) => {
      try {
        const ev = event
        const type = ev?.getType ? ev.getType() : ev?.type
        if (type !== 'm.room.message') return
        const normalized = normalizeEvent(ev)
        setMessages(prev => {
          // Avoid duplicates by event id
          if (prev.find(m => m.id === normalized.id)) return prev

          // If a pending optimistic message exists that matches this event (same sender/body and recent), upgrade it
          const now = Date.now()
          const pendingIdx = prev.findIndex(m => m.status === 'pending' && m.sender === normalized.sender && (m.body || '').trim() === (normalized.body || '').trim() && (now - (m.ts || now) < 30_000))
          if (pendingIdx !== -1) {
            const copy = [...prev]
            // Replace pending message id with server event id and mark sent
            copy[pendingIdx] = {...copy[pendingIdx], id: normalized.id, status: 'sent', ts: normalized.ts ?? copy[pendingIdx].ts}
            return copy
          }

          return [...prev, {...normalized, status: 'sent'}]
        })
      } catch (_) {}
    }

    // Attach timeline listener
    (client as any).on && (client as any).on('Room.timeline', onTimeline)
    timelineListenerRef.current = onTimeline

    loadHistory()

    return () => {
      cancelled = true
      // detach timeline listener
      const listener = timelineListenerRef.current
      if (listener) {
        ;(client as any).removeListener && (client as any).removeListener('Room.timeline', listener)
        timelineListenerRef.current = null
      }
    }
  }, [client, selectedRoom])

  const sendMessage = async () => {
    if (!client || !selectedRoom) return
    if (!message.trim()) return

    if (otherIsBlocked) {
      setStatus('Cannot send — other participant is blocked.')
      return
    }

    // Create a unique transaction id for optimistic UI
    const txnId = `txn-${Date.now()}-${Math.random().toString(36).slice(2,8)}`
    const now = Date.now()
    const optimistic = { id: txnId, txnId, sender: userId || 'me', body: message, ts: now, status: 'pending' as const }

    // add optimistic message to the timeline immediately
    setMessages(prev => [...prev, optimistic])
    setMessage('')
    setStatus('Sending…')

    try {
      const content = {msgtype: 'm.text', body: optimistic.body}
      // sendEvent should return the server event id on success
      const eventId = await (client as any).sendEvent(selectedRoom, 'm.room.message', content, txnId)

      // Update the optimistic message into a confirmed one
      setMessages(prev => prev.map(m => (m.txnId === txnId || m.id === txnId) ? {...m, id: (eventId as string) ?? m.id, status: 'sent'} : m))
      setStatus('Sent')
      setTimeout(() => setStatus(null), 1200)
    } catch (err) {
      // mark the message as failed
      setMessages(prev => prev.map(m => (m.txnId === txnId || m.id === txnId) ? {...m, status: 'failed'} : m))
      setStatus('Send failed: ' + (err && (err as Error).message))
    }
  }

  // block/unblock helpers
  const onBlock = (userIdToBlock?: string | null) => {
    if (!userIdToBlock) return
    addBlocked(userIdToBlock)
    setBlocked(getBlocked())
  }

  const onUnblock = (userIdToUnblock?: string | null) => {
    if (!userIdToUnblock) return
    removeBlocked(userIdToUnblock)
    setBlocked(getBlocked())
  }

  // Retry a failed message by finding it and re-sending its body with a fresh txnId.
  const retrySend = async (idOrTxn?: string) => {
    if (!client || !selectedRoom) return
    const msg = messages.find(m => m.id === idOrTxn || m.txnId === idOrTxn)
    if (!msg) return

    const txnId = `retry-${Date.now()}-${Math.random().toString(36).slice(2,8)}`
    setMessages(prev => prev.map(m => (m.id === msg.id || m.txnId === msg.txnId) ? {...m, status: 'pending', txnId, ts: Date.now()} : m))
    setStatus('Retrying…')

    try {
      const content = {msgtype: 'm.text', body: msg.body}
      const eventId = await (client as any).sendEvent(selectedRoom, 'm.room.message', content, txnId)
      setMessages(prev => prev.map(m => (m.txnId === txnId || m.id === txnId) ? {...m, id: (eventId as string) ?? m.id, status: 'sent'} : m))
      setStatus('Sent')
      setTimeout(() => setStatus(null), 800)
    } catch (e: any) {
      setMessages(prev => prev.map(m => (m.txnId === txnId || m.id === txnId) ? {...m, status: 'failed'} : m))
      setStatus('Retry failed: ' + (e && (e as Error).message))
    }
  }

  // scroll to bottom when new messages are appended
  useEffect(() => {
    const el = messagesContainerRef.current
    if (!el) return
    // wait to allow rendering
    setTimeout(() => {
      try { el.scrollTop = el.scrollHeight } catch (_) {}
    }, 40)
  }, [messages])

  // helper to find the other user id in a DM room (2 members)
  const getOtherUserId = () => {
    if (!client || !selectedRoom || !userId) return null
    const room = (client as any).getRoom ? (client as any).getRoom(selectedRoom) : null
    if (!room) return null
    // try various ways to get joined members
    let members: any[] = []
    if (room.getJoinedMembers && typeof room.getJoinedMembers === 'function') {
      try { members = room.getJoinedMembers() } catch (_) { members = [] }
    } else if (room.getMembers && typeof room.getMembers === 'function') {
      try { members = room.getMembers() } catch (_) { members = [] }
    } else if (room.currentState && room.currentState.getMembers) {
      try { members = room.currentState.getMembers() } catch (_) { members = [] }
    }

    const ids = members.map(m => m?.userId || m?.user_id || m?.userId || (typeof m === 'string' ? m : null)).filter(Boolean)
    const others = ids.filter((id: string) => id !== userId)
    if (others.length === 1) return others[0]
    return null
  }

  const otherUserInDM = getOtherUserId()
  const otherIsBlocked = !!otherUserInDM && isBlocked(otherUserInDM)

  // Poll for read receipts for sent events and annotate messages with receipts (small UX feature)
  useEffect(() => {
    if (!client || !selectedRoom) return

    let cancelled = false

    const poll = async () => {
      try {
        const room = (client as any).getRoom ? (client as any).getRoom(selectedRoom) : null
        for (const m of messages) {
          if (cancelled) break
          if (!m.id || String(m.id).startsWith('txn-') || m.status !== 'sent') continue
          if (isBlocked(m.sender)) continue
          try {
            let receipts: string[] = []
            if ((client as any).getEventReceipts) {
              const res = await (client as any).getEventReceipts(selectedRoom, m.id)
              // Flatten structure
              if (res && typeof res === 'object') {
                for (const t of Object.keys(res)) {
                  for (const u of Object.keys(res[t] || {})) receipts.push(u)
                }
              }
            } else if (room && room.getReceiptsForEvent) {
              const res = room.getReceiptsForEvent(m.id)
              if (res && typeof res === 'object') {
                for (const uid of Object.keys(res || {})) receipts.push(uid)
              }
            }

            if (!cancelled && receipts.length) {
              setMessages(prev => prev.map(x => x.id === m.id ? {...x, receipts} : x))
            }
          } catch (_) {}
        }
      } catch (_) {}
    }

    poll()
    const t = setInterval(poll, 5000)
    return () => { cancelled = true; clearInterval(t) }
  }, [client, selectedRoom, messages])

  if (connectionState !== 'connected') {
    return (
      <div style={{padding: 12}}>
        <strong>Chat demo</strong>
        <div style={{marginTop: 8}}>Waiting for Matrix client to connect… (state: {connectionState})</div>
      </div>
    )
  }

  return (
    <div style={{padding: 12, display: 'flex', gap: 16}}>
      <div style={{width: 260}}>
        <h3 style={{margin: '4px 0'}}>User</h3>
        <div style={{fontSize: 12, color: '#666'}}>{userId || 'unknown'}</div>

        <h3 style={{marginTop: 12, marginBottom: 4}}>Joined rooms</h3>
        <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
          {joinedRooms.length === 0 ? (
            <div style={{color: '#666'}}>No joined rooms found (try creating or joining a room in your home server)</div>
          ) : (
            joinedRooms.map(r => (
              <button
                key={r.roomId}
                onClick={() => setSelectedRoom(r.roomId)}
                style={{
                  textAlign: 'left',
                  padding: 8,
                  borderRadius: 6,
                  background: r.roomId === selectedRoom ? '#e7f0ff' : '#fff',
                  border: '1px solid #ddd',
                  cursor: 'pointer'
                }}
              >
                <div style={{fontWeight: 600}}>{r.name || r.roomId}</div>
                <div style={{fontSize: 11, color: '#666'}}>{r.roomId}</div>
              </button>
            ))
          )}
        </div>
      
        <div style={{marginTop: 14}}>
          <h4 style={{margin: '6px 0'}}>Blocked users</h4>
          {blocked.length === 0 ? (
            <div style={{fontSize: 12, color: '#666'}}>No blocked users</div>
          ) : (
            blocked.map(u => (
              <div key={u} style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0'}}>
                <div style={{fontSize: 12}}>{u}</div>
                <button onClick={() => onUnblock(u)} style={{padding: '4px 8px'}}>Unblock</button>
              </div>
            ))
          )}
        </div>

      </div>

      <div style={{flex: 1}}>
        <h3 style={{margin: '4px 0'}}>Room</h3>
        <div style={{fontSize: 12, color: '#666', marginBottom: 8}}>{selectedRoom || 'Select a room'}</div>

        <div style={{display: 'flex', gap: 8}}>
          <input
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={selectedRoom ? 'Type a message and press Send' : 'Select a room first'}
            style={{flex: 1, padding: '8px 10px', borderRadius: 6, border: '1px solid #ccc'}}
            disabled={!selectedRoom}
          />
          <button onClick={sendMessage} disabled={!selectedRoom || !message.trim() || (!!otherIsBlocked)} style={{padding: '8px 12px'}}>
            Send
          </button>
        </div>

        {otherIsBlocked && (
          <div style={{marginTop: 8, color: 'crimson'}}>You have blocked the other participant in this direct message — un-block them to send messages.</div>
        )}

        {status && <div style={{marginTop: 8, fontSize: 13}}>{status}</div>}

        <div style={{marginTop: 12, border: '1px solid #eee', borderRadius: 8, padding: 8, maxHeight: 260, overflow: 'auto'}} ref={messagesContainerRef}>
          {messages.length === 0 ? (
            <div style={{color: '#888'}}>No messages for this room yet — send one to seed the timeline.</div>
          ) : (
            // hide messages from blocked users in the timeline
            messages.filter(m => !m.sender || !isBlocked(m.sender)).map(m => (
              <div key={m.id} style={{padding: 8, borderRadius: 6, background: m.sender === userId ? '#eaffea' : '#f9f9ff', marginBottom: 6}}>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8}}>
                  <div style={{fontSize: 12, color: '#333', fontWeight: 600}}>{m.sender || 'unknown'}</div>
                  <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                    <div style={{fontSize: 11, color: m.status === 'failed' ? 'crimson' : m.status === 'pending' ? '#b07a00' : '#3b7' }}>{m.status ? (m.status === 'pending' ? 'Sending…' : m.status === 'failed' ? 'Failed' : 'Sent') : ''}</div>
                    {m.status === 'failed' && (
                      <button onClick={() => retrySend(m.id ?? m.txnId)} style={{padding: '4px 8px', borderRadius: 6}}>Retry</button>
                    )}
                    {/* allow blocking/unblocking of message sender (client-side) */}
                    {m.sender && m.sender !== userId && (
                      isBlocked(m.sender) ? (
                        <button onClick={() => onUnblock(m.sender)} style={{padding: '4px 8px', borderRadius: 6}}>Unblock</button>
                      ) : (
                        <button onClick={() => onBlock(m.sender)} style={{padding: '4px 8px', borderRadius: 6}}>Block</button>
                      )
                    )}
                    {/* receipts: show small count */}
                    {m.receipts && m.receipts.length > 0 && (
                      <div style={{fontSize: 11, color: '#666'}}>{m.receipts.length} read</div>
                    )}
                  </div>
                </div>
                <div style={{fontSize: 14, marginTop: 6}}>{m.body}</div>
                <div style={{fontSize: 11, color: '#777', marginTop: 6}}>{m.ts ? new Date(m.ts).toLocaleString() : ''}</div>
              </div>
            ))
          )}
        </div>

        <div style={{marginTop: 16, color: '#666', fontSize: 13}}>
          This is a tiny demo to validate the end-to-end stack — it lists rooms from the logged-in account and
          sends a plaintext message into the selected room using the Matrix client.
        </div>
      </div>
    </div>
  )
}
