import React, { useState } from 'react';
import NodeControl from './components/NodeControl';
import LogViewer from './components/LogViewer';
import useConnectionMonitor from './hooks/useConnectionMonitor';
import './App.css';

const App: React.FC = () => {
  const [showLogs, setShowLogs] = useState(false);

  return (
    <div className="app-layout">
      <header className="app-header">
        <h1>SwarmChat</h1>
        <div className="control-area">
          <NodeControl />

          <button
            onClick={() => setShowLogs(!showLogs)}
            className="log-toggle-button"
          >
            {showLogs ? 'Hide Logs' : 'Show Logs'}
          </button>
        </div>
      </header>

      <main className="app-main-content">
        <ConnectionGate />
        <p>Welcome to SwarmChat. Decentralized chat content goes here.</p>
        {!showLogs && <p>Click "Show Logs" to view your local node status.</p>}
      </main>

      {showLogs && (
        <aside className="app-log-viewer">
          <LogViewer />
        </aside>
      )}
    </div>
  );
};

// Small UI component which uses the connection monitor and renders a spinner + helpful control.
function ConnectionGate() {
  const {
    ready,
    status,
    clientPort,
    pid,
    probing,
    startNode,
    stopNode,
    refreshStatus,
  } = useConnectionMonitor({ pollInterval: 1000, requiredPort: true });

  if (ready) {
    return (
      <div style={{ padding: 12, background: '#f4fff7', borderRadius: 8, marginBottom: 12 }}>
        Node is ready — connected to local Dendrite {clientPort ? `(port ${clientPort})` : ''} {pid ? `PID ${pid}` : ''}
      </div>
    );
  }

  return (
    <div style={{ padding: 12, background: '#fff7f7', borderRadius: 8, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 12, height: 12, borderRadius: 6, background: probing ? '#f6c84c' : '#9aa4b2' }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600 }}>Waiting for local node…</div>
        <div style={{ fontSize: 12, color: '#666' }}>
          Status: {status} {clientPort ? `(port ${clientPort})` : ''}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => startNode()}>Start node</button>
        <button onClick={() => stopNode()}>Stop node</button>
        <button onClick={() => refreshStatus()}>Refresh</button>
      </div>
    </div>
  );
}

export default App;
