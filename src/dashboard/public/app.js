// Dashboard Frontend

let ws = null;
let reconnectTimeout = null;
let data = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  connectWebSocket();
  setInterval(updateAges, 1000); // Update ages every second
});

// WebSocket connection
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('WebSocket connected');
    updateConnectionStatus(true);
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
  };

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    handleMessage(message);
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected');
    updateConnectionStatus(false);
    // Reconnect after 5 seconds
    reconnectTimeout = setTimeout(connectWebSocket, 5000);
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}

function handleMessage(message) {
  if (message.type === 'init' || message.type === 'update') {
    data = message.data;
    updateUI();
  } else if (message.type === 'control') {
    console.log('Control action:', message.action);
  }
}

function updateUI() {
  if (!data) return;

  updateState();
  updatePnL();
  updatePositions();
  updateSignals();
  updateTrades();
  updateEvents();
  updateMemories();
  updateStatusBadges();
}

function updateConnectionStatus(connected) {
  const badge = document.getElementById('connectionStatus');
  badge.textContent = connected ? '● ONLINE' : '● OFFLINE';
  badge.className = `status-badge ${connected ? 'connected' : 'disconnected'}`;
}

function updateState() {
  const state = data.state;
  if (!state) return;

  document.getElementById('mood').textContent = state.primaryMood || '-';
  document.getElementById('confidence').textContent = state.confidence ? state.confidence.toFixed(2) : '-';
  document.getElementById('riskAppetite').textContent = state.riskAppetite ? state.riskAppetite.toFixed(2) : '-';
  document.getElementById('suspicion').textContent = state.suspicion ? state.suspicion.toFixed(2) : '-';
  document.getElementById('regret').textContent = state.regret ? state.regret.toFixed(2) : '-';
  document.getElementById('fatigue').textContent = state.fatigue ? state.fatigue.toFixed(2) : '-';
}

function updatePnL() {
  document.getElementById('capital').textContent = `${data.capital.toFixed(2)} SOL`;

  const totalPnL = document.getElementById('totalPnL');
  totalPnL.textContent = `${data.totalPnL >= 0 ? '+' : ''}${data.totalPnL.toFixed(2)} SOL`;
  totalPnL.className = `value large ${data.totalPnL >= 0 ? 'positive' : 'negative'}`;

  const dailyPnL = document.getElementById('dailyPnL');
  dailyPnL.textContent = `${data.dailyPnL >= 0 ? '+' : ''}${data.dailyPnL.toFixed(2)} SOL`;
  dailyPnL.className = `value large ${data.dailyPnL >= 0 ? 'positive' : 'negative'}`;
}

function updatePositions() {
  const tbody = document.getElementById('positionsBody');

  if (data.positions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty">── no open positions ──</td></tr>';
    return;
  }

  tbody.innerHTML = data.positions.map(pos => {
    const pnl = pos.unrealizedPnL || 0;
    const age = Math.floor((Date.now() - pos.entryTime) / 1000 / 60); // minutes

    return `
      <tr>
        <td>${pos.tokenSymbol}</td>
        <td class="direction-${pos.direction}">${pos.direction.toUpperCase()}</td>
        <td>${pos.entryPrice.toFixed(6)}</td>
        <td>${pos.currentPrice ? pos.currentPrice.toFixed(6) : '-'}</td>
        <td>${pos.size.toFixed(4)}</td>
        <td class="${pnl >= 0 ? 'positive' : 'negative'}">${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}</td>
        <td>${age}m</td>
      </tr>
    `;
  }).join('');
}

function updateSignals() {
  const tbody = document.getElementById('signalsBody');

  if (data.signals.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">── no active signals ──</td></tr>';
    return;
  }

  tbody.innerHTML = data.signals.map(sig => {
    const age = Math.floor((Date.now() - sig.timestamp) / 1000 / 60); // minutes

    return `
      <tr>
        <td><span class="signal-type">${sig.type}</span></td>
        <td>${sig.tokenSymbol || 'undefined'}</td>
        <td>${sig.confidence.toFixed(2)}</td>
        <td>${sig.strength.toFixed(2)}</td>
        <td>${sig.urgency.toFixed(2)}</td>
        <td>${age}m</td>
      </tr>
    `;
  }).join('');
}

function updateTrades() {
  const tbody = document.getElementById('tradesBody');

  if (data.recentTrades.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty">── no recent trades ──</td></tr>';
    return;
  }

  tbody.innerHTML = data.recentTrades.slice(0, 10).map(trade => {
    const time = new Date(trade.timestamp).toLocaleTimeString();
    const pnl = trade.realizedPnL || 0;

    return `
      <tr>
        <td>${time}</td>
        <td>${trade.tokenSymbol}</td>
        <td class="direction-${trade.direction}">${trade.direction.toUpperCase()}</td>
        <td><span class="trade-status ${trade.status}">${trade.status}</span></td>
        <td>${trade.fillPrice ? trade.fillPrice.toFixed(6) : '-'}</td>
        <td>${trade.filledSize ? trade.filledSize.toFixed(4) : '-'}</td>
        <td class="${pnl >= 0 ? 'positive' : 'negative'}">${pnl !== 0 ? (pnl >= 0 ? '+' : '') + pnl.toFixed(2) : '-'}</td>
      </tr>
    `;
  }).join('');
}

function updateEvents() {
  const container = document.getElementById('eventsList');

  if (data.recentEvents.length === 0) {
    container.innerHTML = '<p class="empty">── no recent events ──</p>';
    return;
  }

  container.innerHTML = data.recentEvents.slice(0, 20).map(event => {
    const time = new Date(event.timestamp).toLocaleTimeString();

    return `
      <div class="event-item">
        <span class="event-time">${time}</span>
        <span class="event-type">${event.type}</span>
        ${event.tokenSymbol ? event.tokenSymbol + ' - ' : ''}${event.source}
        ${event.data && event.data.value ? ': ' + JSON.stringify(event.data.value) : ''}
      </div>
    `;
  }).join('');
}

function updateMemories() {
  const container = document.getElementById('memoryList');

  if (data.recentMemories.length === 0) {
    container.innerHTML = '<p class="empty">── no memories ──</p>';
    return;
  }

  container.innerHTML = data.recentMemories.slice(0, 20).map(mem => {
    const time = new Date(mem.timestamp).toLocaleTimeString();

    return `
      <div class="memory-item">
        <span class="memory-time">${time}</span>
        [${mem.type}] ${mem.summary}
        ${mem.outcome ? ' → ' + mem.outcome : ''}
        ${mem.importance ? ' (' + mem.importance.toFixed(2) + ')' : ''}
      </div>
    `;
  }).join('');
}

function updateStatusBadges() {
  const tradingStatus = document.getElementById('tradingStatus');
  const safeModeStatus = document.getElementById('safeModeStatus');

  tradingStatus.textContent = data.tradingPaused ? '[PAUSED]' : '[ACTIVE]';
  tradingStatus.className = `status-badge ${data.tradingPaused ? 'paused' : 'trading'}`;

  if (data.safeMode) {
    safeModeStatus.textContent = '[SAFE_MODE]';
    safeModeStatus.className = 'status-badge safe-mode';
    safeModeStatus.style.display = 'inline';
  } else {
    safeModeStatus.style.display = 'none';
  }
}

function updateAges() {
  // Ages update automatically on next full update
}
