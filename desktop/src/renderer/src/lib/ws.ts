import type { BroadcastPayload } from './types';

type Handler = (data: unknown) => void;

const listeners = new Map<string, Set<Handler>>();
let socket: WebSocket | null = null;
let currentToken: string | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let shouldRun = false;

function emit(type: string, data: unknown) {
  listeners.get(type)?.forEach((h) => h(data));
}

export function on(type: 'broadcast' | 'presence' | 'status', handler: Handler): () => void {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type)!.add(handler);
  return () => listeners.get(type)?.delete(handler);
}

function open() {
  if (!currentToken || !shouldRun) return;
  const url = `${window.api.config.wsUrl}?token=${encodeURIComponent(currentToken)}`;
  socket = new WebSocket(url);

  socket.onopen = () => emit('status', { connected: true });
  socket.onclose = () => {
    emit('status', { connected: false });
    if (shouldRun) scheduleReconnect();
  };
  socket.onerror = () => socket?.close();
  socket.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data) as { type: string; payload?: BroadcastPayload; count?: number };
      if (msg.type === 'broadcast' && msg.payload) emit('broadcast', msg.payload);
      else if (msg.type === 'presence') emit('presence', msg.count ?? 0);
      else if (msg.type === 'welcome') emit('presence', (msg as { presence?: number }).presence ?? 0);
    } catch {
      /* ignore */
    }
  };
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    open();
  }, 3000);
}

export function connectWs(token: string) {
  currentToken = token;
  shouldRun = true;
  if (socket && socket.readyState <= WebSocket.OPEN) socket.close();
  open();
}

export function disconnectWs() {
  shouldRun = false;
  currentToken = null;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  socket?.close();
  socket = null;
}
