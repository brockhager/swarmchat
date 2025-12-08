import { useCallback, useEffect, useRef, useState } from 'react';
import useConnectionMonitor from './useConnectionMonitor';
import { createClient, MatrixClient } from 'matrix-js-sdk';

// Simple connection states
export type MatrixConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

// A minimal placeholder client type. Swap with a real Matrix client implementation later.
export type MatrixClientStub = MatrixClient;

// Helper: attempt to probe the Dendrite client API
async function probeServer(baseUrl: string, path = '/_matrix/client/versions', timeoutMs = 3000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(baseUrl + path, { method: 'GET', signal: controller.signal });
    clearTimeout(id);
    return res.ok;
  } catch (e) {
    return false;
  }
}

export default function useMatrixClient({
  pollInterval = 1000,
  requiredPort = true,
  probeTimeout = 3000,
  autoConnect = true,
  auth,
} : { pollInterval?: number; requiredPort?: boolean; probeTimeout?: number; autoConnect?: boolean; auth?: { username?: string; password?: string; accessToken?: string; userId?: string } } = {}) {
  const monitor = useConnectionMonitor({ pollInterval, requiredPort });

  const [client, setClient] = useState<MatrixClientStub | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [state, setState] = useState<MatrixConnectionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const connect = useCallback(async () => {
    setError(null);

    if (!monitor.clientPort) {
      setError('no-port');
      setState('error');
      return null;
    }

    const port = monitor.clientPort;
    const baseUrl = `http://127.0.0.1:${port}`;

    setState('connecting');

    // attempt a server probe first
    const ok = await probeServer(baseUrl, undefined, probeTimeout);
    if (!ok) {
      setState('error');
      setError('server-probe-failed');
      return null;
    }
    // initialize a real matrix client using matrix-js-sdk
    try {
      // Check persisted tokens in localStorage first
      const storedToken = typeof window !== 'undefined' ? window.localStorage.getItem('swarmchat_access_token') : null
      const storedUser = typeof window !== 'undefined' ? window.localStorage.getItem('swarmchat_user_id') : null
      if (storedToken && storedUser) {
        const c = createClient({ baseUrl, accessToken: storedToken, userId: storedUser });
        try { c.startClient(); } catch (_) {}
        if (mounted.current) {
          setClient(c);
          setUserId(storedUser);
          setState('connected');
          setIsAuthenticated(true);
        }
        return c as MatrixClientStub;
      }
      // if we have access token + userId, construct a direct client
      if (auth?.accessToken && auth?.userId) {
        const c = createClient({ baseUrl, accessToken: auth.accessToken, userId: auth.userId });
        // start the client to begin syncing
        try { c.startClient(); } catch (_) {}
        if (mounted.current) {
          setClient(c);
          setUserId((c as any).getUserId ? (c as any).getUserId() : (c as any).credentials?.userId ?? null);
          setIsAuthenticated(true);
          setState('connected');
        }
        return c as MatrixClientStub;
      }

      // If credentials provided, attempt login and recreate the authenticated client
      if (auth?.username && auth?.password) {
        const temp = createClient({ baseUrl });
        const loginRes = await temp.login('m.login.password', { user: auth.username, password: auth.password });
        // loginRes should contain access_token and user_id
        const accessToken = (loginRes as any).access_token;
        const userId = (loginRes as any).user_id;
        if (!accessToken || !userId) throw new Error('login_failed');
        const c = createClient({ baseUrl, accessToken, userId });
        try { c.startClient(); } catch (_) {}
        if (mounted.current) {
          setClient(c);
          setUserId((c as any).getUserId ? (c as any).getUserId() : (c as any).credentials?.userId ?? null);
          setIsAuthenticated(true);
          setState('connected');
        }
        return c as MatrixClientStub;
      }

      // No credentials — create a basic client without auth. It can still probe server and be used for unauthenticated requests.
      const anon = createClient({ baseUrl });
      try { anon.startClient(); } catch (_) {}
      if (mounted.current) {
        setClient(anon as MatrixClientStub);
        setUserId((anon as any).getUserId ? (anon as any).getUserId() : (anon as any).credentials?.userId ?? null);
        // No auth in this case
        setIsAuthenticated(false);
        setState('connected');
      }
      return anon as MatrixClientStub;
    } catch (e: any) {
      setState('error');
      setError(String(e?.message ?? e));
      return null;
    }
  }, [monitor.clientPort, probeTimeout]);

  const disconnect = useCallback(async () => {
    if (!client) return;
    setState('disconnected');
    try {
      try { (client as any).stopClient(); } catch (_) {}
    } catch (e) {
      // ignore
    }
    setClient(null);
    setUserId(null);
    setIsAuthenticated(false);
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('swarmchat_access_token')
        window.localStorage.removeItem('swarmchat_user_id')
      }
    } catch (_) {}
  }, [client]);

  // login and register helpers exposed to the UI
  const login = useCallback(async (username?: string, password?: string) => {
    setError(null);
    if (!monitor.clientPort) {
      setError('no-port');
      return null;
    }
    const baseUrl = `http://127.0.0.1:${monitor.clientPort}`
    try {
      setState('connecting');
      const temp = createClient({ baseUrl });
      const res = await (temp as any).login('m.login.password', { user: username, password });
      const accessToken = (res as any).access_token
      const uid = (res as any).user_id
      if (!accessToken || !uid) throw new Error('login_failed')
      // persist and create the real client
      try { if (typeof window !== 'undefined') { window.localStorage.setItem('swarmchat_access_token', accessToken); window.localStorage.setItem('swarmchat_user_id', uid) } } catch (_) {}
      const c = createClient({ baseUrl, accessToken, userId: uid })
      try { c.startClient(); } catch (_) {}
      if (mounted.current) {
        setClient(c);
        setUserId(uid);
        setIsAuthenticated(true);
        setState('connected');
      }
      return c as MatrixClientStub;
    } catch (e: any) {
      setState('error');
      setError(String(e?.message ?? e))
      return null;
    }
  }, [monitor.clientPort]);

  const register = useCallback(async (username?: string, password?: string) => {
    setError(null);
    if (!monitor.clientPort) {
      setError('no-port');
      return null;
    }
    const baseUrl = `http://127.0.0.1:${monitor.clientPort}`
    try {
      setState('connecting');
      const temp = createClient({ baseUrl });
      // Some homeservers may require registration flows; this tries the simple path
      const res = await (temp as any).register({ username, password, inhibit_login: false });
      const accessToken = (res as any).access_token
      const uid = (res as any).user_id
      if (!accessToken || !uid) throw new Error('register_failed')
      try { if (typeof window !== 'undefined') { window.localStorage.setItem('swarmchat_access_token', accessToken); window.localStorage.setItem('swarmchat_user_id', uid) } } catch (_) {}
      const c = createClient({ baseUrl, accessToken, userId: uid })
      try { c.startClient(); } catch (_) {}
      if (mounted.current) {
        setClient(c);
        setUserId(uid);
        setIsAuthenticated(true);
        setState('connected');
      }
      return c as MatrixClientStub;
    } catch (e: any) {
      setState('error');
      setError(String(e?.message ?? e))
      return null;
    }
  }, [monitor.clientPort]);

  // When monitor becomes ready, automatically connect (if enabled)
  useEffect(() => {
    if (!autoConnect) return;
    if (monitor.ready && monitor.clientPort && state !== 'connected' && state !== 'connecting') {
      let cancelled = false;
      (async () => {
        setState('connecting');
        const result = await connect();
        if (!result && !cancelled) {
          // schedule retry
          const t = setTimeout(() => {
            if (mounted.current) {
              // let monitor's polling try again later
              setState('error');
            }
          }, pollInterval);
          return () => clearTimeout(t);
        }
      })();
      return () => { cancelled = true; };
    }
  }, [monitor.ready, monitor.clientPort, autoConnect, connect, pollInterval, state]);

  // If monitor stops being ready while client is connected, disconnect
  useEffect(() => {
    if (!monitor.ready && client) {
      // remote node went away — disconnect local client
      (async () => {
        try { await disconnect(); } catch (_) {}
      })();
    }
  }, [monitor.ready, client, disconnect]);

  return {
    client,
    userId,
    isAuthenticated,
    connectionState: state,
    connectionError: error,
    connect,
    disconnect,
    login,
    register,
    monitor,
  } as const;
}
