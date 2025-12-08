import React, { useState } from 'react'
import useMatrixClient from '../hooks/useMatrixClient'
import { containsBadWord } from '../utils/badWords'

export default function AuthForm() {
  const { login, register, isAuthenticated, connectionState, connectionError, disconnect } = useMatrixClient({ autoConnect: true })

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onLogin = async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await login?.(username.trim(), password)
      if (!res) setError('Login failed')
    } catch (e: any) {
      setError(String(e?.message ?? e))
    } finally {
      setLoading(false)
    }
  }

  const onRegister = async () => {
    setError(null)
    const name = username.trim()
    if (!name) return setError('Please enter a username')
    if (containsBadWord(name)) return setError('Username contains restricted language.')
    if (!password) return setError('Please enter a password')

    setLoading(true)
    try {
      const res = await register?.(name, password)
      if (!res) setError('Registration failed')
    } catch (e: any) {
      setError(String(e?.message ?? e))
    } finally {
      setLoading(false)
    }
  }

  if (isAuthenticated) {
    return (
      <div style={{padding: 12}}>
        <div style={{fontWeight: 700}}>You are signed in</div>
        <div style={{marginTop: 8}}>If you'd like, you can sign out to test sign-in flows.</div>
        <div style={{marginTop: 8}}>
          <button onClick={() => disconnect?.()} style={{padding: '6px 10px'}}>Sign out</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{padding: 12, maxWidth: 520}}>
      <h3 style={{margin: 0}}>Sign in / Register (dev)</h3>
      <div style={{marginTop: 10, color: '#666', fontSize: 13}}>Create an account on your local Dendrite or sign in using username + password.</div>

      <div style={{display: 'flex', gap: 8, marginTop: 10}}>
        <input value={username} onChange={e => setUsername(e.target.value)} placeholder="username (no email)" style={{flex: 1, padding: 8}} />
        <input value={password} onChange={e => setPassword(e.target.value)} placeholder="password" type="password" style={{flex: 1, padding: 8}} />
      </div>

      {error && <div style={{color: 'crimson', marginTop: 8}}>{error}</div>}

      <div style={{display: 'flex', gap: 8, marginTop: 12}}>
        <button onClick={onLogin} disabled={loading || !username || !password} style={{padding: '8px 12px'}}>Sign in</button>
        <button onClick={onRegister} disabled={loading || !username || !password} style={{padding: '8px 12px'}}>Register</button>
      </div>

      <div style={{marginTop: 12, color: '#666', fontSize: 12}}>
        Note: This demo enforces no email and applies a small front-end bad-word filter on registration for UX only.
      </div>
    </div>
  )
}
