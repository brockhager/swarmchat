import React, {useEffect, useState} from 'react'
import useMatrixClient from '../hooks/useMatrixClient'

export default function ChatDemo() {
  const {client, connectionState, userId} = useMatrixClient()
  const [joinedRooms, setJoinedRooms] = useState<Array<{roomId: string; name?: string}>>([])
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<string | null>(null)

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
    return () => {
      ;(client as any).removeListener && (client as any).removeListener('Room', onRoom)
    }
  }, [client])

  const sendMessage = async () => {
    if (!client || !selectedRoom) return
    if (!message.trim()) return
    try {
      setStatus('Sending…')
      const txnId = `m-${Date.now()}`
      const content = {msgtype: 'm.text', body: message}
      // Use sendEvent (some versions of the SDK have helpers like sendMessageEvent)
      await (client as any).sendEvent(selectedRoom, 'm.room.message', content, txnId)
      setMessage('')
      setStatus('Sent')
      setTimeout(() => setStatus(null), 1200)
    } catch (err) {
      setStatus('Send failed: ' + (err && (err as Error).message))
    }
  }

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
          <button onClick={sendMessage} disabled={!selectedRoom || !message.trim()} style={{padding: '8px 12px'}}>
            Send
          </button>
        </div>

        {status && <div style={{marginTop: 8, fontSize: 13}}>{status}</div>}

        <div style={{marginTop: 16, color: '#666', fontSize: 13}}>
          This is a tiny demo to validate the end-to-end stack — it lists rooms from the logged-in account and
          sends a plaintext message into the selected room using the Matrix client.
        </div>
      </div>
    </div>
  )
}
